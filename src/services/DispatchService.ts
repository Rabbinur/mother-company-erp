import mongoose from "mongoose";
import { Dispatch, type IDispatch, type IDispatchOrderItem, type IDispatchOrderStop, type IDispatchExpense } from "@/models/Dispatch";
import { Order } from "@/models/Order";
import { Warehouse } from "@/models/Warehouse";
import { Vehicle } from "@/models/Vehicle";
import { User } from "@/models/User";
import { Counter } from "@/models/Counter";
import { InventoryBalance } from "@/models/InventoryBalance";
import { StockMovement } from "@/models/StockMovement";
import { SalesReturn } from "@/models/SalesReturn";
import { AuditLog } from "@/models/AuditLog";
import { InventoryService } from "./InventoryService";
import { generateReferenceCode } from "@/lib/utils";

export interface CreateDispatchInput {
  businessId: string | mongoose.Types.ObjectId;
  warehouseId: string | mongoose.Types.ObjectId;
  orderIds: Array<string | mongoose.Types.ObjectId>;
  vehicleId?: string | mongoose.Types.ObjectId;
  deliverymanId?: string | mongoose.Types.ObjectId;
  tripDate?: Date;
  actorId?: string | mongoose.Types.ObjectId;
}

export interface LoadDispatchInput {
  dispatchId: string | mongoose.Types.ObjectId;
  loadedItems?: Array<{
    orderId: string | mongoose.Types.ObjectId;
    variantId: string | mongoose.Types.ObjectId;
    loadedQuantity: number;
  }>;
  actorId?: string | mongoose.Types.ObjectId;
  session?: mongoose.ClientSession;
}

export interface DeliveryStopOutcomeInput {
  orderId: string | mongoose.Types.ObjectId;
  status: "delivered" | "partially_delivered" | "failed" | "rejected";
  deliveredItems?: Array<{
    variantId: string | mongoose.Types.ObjectId;
    deliveredQuantity: number;
    returnedQuantity?: number;
    damagedQuantity?: number;
    returnReason?: string;
    condition?: "good" | "damaged";
  }>;
  cashCollected?: number;
  digitalPaymentCollected?: number;
  failureReason?: string;
  notes?: string;
  deliveryProof?: string;
}

export interface RecordDeliveriesInput {
  dispatchId: string | mongoose.Types.ObjectId;
  stops: DeliveryStopOutcomeInput[];
  actorId?: string | mongoose.Types.ObjectId;
  session?: mongoose.ClientSession;
}

export interface CloseDispatchInput {
  dispatchId: string | mongoose.Types.ObjectId;
  cashDeposited: number;
  notes?: string;
  actorId?: string | mongoose.Types.ObjectId;
  session?: mongoose.ClientSession;
}

export interface AddTripExpenseInput {
  dispatchId: string | mongoose.Types.ObjectId;
  expenseType: "fuel" | "toll" | "parking" | "transport" | "labor" | "other";
  amount: number;
  payer: "business" | "principal";
  principalCompanyId?: string | mongoose.Types.ObjectId;
  notes?: string;
  allocationMethod?: "equal" | "delivered_qty" | "fixed_per_order" | "manual";
  dealershipAllocations?: Array<{
    dealershipId: string | mongoose.Types.ObjectId;
    amount: number;
    percentage: number;
  }>;
  actorId?: string | mongoose.Types.ObjectId;
}

export class DispatchService {
  /**
   * Concurrency-safe, atomic sequence generation for Dispatches
   */
  static async generateDispatchNumber(
    businessId: string | mongoose.Types.ObjectId,
    session?: mongoose.ClientSession
  ): Promise<string> {
    const ym = new Date().toISOString().slice(0, 7).replace("-", "");
    const key = `dsp_${String(businessId)}_${ym}`;
    const seq = await Counter.getNextSequence(key, session);
    return generateReferenceCode("DSP", seq);
  }

  /**
   * Create a Delivery Dispatch / Trip
   */
  static async createDispatch(input: CreateDispatchInput): Promise<IDispatch> {
    const bId = new mongoose.Types.ObjectId(String(input.businessId));
    const wId = new mongoose.Types.ObjectId(String(input.warehouseId));
    const actId = input.actorId ? new mongoose.Types.ObjectId(String(input.actorId)) : undefined;

    const warehouse = await Warehouse.findById(wId).lean();
    if (!warehouse) throw new Error("Origin warehouse not found");

    if (!input.orderIds || input.orderIds.length === 0) {
      throw new Error("Dispatch must contain at least one Sales Order");
    }

    const orderObjIds = input.orderIds.map((id) => new mongoose.Types.ObjectId(String(id)));
    const orders = await Order.find({ _id: { $in: orderObjIds } })
      .populate("customerId", "name shopName address phone")
      .lean();

    if (orders.length !== orderObjIds.length) {
      throw new Error("One or more specified Sales Orders were not found");
    }

    const dealershipIdSet = new Set<string>();
    const orderStops: IDispatchOrderStop[] = [];
    const dispatchItems: IDispatchOrderItem[] = [];

    let stopSeq = 1;
    for (const order of orders) {
      // Security & State Invariant: Only CONFIRMED orders are eligible for dispatch
      const statusUpper = String(order.orderStatus).toUpperCase();
      if (statusUpper !== "CONFIRMED") {
        throw new Error(
          `Order ${order.orderNumber} is in status '${order.orderStatus}'. Only CONFIRMED orders can be dispatched.`
        );
      }

      // Invariant: Order must not already be in an active dispatch
      if (order.dispatchId) {
        const activeDisp = await Dispatch.findOne({
          _id: order.dispatchId,
          status: { $in: ["PENDING_DISPATCH", "READY_FOR_DISPATCH", "LOADED", "IN_TRANSIT"] },
        }).lean();
        if (activeDisp) {
          throw new Error(
            `Order ${order.orderNumber} is already allocated to active dispatch ${activeDisp.dispatchNumber}`
          );
        }
      }

      // Warehouse validation: All orders in this dispatch must originate from the same warehouse
      if (String(order.warehouseId) !== String(wId)) {
        throw new Error(
          `Order ${order.orderNumber} belongs to warehouse ${order.warehouseId}, but dispatch origin is ${wId}`
        );
      }

      const dId = order.dealershipId ? new mongoose.Types.ObjectId(String(order.dealershipId)) : new mongoose.Types.ObjectId();
      dealershipIdSet.add(String(dId));

      const cust = order.customerId as any;
      orderStops.push({
        orderId: order._id as mongoose.Types.ObjectId,
        orderNumber: order.orderNumber,
        dealershipId: dId,
        customerId: cust?._id || order.customerId,
        customerName: cust?.name || "Customer",
        shopName: cust?.shopName,
        address: cust?.address,
        phone: cust?.phone,
        stopSequence: stopSeq++,
        status: "pending",
        cashCollected: 0,
        digitalPaymentCollected: 0,
      });

      for (const item of order.items) {
        dispatchItems.push({
          orderId: order._id as mongoose.Types.ObjectId,
          dealershipId: dId,
          productId: item.productId as mongoose.Types.ObjectId,
          variantId: item.variantId as mongoose.Types.ObjectId,
          name: item.name,
          sku: item.sku,
          orderQuantity: item.quantity,
          loadedQuantity: 0,
          deliveredQuantity: 0,
          returnedQuantity: 0,
          damagedQuantity: 0,
          undeliveredQuantity: 0,
          unitPrice: item.customerPriceSnapshot || item.unitPrice || 0,
        });
      }
    }

    // Vehicle lookup
    let vehicleNumber: string | undefined;
    let vId: mongoose.Types.ObjectId | undefined;
    if (input.vehicleId) {
      vId = new mongoose.Types.ObjectId(String(input.vehicleId));
      const veh = await Vehicle.findById(vId).lean();
      if (veh) vehicleNumber = veh.registrationNumber;
    }

    // Deliveryman lookup
    let deliverymanName: string | undefined;
    let deliverymanPhone: string | undefined;
    let dmanId: mongoose.Types.ObjectId | undefined;
    if (input.deliverymanId) {
      dmanId = new mongoose.Types.ObjectId(String(input.deliverymanId));
      const dman = await User.findById(dmanId).lean();
      if (dman) {
        deliverymanName = dman.name;
        deliverymanPhone = dman.phone;
      }
    }

    const dispatchNumber = await this.generateDispatchNumber(bId);
    const initialStatus = vId && dmanId ? "READY_FOR_DISPATCH" : "PENDING_DISPATCH";

    const dispatch = await Dispatch.create({
      dispatchNumber,
      businessId: bId,
      warehouseId: wId,
      dealershipIds: Array.from(dealershipIdSet).map((id) => new mongoose.Types.ObjectId(id)),
      status: initialStatus,
      tripDate: input.tripDate || new Date(),
      vehicleId: vId,
      vehicleNumber,
      deliverymanId: dmanId,
      deliverymanName,
      deliverymanPhone,
      orders: orderStops,
      items: dispatchItems,
      expenses: [],
      workers: [],
      createdBy: actId,
    });

    // Tag orders with dispatchId
    await Order.updateMany(
      { _id: { $in: orderObjIds } },
      { $set: { dispatchId: dispatch._id } }
    );

    if (actId) {
      await AuditLog.create({
        actorId: actId,
        action: "DISPATCH_CREATED",
        entityType: "dispatch",
        entityId: String(dispatch._id),
        afterSnapshot: {
          dispatchNumber,
          orderCount: orders.length,
          status: initialStatus,
        },
      });
    }

    return dispatch;
  }

  /**
   * Load Dispatch: Confirms physical loading and updates stockInTransit custody
   */
  static async loadDispatch(input: LoadDispatchInput): Promise<IDispatch> {
    const dispId = new mongoose.Types.ObjectId(String(input.dispatchId));
    const actId = input.actorId ? new mongoose.Types.ObjectId(String(input.actorId)) : undefined;

    const dispatch = await Dispatch.findById(dispId).session(input.session || null);
    if (!dispatch) throw new Error("Dispatch not found");

    if (dispatch.status !== "PENDING_DISPATCH" && dispatch.status !== "READY_FOR_DISPATCH") {
      throw new Error(`Cannot load dispatch in status '${dispatch.status}'`);
    }

    // Process actual loaded quantities
    for (const item of dispatch.items) {
      let qtyToLoad = item.orderQuantity;
      if (input.loadedItems && input.loadedItems.length > 0) {
        const found = input.loadedItems.find(
          (li) =>
            String(li.orderId) === String(item.orderId) &&
            String(li.variantId) === String(item.variantId)
        );
        if (found) {
          qtyToLoad = Math.max(0, Number(found.loadedQuantity));
        }
      }

      item.loadedQuantity = qtyToLoad;

      // Custody Transfer: Move loaded quantity into stockInTransit for this dealership & warehouse
      const bal = await InventoryService.getOrCreateBalance(
        dispatch.businessId,
        item.dealershipId,
        dispatch.warehouseId,
        item.productId,
        item.variantId,
        input.session
      );

      bal.stockInTransit = (bal.stockInTransit || 0) + qtyToLoad;
      bal.lastUpdated = new Date();
      await bal.save({ session: input.session });

      // Record immutable stock movement for custody transfer
      const moveCode = generateReferenceCode("STK-LOAD", Math.floor(Math.random() * 9000 + 1000));
      await StockMovement.create(
        [
          {
            movementNumber: moveCode,
            type: "dispatch_load",
            businessId: dispatch.businessId,
            dealershipId: item.dealershipId,
            productId: item.productId,
            variantId: item.variantId,
            warehouseId: dispatch.warehouseId,
            quantity: qtyToLoad,
            previousOnHand: bal.onHandQuantity,
            newOnHand: bal.onHandQuantity,
            previousReserved: bal.reservedQuantity,
            newReserved: bal.reservedQuantity,
            referenceType: "dispatch",
            referenceId: dispatch.dispatchNumber,
            notes: `Loaded on vehicle ${dispatch.vehicleNumber || "N/A"} for trip ${dispatch.dispatchNumber}`,
            createdBy: actId,
          },
        ],
        input.session ? { session: input.session } : {}
      );
    }

    dispatch.status = "LOADED";
    await dispatch.save({ session: input.session });

    if (actId) {
      await AuditLog.create({
        actorId: actId,
        action: "DISPATCH_LOADED",
        entityType: "dispatch",
        entityId: String(dispatch._id),
        afterSnapshot: {
          dispatchNumber: dispatch.dispatchNumber,
          status: "LOADED",
        },
      });
    }

    return dispatch;
  }

  /**
   * Start Dispatch Trip: Marks dispatch IN_TRANSIT
   */
  static async startDispatch(
    dispatchId: string | mongoose.Types.ObjectId,
    actorId?: string | mongoose.Types.ObjectId,
    session?: mongoose.ClientSession
  ): Promise<IDispatch> {
    const dispId = new mongoose.Types.ObjectId(String(dispatchId));
    const actId = actorId ? new mongoose.Types.ObjectId(String(actorId)) : undefined;

    const dispatch = await Dispatch.findById(dispId).session(session || null);
    if (!dispatch) throw new Error("Dispatch not found");

    if (dispatch.status !== "LOADED") {
      throw new Error(`Cannot start trip in status '${dispatch.status}'. Must be LOADED.`);
    }

    dispatch.status = "IN_TRANSIT";
    dispatch.startedAt = new Date();
    await dispatch.save({ session });

    if (actId) {
      await AuditLog.create({
        actorId: actId,
        action: "DISPATCH_STARTED",
        entityType: "dispatch",
        entityId: String(dispatch._id),
      });
    }

    return dispatch;
  }

  /**
   * Record Stop Deliveries: Executes sales fulfillment and captures retailer returns
   */
  static async recordDeliveries(input: RecordDeliveriesInput): Promise<IDispatch> {
    const dispId = new mongoose.Types.ObjectId(String(input.dispatchId));
    const actId = input.actorId ? new mongoose.Types.ObjectId(String(input.actorId)) : undefined;

    const dispatch = await Dispatch.findById(dispId).session(input.session || null);
    if (!dispatch) throw new Error("Dispatch not found");

    // Idempotent guard: if already DELIVERED, return without repeating fulfillment
    if (dispatch.status === "DELIVERED") {
      return dispatch;
    }

    if (
      dispatch.status !== "LOADED" &&
      dispatch.status !== "IN_TRANSIT" &&
      dispatch.status !== "PARTIALLY_DELIVERED"
    ) {
      throw new Error(`Cannot record deliveries for dispatch in status '${dispatch.status}'`);
    }

    for (const stopInput of input.stops) {
      const orderStop = dispatch.orders.find(
        (o) => String(o.orderId) === String(stopInput.orderId)
      );
      if (!orderStop) continue;

      orderStop.status = stopInput.status;
      orderStop.deliveredAt = new Date();
      if (stopInput.cashCollected !== undefined) orderStop.cashCollected = stopInput.cashCollected;
      if (stopInput.digitalPaymentCollected !== undefined) orderStop.digitalPaymentCollected = stopInput.digitalPaymentCollected;
      if (stopInput.failureReason) orderStop.failureReason = stopInput.failureReason;
      if (stopInput.notes) orderStop.notes = stopInput.notes;
      if (stopInput.deliveryProof) orderStop.deliveryProof = stopInput.deliveryProof;

      // Process items for this order
      const orderItems = dispatch.items.filter(
        (it) => String(it.orderId) === String(stopInput.orderId)
      );

      for (const item of orderItems) {
        let deliveredQty = item.loadedQuantity;
        let returnedQty = 0;
        let damagedQty = 0;
        let returnReason: string | undefined;
        let condition: "good" | "damaged" | undefined;

        if (stopInput.deliveredItems && stopInput.deliveredItems.length > 0) {
          const matched = stopInput.deliveredItems.find(
            (di) => String(di.variantId) === String(item.variantId)
          );
          if (matched) {
            deliveredQty = Math.max(0, Number(matched.deliveredQuantity || 0));
            returnedQty = Math.max(0, Number(matched.returnedQuantity || 0));
            damagedQty = Math.max(0, Number(matched.damagedQuantity || 0));
            returnReason = matched.returnReason;
            condition = matched.condition;
          }
        } else if (stopInput.status === "failed" || stopInput.status === "rejected") {
          deliveredQty = 0;
          returnedQty = 0;
        }

        item.deliveredQuantity = deliveredQty;
        item.returnedQuantity = returnedQty;
        item.damagedQuantity = damagedQty;
        item.returnReason = returnReason;
        item.condition = condition;

        // Fulfill actual delivered stock exactly once: consumes OnHand, Reserved, and InTransit
        if (deliveredQty > 0) {
          const bal = await InventoryService.getOrCreateBalance(
            dispatch.businessId,
            item.dealershipId,
            dispatch.warehouseId,
            item.productId,
            item.variantId,
            input.session
          );

          const prevOnHand = bal.onHandQuantity;
          const prevReserved = bal.reservedQuantity;
          const prevInTransit = bal.stockInTransit || 0;

          bal.onHandQuantity = Math.max(0, prevOnHand - deliveredQty);
          bal.reservedQuantity = Math.max(0, prevReserved - deliveredQty);
          bal.stockInTransit = Math.max(0, prevInTransit - deliveredQty);
          bal.availableQuantity = bal.onHandQuantity - bal.reservedQuantity;
          bal.lastUpdated = new Date();
          await bal.save({ session: input.session });

          const moveCode = generateReferenceCode("STK-FUL", Math.floor(Math.random() * 9000 + 1000));
          await StockMovement.create(
            [
              {
                movementNumber: moveCode,
                type: "sales_fulfillment",
                businessId: dispatch.businessId,
                dealershipId: item.dealershipId,
                productId: item.productId,
                variantId: item.variantId,
                warehouseId: dispatch.warehouseId,
                quantity: -deliveredQty,
                previousOnHand: prevOnHand,
                newOnHand: bal.onHandQuantity,
                previousReserved: prevReserved,
                newReserved: bal.reservedQuantity,
                referenceType: "dispatch_delivery",
                referenceId: orderStop.orderNumber,
                notes: `Delivered via trip ${dispatch.dispatchNumber}`,
                createdBy: actId,
              },
            ],
            input.session ? { session: input.session } : {}
          );
        }

        // Retailer return at doorstep: Quarantined pending inspection (does not automatically become sellable stock)
        if (returnedQty > 0) {
          const retNum = generateReferenceCode("SRT", Math.floor(Math.random() * 9000 + 1000));
          await SalesReturn.create(
            [
              {
                returnNumber: retNum,
                businessId: dispatch.businessId,
                dealershipId: item.dealershipId,
                dispatchId: dispatch._id,
                orderId: item.orderId,
                orderNumber: orderStop.orderNumber,
                customerId: orderStop.customerId,
                warehouseId: dispatch.warehouseId,
                items: [
                  {
                    productId: item.productId,
                    variantId: item.variantId,
                    name: item.name,
                    sku: item.sku,
                    returnedQuantity: returnedQty,
                    customerPriceSnapshot: item.unitPrice,
                    condition: condition || "good",
                    restockEligible: condition !== "damaged",
                    refundAmount: returnedQty * item.unitPrice,
                  },
                ],
                totalRefundAmount: returnedQty * item.unitPrice,
                reason: returnReason || "Retailer return at delivery stop",
                status: "pending",
                restocked: false,
                createdBy: actId,
              },
            ],
            input.session ? { session: input.session } : {}
          );
        }
      }

      // Update Sales Order Fulfillment Status based on actual delivery events
      const order = await Order.findById(orderStop.orderId).session(input.session || null);
      if (order) {
        if (stopInput.status === "delivered") {
          order.fulfillmentStatus = "fulfilled";
          order.orderStatus = "FULFILLED";
          order.fulfilledDate = new Date();
        } else if (stopInput.status === "partially_delivered") {
          order.fulfillmentStatus = "partially_fulfilled";
          order.orderStatus = "PARTIALLY_FULFILLED";
        }
        await order.save({ session: input.session });
      }
    }

    // Determine overall dispatch status
    const allDelivered = dispatch.orders.every((o) => o.status === "delivered");
    const allFailed = dispatch.orders.every((o) => o.status === "failed" || o.status === "rejected");

    if (allDelivered) {
      dispatch.status = "DELIVERED";
    } else if (allFailed) {
      dispatch.status = "DELIVERY_FAILED";
    } else {
      dispatch.status = "PARTIALLY_DELIVERED";
    }

    await dispatch.save({ session: input.session });

    if (actId) {
      await AuditLog.create({
        actorId: actId,
        action: "DISPATCH_DELIVERIES_RECORDED",
        entityType: "dispatch",
        entityId: String(dispatch._id),
      });
    }

    return dispatch;
  }

  /**
   * Close & Reconcile Trip: Reconciles loaded vs delivered, returns, damaged, undelivered, and cash
   */
  static async closeAndReconcileDispatch(input: CloseDispatchInput): Promise<IDispatch> {
    const dispId = new mongoose.Types.ObjectId(String(input.dispatchId));
    const actId = input.actorId ? new mongoose.Types.ObjectId(String(input.actorId)) : undefined;

    const dispatch = await Dispatch.findById(dispId).session(input.session || null);
    if (!dispatch) throw new Error("Dispatch not found");

    if (
      dispatch.status !== "DELIVERED" &&
      dispatch.status !== "PARTIALLY_DELIVERED" &&
      dispatch.status !== "DELIVERY_FAILED"
    ) {
      throw new Error(`Cannot close dispatch in status '${dispatch.status}'`);
    }

    let totalLoaded = 0;
    let totalDelivered = 0;
    let totalReturned = 0;
    let totalDamaged = 0;
    let totalUndelivered = 0;

    for (const item of dispatch.items) {
      const undelivered = Math.max(
        0,
        item.loadedQuantity - (item.deliveredQuantity + item.returnedQuantity + item.damagedQuantity)
      );
      item.undeliveredQuantity = undelivered;

      totalLoaded += item.loadedQuantity;
      totalDelivered += item.deliveredQuantity;
      totalReturned += item.returnedQuantity;
      totalDamaged += item.damagedQuantity;
      totalUndelivered += undelivered;

      // Reconcile remaining in-transit custody: Clear in-transit for undelivered stock returned to warehouse
      if (undelivered > 0) {
        const bal = await InventoryService.getOrCreateBalance(
          dispatch.businessId,
          item.dealershipId,
          dispatch.warehouseId,
          item.productId,
          item.variantId,
          input.session
        );

        bal.stockInTransit = Math.max(0, (bal.stockInTransit || 0) - undelivered);
        bal.lastUpdated = new Date();
        await bal.save({ session: input.session });

        const moveCode = generateReferenceCode("STK-RET", Math.floor(Math.random() * 9000 + 1000));
        await StockMovement.create(
          [
            {
              movementNumber: moveCode,
              type: "undelivered_return",
              businessId: dispatch.businessId,
              dealershipId: item.dealershipId,
              productId: item.productId,
              variantId: item.variantId,
              warehouseId: dispatch.warehouseId,
              quantity: undelivered,
              previousOnHand: bal.onHandQuantity,
              newOnHand: bal.onHandQuantity,
              previousReserved: bal.reservedQuantity,
              newReserved: bal.reservedQuantity,
              referenceType: "dispatch_close",
              referenceId: dispatch.dispatchNumber,
              notes: `Undelivered stock returned to warehouse from trip ${dispatch.dispatchNumber}`,
              createdBy: actId,
            },
          ],
          input.session ? { session: input.session } : {}
        );
      }
    }

    // Reconciliation Formula: Loaded = Delivered + Returns + Damaged + Undelivered
    const stockVariance = totalLoaded - (totalDelivered + totalReturned + totalDamaged + totalUndelivered);
    const isStockBalanced = stockVariance === 0;

    const totalCashCollected = dispatch.orders.reduce((sum, o) => sum + (o.cashCollected || 0), 0);
    const cashDeposited = Number(input.cashDeposited || 0);
    const cashDifference = cashDeposited - totalCashCollected;

    dispatch.reconciliation = {
      totalLoadedQuantity: totalLoaded,
      totalDeliveredQuantity: totalDelivered,
      totalReturnedQuantity: totalReturned,
      totalDamagedQuantity: totalDamaged,
      totalUndeliveredQuantity: totalUndelivered,
      isStockBalanced,
      stockVariance,
      totalCashCollected,
      cashDeposited,
      cashDifference,
      reconciledBy: actId,
      reconciledAt: new Date(),
      notes: input.notes?.trim(),
    };

    dispatch.completedAt = new Date();
    await dispatch.save({ session: input.session });

    if (actId) {
      await AuditLog.create({
        actorId: actId,
        action: "DISPATCH_RECONCILED",
        entityType: "dispatch",
        entityId: String(dispatch._id),
        afterSnapshot: {
          dispatchNumber: dispatch.dispatchNumber,
          isStockBalanced,
          stockVariance,
          cashDifference,
        },
      });
    }

    return dispatch;
  }

  /**
   * Cancel Dispatch: Safely reverses in-transit stock custody and unbinds orders
   */
  static async cancelDispatch(
    dispatchId: string | mongoose.Types.ObjectId,
    reason?: string,
    actorId?: string | mongoose.Types.ObjectId,
    session?: mongoose.ClientSession
  ): Promise<IDispatch> {
    const dispId = new mongoose.Types.ObjectId(String(dispatchId));
    const actId = actorId ? new mongoose.Types.ObjectId(String(actorId)) : undefined;

    const dispatch = await Dispatch.findById(dispId).session(session || null);
    if (!dispatch) throw new Error("Dispatch not found");

    if (dispatch.status === "DELIVERED" || dispatch.status === "PARTIALLY_DELIVERED") {
      throw new Error(`Cannot cancel dispatch in status '${dispatch.status}' where deliveries were recorded.`);
    }

    if (dispatch.status === "CANCELLED") {
      return dispatch;
    }

    // Reverse in-transit stock if dispatch was already loaded
    if (dispatch.status === "LOADED" || dispatch.status === "IN_TRANSIT") {
      for (const item of dispatch.items) {
        if (item.loadedQuantity > 0) {
          const bal = await InventoryService.getOrCreateBalance(
            dispatch.businessId,
            item.dealershipId,
            dispatch.warehouseId,
            item.productId,
            item.variantId,
            session
          );

          bal.stockInTransit = Math.max(0, (bal.stockInTransit || 0) - item.loadedQuantity);
          bal.lastUpdated = new Date();
          await bal.save({ session });

          const moveCode = generateReferenceCode("STK-UNLD", Math.floor(Math.random() * 9000 + 1000));
          await StockMovement.create(
            [
              {
                movementNumber: moveCode,
                type: "dispatch_unload",
                businessId: dispatch.businessId,
                dealershipId: item.dealershipId,
                productId: item.productId,
                variantId: item.variantId,
                warehouseId: dispatch.warehouseId,
                quantity: -item.loadedQuantity,
                previousOnHand: bal.onHandQuantity,
                newOnHand: bal.onHandQuantity,
                previousReserved: bal.reservedQuantity,
                newReserved: bal.reservedQuantity,
                referenceType: "dispatch_cancel",
                referenceId: dispatch.dispatchNumber,
                notes: `Unloaded due to dispatch cancellation: ${reason || "Cancelled"}`,
                createdBy: actId,
              },
            ],
            session ? { session } : {}
          );
        }
      }
    }

    // Unbind orders so they can be dispatched again
    const orderIds = dispatch.orders.map((o) => o.orderId);
    await Order.updateMany(
      { _id: { $in: orderIds } },
      { $unset: { dispatchId: 1 } }
    );

    dispatch.status = "CANCELLED";
    dispatch.cancellationReason = reason?.trim() || "Cancelled by user";
    dispatch.cancelledBy = actId;
    await dispatch.save({ session });

    if (actId) {
      await AuditLog.create({
        actorId: actId,
        action: "DISPATCH_CANCELLED",
        entityType: "dispatch",
        entityId: String(dispatch._id),
      });
    }

    return dispatch;
  }

  /**
   * Add Trip Expense with multi-dealership cost allocation and principal reimbursement support
   */
  static async addTripExpense(input: AddTripExpenseInput): Promise<IDispatch> {
    const dispId = new mongoose.Types.ObjectId(String(input.dispatchId));
    const dispatch = await Dispatch.findById(dispId);
    if (!dispatch) throw new Error("Dispatch not found");

    const amount = Number(input.amount);
    if (amount <= 0) throw new Error("Expense amount must be greater than zero");

    const method = input.allocationMethod || "delivered_qty";
    const dealershipIds = dispatch.dealershipIds;
    let allocations: Array<{ dealershipId: mongoose.Types.ObjectId; amount: number; percentage: number }> = [];

    if (method === "equal" || dealershipIds.length <= 1) {
      const splitAmt = Math.round((amount / dealershipIds.length) * 100) / 100;
      allocations = dealershipIds.map((dId) => ({
        dealershipId: dId,
        amount: splitAmt,
        percentage: Math.round((100 / dealershipIds.length) * 100) / 100,
      }));
    } else if (method === "delivered_qty") {
      // Calculate delivered/loaded quantity per dealership
      const qtyMap = new Map<string, number>();
      let totalQty = 0;
      for (const it of dispatch.items) {
        const dStr = String(it.dealershipId);
        const qty = it.deliveredQuantity > 0 ? it.deliveredQuantity : it.loadedQuantity || it.orderQuantity;
        qtyMap.set(dStr, (qtyMap.get(dStr) || 0) + qty);
        totalQty += qty;
      }

      if (totalQty > 0) {
        allocations = dealershipIds.map((dId) => {
          const q = qtyMap.get(String(dId)) || 0;
          const pct = Math.round((q / totalQty) * 10000) / 100;
          const allocAmt = Math.round(((amount * q) / totalQty) * 100) / 100;
          return { dealershipId: dId, amount: allocAmt, percentage: pct };
        });
      } else {
        const splitAmt = Math.round((amount / dealershipIds.length) * 100) / 100;
        allocations = dealershipIds.map((dId) => ({
          dealershipId: dId,
          amount: splitAmt,
          percentage: 50,
        }));
      }
    } else if (method === "manual" && input.dealershipAllocations) {
      allocations = input.dealershipAllocations.map((a) => ({
        dealershipId: new mongoose.Types.ObjectId(String(a.dealershipId)),
        amount: a.amount,
        percentage: a.percentage,
      }));
    }

    const isPrincipal = input.payer === "principal";
    const expenseEntry: IDispatchExpense = {
      expenseType: input.expenseType,
      amount,
      payer: input.payer,
      principalCompanyId: input.principalCompanyId
        ? new mongoose.Types.ObjectId(String(input.principalCompanyId))
        : undefined,
      reimbursementStatus: isPrincipal ? "pending_claim" : "not_applicable",
      claimAmount: isPrincipal ? amount : 0,
      notes: input.notes?.trim(),
      allocationMethod: method,
      dealershipAllocations: allocations,
    };

    dispatch.expenses.push(expenseEntry);
    await dispatch.save();

    return dispatch;
  }

  /**
   * Approve Sales Return Inspection: Restocks approved goods or moves damaged goods to damage balance
   */
  static async approveSalesReturnInspection(params: {
    returnId: string | mongoose.Types.ObjectId;
    decision: "approve" | "reject";
    condition?: "good" | "damaged";
    notes?: string;
    actorId?: string | mongoose.Types.ObjectId;
    session?: mongoose.ClientSession;
  }): Promise<any> {
    const rId = new mongoose.Types.ObjectId(String(params.returnId));
    const actId = params.actorId ? new mongoose.Types.ObjectId(String(params.actorId)) : undefined;

    const salesReturn = await SalesReturn.findById(rId).session(params.session || null);
    if (!salesReturn) throw new Error("Sales Return record not found");

    if (salesReturn.status !== "pending") {
      throw new Error(`Cannot inspect return in status '${salesReturn.status}'`);
    }

    if (params.decision === "reject") {
      salesReturn.status = "rejected";
      salesReturn.inspectionNotes = params.notes;
      salesReturn.inspectedBy = actId;
      salesReturn.inspectedAt = new Date();
      await salesReturn.save({ session: params.session });
      return salesReturn;
    }

    const condition = params.condition || salesReturn.items[0]?.condition || "good";

    for (const item of salesReturn.items) {
      const bal = await InventoryService.getOrCreateBalance(
        salesReturn.businessId,
        salesReturn.dealershipId,
        salesReturn.warehouseId,
        item.productId,
        item.variantId,
        params.session
      );

      if (condition === "good") {
        // Restock into sellable inventory
        bal.onHandQuantity += item.returnedQuantity;
        bal.availableQuantity += item.returnedQuantity;
        bal.lastUpdated = new Date();
        await bal.save({ session: params.session });

        const moveCode = generateReferenceCode("STK-RET", Math.floor(Math.random() * 9000 + 1000));
        await StockMovement.create(
          [
            {
              movementNumber: moveCode,
              type: "sales_return",
              businessId: salesReturn.businessId,
              dealershipId: salesReturn.dealershipId,
              productId: item.productId,
              variantId: item.variantId,
              warehouseId: salesReturn.warehouseId,
              quantity: item.returnedQuantity,
              previousOnHand: bal.onHandQuantity - item.returnedQuantity,
              newOnHand: bal.onHandQuantity,
              previousReserved: bal.reservedQuantity,
              newReserved: bal.reservedQuantity,
              referenceType: "sales_return",
              referenceId: salesReturn.returnNumber,
              notes: `Restocked approved sales return ${salesReturn.returnNumber}`,
              createdBy: actId,
            },
          ],
          params.session ? { session: params.session } : {}
        );
      } else {
        // Quarantined as damaged
        bal.damagedQuantity = (bal.damagedQuantity || 0) + item.returnedQuantity;
        bal.lastUpdated = new Date();
        await bal.save({ session: params.session });

        const moveCode = generateReferenceCode("STK-DMG", Math.floor(Math.random() * 9000 + 1000));
        await StockMovement.create(
          [
            {
              movementNumber: moveCode,
              type: "damage",
              businessId: salesReturn.businessId,
              dealershipId: salesReturn.dealershipId,
              productId: item.productId,
              variantId: item.variantId,
              warehouseId: salesReturn.warehouseId,
              quantity: item.returnedQuantity,
              previousOnHand: bal.onHandQuantity,
              newOnHand: bal.onHandQuantity,
              previousReserved: bal.reservedQuantity,
              newReserved: bal.reservedQuantity,
              referenceType: "sales_return_damage",
              referenceId: salesReturn.returnNumber,
              notes: `Damaged product quarantined from return ${salesReturn.returnNumber}`,
              createdBy: actId,
            },
          ],
          params.session ? { session: params.session } : {}
        );
      }
    }

    salesReturn.status = "approved";
    salesReturn.restocked = condition === "good";
    salesReturn.inspectionNotes = params.notes;
    salesReturn.inspectedBy = actId;
    salesReturn.inspectedAt = new Date();
    await salesReturn.save({ session: params.session });

    return salesReturn;
  }

  /**
   * Daily deliveryman stock reconciliation sheet
   */
  static async getDeliverymanDailyStockSheet(params: {
    deliverymanId: string | mongoose.Types.ObjectId;
    tripDate?: Date | string;
    businessId: string | mongoose.Types.ObjectId;
  }) {
    const dmanId = new mongoose.Types.ObjectId(String(params.deliverymanId));
    const bId = new mongoose.Types.ObjectId(String(params.businessId));

    const dateQuery: Record<string, any> = {
      businessId: bId,
      deliverymanId: dmanId,
    };

    if (params.tripDate) {
      const d = new Date(params.tripDate);
      const startOfDay = new Date(d.setHours(0, 0, 0, 0));
      const endOfDay = new Date(d.setHours(23, 59, 59, 999));
      dateQuery.tripDate = { $gte: startOfDay, $lte: endOfDay };
    }

    const dispatches = await Dispatch.find(dateQuery).lean();

    let totalLoaded = 0;
    let totalDelivered = 0;
    let totalReturned = 0;
    let totalDamaged = 0;
    let totalUndelivered = 0;
    let totalCashCollected = 0;
    let totalCashDeposited = 0;

    for (const d of dispatches) {
      for (const it of d.items) {
        totalLoaded += it.loadedQuantity || 0;
        totalDelivered += it.deliveredQuantity || 0;
        totalReturned += it.returnedQuantity || 0;
        totalDamaged += it.damagedQuantity || 0;
        totalUndelivered += it.undeliveredQuantity || 0;
      }
      if (d.reconciliation) {
        totalCashDeposited += d.reconciliation.cashDeposited || 0;
      }
      for (const o of d.orders) {
        totalCashCollected += o.cashCollected || 0;
      }
    }

    const cashDifference = totalCashDeposited - totalCashCollected;
    const stockVariance = totalLoaded - (totalDelivered + totalReturned + totalDamaged + totalUndelivered);

    return {
      deliverymanId: String(dmanId),
      tripCount: dispatches.length,
      openingLoadedQuantity: totalLoaded,
      deliveredQuantity: totalDelivered,
      retailerReturnsQuantity: totalReturned,
      damagedQuantity: totalDamaged,
      undeliveredQuantity: totalUndelivered,
      closingStockQuantity: totalUndelivered,
      stockVariance,
      isStockBalanced: stockVariance === 0,
      totalCashCollected,
      totalCashDeposited,
      cashDifference,
    };
  }

  /**
   * Fast lean lookup for dispatch details with tenancy and cross-dealership guard
   */
  static async getDispatchDetails(
    dispatchId: string | mongoose.Types.ObjectId,
    userContext?: { role?: string; permissions?: string[]; dealershipId?: string | mongoose.Types.ObjectId; userId?: string }
  ): Promise<IDispatch | null> {
    const dispId = new mongoose.Types.ObjectId(String(dispatchId));
    const dispatch = await Dispatch.findById(dispId)
      .populate("warehouseId", "name code")
      .populate("vehicleId", "registrationNumber vehicleType modelName")
      .populate("deliverymanId", "name phone email")
      .populate("dealershipIds", "name code")
      .lean();

    if (!dispatch) return null;

    // Delivery staff isolation: can only view assigned dispatches
    if (userContext?.role === "delivery_staff" && userContext.userId) {
      if (String(dispatch.deliverymanId?._id || dispatch.deliverymanId) !== String(userContext.userId)) {
        throw new Error("Access denied: You are not assigned to this dispatch trip");
      }
    }

    // Cross-dealership check: If non-admin user is restricted to a dealership,
    // verify the dispatch contains orders for their dealership.
    if (userContext?.dealershipId && userContext.role !== "owner" && userContext.role !== "admin" && userContext.role !== "super_admin") {
      const userDId = String(userContext.dealershipId);
      const hasDealership = dispatch.dealershipIds.some(
        (d: any) => String(d._id || d) === userDId
      );
      if (!hasDealership) {
        throw new Error("Cross-dealership dispatch access denied");
      }
    }

    return dispatch as any;
  }

  /**
   * Paginated dispatches listing
   */
  static async listDispatches(params: {
    businessId: string | mongoose.Types.ObjectId;
    dealershipId?: string | mongoose.Types.ObjectId;
    status?: string;
    deliverymanId?: string;
    vehicleId?: string;
    page?: number;
    limit?: number;
  }) {
    const bId = new mongoose.Types.ObjectId(String(params.businessId));
    const query: Record<string, any> = { businessId: bId };

    if (params.dealershipId) {
      query.dealershipIds = new mongoose.Types.ObjectId(String(params.dealershipId));
    }
    if (params.status) {
      query.status = params.status;
    }
    if (params.deliverymanId) {
      query.deliverymanId = new mongoose.Types.ObjectId(String(params.deliverymanId));
    }
    if (params.vehicleId) {
      query.vehicleId = new mongoose.Types.ObjectId(String(params.vehicleId));
    }

    const page = Math.max(1, Number(params.page || 1));
    const limit = Math.min(100, Math.max(1, Number(params.limit || 20)));
    const skip = (page - 1) * limit;

    const [dispatches, total] = await Promise.all([
      Dispatch.find(query)
        .populate("warehouseId", "name code")
        .populate("deliverymanId", "name phone")
        .populate("vehicleId", "registrationNumber")
        .sort({ tripDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Dispatch.countDocuments(query),
    ]);

    return {
      dispatches,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }
}
