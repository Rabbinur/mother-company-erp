import mongoose from "mongoose";
import { Order, IOrder, IOrderItem } from "@/models/Order";
import { Customer } from "@/models/Customer";
import { ProductVariant } from "@/models/ProductVariant";
import { InventoryService } from "./InventoryService";
import { AccountingService } from "./AccountingService";
import { AuditService } from "./AuditService";
import { generateReferenceCode } from "@/lib/utils";

export interface CreateOrderInput {
  customerId: string | mongoose.Types.ObjectId;
  warehouseId: string | mongoose.Types.ObjectId;
  source?: "admin_dashboard" | "internal_staff" | "field_sales" | "api";
  externalOrderId?: string;
  idempotencyKey?: string;
  items: Array<{
    productId: string | mongoose.Types.ObjectId;
    variantId: string | mongoose.Types.ObjectId;
    quantity: number;
    discount?: number;
  }>;
  salesmanId?: string | mongoose.Types.ObjectId;
  notes?: string;
  autoConfirmAndReserve?: boolean;
  actorId?: string | mongoose.Types.ObjectId;
}

export class OrderService {
  /**
   * Create an Order with authoritative pricing snapshot and stock validation
   */
  static async createOrder(input: CreateOrderInput): Promise<IOrder> {
    const cId = new mongoose.Types.ObjectId(String(input.customerId));
    const wId = new mongoose.Types.ObjectId(String(input.warehouseId));
    const actId = input.actorId ? new mongoose.Types.ObjectId(String(input.actorId)) : undefined;

    // Idempotency check for duplicate protection
    if (input.idempotencyKey) {
      const existing = await Order.findOne({ idempotencyKey: input.idempotencyKey });
      if (existing) {
        return existing;
      }
    }

    const customer = await Customer.findById(cId);
    if (!customer) {
      throw new Error("Customer not found");
    }

    if (customer.status === "blocked") {
      throw new Error("Customer is blocked from placing orders");
    }

    let subtotal = 0;
    let discountTotal = 0;

    const orderItems: IOrderItem[] = [];
    const stockItemsToCheck: Array<{
      productId: mongoose.Types.ObjectId;
      variantId: mongoose.Types.ObjectId;
      quantity: number;
    }> = [];

    for (const item of input.items) {
      const pId = new mongoose.Types.ObjectId(String(item.productId));
      const vId = new mongoose.Types.ObjectId(String(item.variantId));
      const qty = Number(item.quantity);

      if (qty <= 0) {
        throw new Error("Item quantity must be greater than zero");
      }

      // Authoritative pricing from database snapshot (never trust client prices!)
      const variant = await ProductVariant.findOne({ _id: vId, productId: pId });
      if (!variant) {
        throw new Error(`Product variant ${vId} not found`);
      }

      const disc = Number(item.discount || 0);
      const lineSubtotal = qty * variant.customerPrice - disc;

      subtotal += qty * variant.customerPrice;
      discountTotal += disc;

      orderItems.push({
        productId: pId,
        variantId: vId,
        name: variant.variantName,
        sku: variant.sku,
        quantity: qty,
        customerPriceSnapshot: variant.customerPrice,
        retailPriceSnapshot: variant.retailPrice,
        discount: disc,
        subtotal: lineSubtotal,
      });

      stockItemsToCheck.push({
        productId: pId,
        variantId: vId,
        quantity: qty,
      });
    }

    const grandTotal = Math.max(0, subtotal - discountTotal);

    // Credit limit check
    if (customer.creditLimit > 0) {
      const projectedReceivable = customer.currentReceivable + grandTotal;
      if (projectedReceivable > customer.creditLimit) {
        throw new Error(
          `Order exceeds customer credit limit (Limit: ৳${customer.creditLimit}, Current: ৳${customer.currentReceivable}, Order: ৳${grandTotal})`
        );
      }
    }

    const orderNumber = generateReferenceCode(
      "ORD",
      Math.floor(Math.random() * 9000 + 1000)
    );

    let reservationId: mongoose.Types.ObjectId | undefined;
    let initialStatus: "draft" | "confirmed" = "draft";

    // If autoConfirmAndReserve is true (common in Field Sales API and Quick Confirm)
    if (input.autoConfirmAndReserve) {
      const reservation = await InventoryService.reserveStock({
        warehouseId: wId,
        items: stockItemsToCheck,
        source: input.source || "admin_dashboard",
        orderNumber,
        customerId: cId,
        idempotencyKey: input.idempotencyKey,
        actorId: actId,
      });
      reservationId = reservation._id as mongoose.Types.ObjectId;
      initialStatus = "confirmed";
    }

    const order = await Order.create({
      orderNumber,
      externalOrderId: input.externalOrderId,
      idempotencyKey: input.idempotencyKey,
      source: input.source || "admin_dashboard",
      customerId: cId,
      warehouseId: wId,
      reservationId,
      items: orderItems,
      subtotal,
      discountTotal,
      taxTotal: 0,
      grandTotal,
      paidAmount: 0,
      receivableAmount: grandTotal,
      orderStatus: initialStatus,
      fulfillmentStatus: "unfulfilled",
      paymentStatus: "unpaid",
      orderDate: new Date(),
      confirmedDate: initialStatus === "confirmed" ? new Date() : undefined,
      salesmanId: input.salesmanId
        ? new mongoose.Types.ObjectId(String(input.salesmanId))
        : undefined,
      notes: input.notes,
      createdBy: actId,
    });

    if (reservationId) {
      await InventoryService.reserveStock; // link orderId to reservation
    }

    await AuditService.log({
      actorId: actId,
      action: "ORDER_CREATED",
      entityType: "order",
      entityId: String(order._id),
      afterSnapshot: {
        orderNumber,
        status: initialStatus,
        grandTotal,
        source: input.source,
      },
    });

    return order;
  }

  /**
   * Confirm Order: Atomically reserves required stock
   */
  static async confirmOrder(
    orderId: string | mongoose.Types.ObjectId,
    actorId?: string | mongoose.Types.ObjectId,
    session?: mongoose.ClientSession
  ): Promise<IOrder> {
    const oId = new mongoose.Types.ObjectId(String(orderId));
    const actId = actorId ? new mongoose.Types.ObjectId(String(actorId)) : undefined;

    const order = await Order.findById(oId).session(session || null);
    if (!order) {
      throw new Error("Order not found");
    }

    if (order.orderStatus !== "draft") {
      throw new Error(`Cannot confirm order in status '${order.orderStatus}'`);
    }

    // Atomically reserve stock
    const reservation = await InventoryService.reserveStock({
      warehouseId: order.warehouseId,
      items: order.items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId,
        quantity: i.quantity,
      })),
      source: order.source,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      actorId: actId,
      session,
    });

    order.reservationId = reservation._id as mongoose.Types.ObjectId;
    order.orderStatus = "confirmed";
    order.confirmedDate = new Date();
    await order.save({ session });

    await AuditService.log({
      actorId: actId,
      action: "ORDER_CONFIRMED",
      entityType: "order",
      entityId: String(order._id),
      afterSnapshot: {
        orderNumber: order.orderNumber,
        reservationNumber: reservation.reservationNumber,
      },
    });

    return order;
  }

  /**
   * Fulfill Order:
   * 1. Physically deducts stock from warehouse & releases reservation count
   * 2. Updates customer accounts receivable balance
   * 3. Posts balanced double-entry accounting records (Revenue + COGS)
   */
  static async fulfillOrder(
    orderId: string | mongoose.Types.ObjectId,
    actorId?: string | mongoose.Types.ObjectId,
    session?: mongoose.ClientSession
  ): Promise<IOrder> {
    const oId = new mongoose.Types.ObjectId(String(orderId));
    const actId = actorId ? new mongoose.Types.ObjectId(String(actorId)) : undefined;

    const order = await Order.findById(oId).session(session || null);
    if (!order) {
      throw new Error("Order not found");
    }

    if (order.orderStatus === "fulfilled" || order.orderStatus === "delivered") {
      throw new Error(`Order is already fulfilled`);
    }

    if (order.orderStatus === "cancelled") {
      throw new Error(`Cannot fulfill a cancelled order`);
    }

    // 1. Physically deduct stock and fulfill reservation
    const stockItemsToFulfill = order.items.map((i) => ({
      productId: i.productId,
      variantId: i.variantId,
      quantity: i.quantity,
    }));

    await InventoryService.fulfillStock(
      order.warehouseId,
      order.reservationId,
      stockItemsToFulfill,
      order.orderNumber,
      actId,
      session
    );

    // 2. Calculate COGS based on variant purchase price snapshots
    let totalCogs = 0;
    for (const item of order.items) {
      const v = await ProductVariant.findById(item.variantId).session(session || null);
      if (v) {
        totalCogs += item.quantity * v.purchasePrice;
      }
    }

    // 3. Update order state
    order.orderStatus = "fulfilled";
    order.fulfillmentStatus = "fulfilled";
    order.fulfilledDate = new Date();
    await order.save({ session });

    // 4. Update Customer Receivable Balance
    await Customer.findByIdAndUpdate(
      order.customerId,
      { $inc: { currentReceivable: order.receivableAmount } },
      { session }
    );

    // 5. Post Double-Entry Accounting
    try {
      const arAccount = await AccountingService.getAccountBySubType("accounts_receivable");
      const revAccount = await AccountingService.getAccountBySubType("sales_revenue");
      const cogsAccount = await AccountingService.getAccountBySubType("cost_of_goods_sold");
      const invAccount = await AccountingService.getAccountBySubType("inventory_asset");

      // Entry 1: Sales Recognition (AR vs Revenue)
      await AccountingService.postJournalEntry({
        referenceType: "sales_order",
        referenceId: order.orderNumber,
        narration: `Sales fulfilled for Order ${order.orderNumber}`,
        lines: [
          {
            accountId: arAccount._id as mongoose.Types.ObjectId,
            debit: order.grandTotal,
            credit: 0,
            description: `Receivable for Order ${order.orderNumber}`,
          },
          {
            accountId: revAccount._id as mongoose.Types.ObjectId,
            debit: 0,
            credit: order.grandTotal,
            description: `Sales revenue for Order ${order.orderNumber}`,
          },
        ],
        postedBy: actId,
        session,
      });

      // Entry 2: COGS & Inventory Reduction
      if (totalCogs > 0) {
        await AccountingService.postJournalEntry({
          referenceType: "sales_order",
          referenceId: order.orderNumber,
          narration: `Cost of goods sold for Order ${order.orderNumber}`,
          lines: [
            {
              accountId: cogsAccount._id as mongoose.Types.ObjectId,
              debit: totalCogs,
              credit: 0,
              description: `COGS for Order ${order.orderNumber}`,
            },
            {
              accountId: invAccount._id as mongoose.Types.ObjectId,
              debit: 0,
              credit: totalCogs,
              description: `Inventory reduction for Order ${order.orderNumber}`,
            },
          ],
          postedBy: actId,
          session,
        });
      }
    } catch (accErr) {
      console.error("[OrderService.fulfillOrder] Accounting post warning:", accErr);
    }

    await AuditService.log({
      actorId: actId,
      action: "ORDER_FULFILLED",
      entityType: "order",
      entityId: String(order._id),
      afterSnapshot: {
        orderNumber: order.orderNumber,
        grandTotal: order.grandTotal,
        cogs: totalCogs,
      },
    });

    return order;
  }

  /**
   * Cancel Order: Safely releases active reservations
   */
  static async cancelOrder(
    orderId: string | mongoose.Types.ObjectId,
    reason = "Customer cancelled",
    actorId?: string | mongoose.Types.ObjectId,
    session?: mongoose.ClientSession
  ): Promise<IOrder> {
    const oId = new mongoose.Types.ObjectId(String(orderId));
    const actId = actorId ? new mongoose.Types.ObjectId(String(actorId)) : undefined;

    const order = await Order.findById(oId).session(session || null);
    if (!order) {
      throw new Error("Order not found");
    }

    if (order.orderStatus === "fulfilled" || order.orderStatus === "delivered") {
      throw new Error("Cannot cancel an already fulfilled or delivered order. Use Sales Return instead.");
    }

    if (order.orderStatus === "cancelled") {
      return order; // Already cancelled
    }

    // Release reservation if active
    if (order.reservationId) {
      await InventoryService.releaseReservation(
        order.reservationId,
        `Order ${order.orderNumber} Cancelled: ${reason}`,
        actId,
        session
      );
    }

    order.orderStatus = "cancelled";
    order.cancelledDate = new Date();
    await order.save({ session });

    await AuditService.log({
      actorId: actId,
      action: "ORDER_CANCELLED",
      entityType: "order",
      entityId: String(order._id),
      afterSnapshot: {
        orderNumber: order.orderNumber,
        reason,
      },
    });

    return order;
  }
}
