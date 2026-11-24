import mongoose from "mongoose";
import { InventoryBalance, type IInventoryBalance } from "@/models/InventoryBalance";
import { StockMovement, type StockMovementType } from "@/models/StockMovement";
import { StockReservation, type IStockReservation } from "@/models/StockReservation";
import { Warehouse } from "@/models/Warehouse";
import { InventoryCostingService, type PurchaseCostInput } from "./InventoryCostingService";
import { generateReferenceCode } from "@/lib/utils";

export interface StockItemInput {
  productId: string | mongoose.Types.ObjectId;
  variantId: string | mongoose.Types.ObjectId;
  quantity: number;
  unitCost?: number;
  batchNumber?: string;
  grossPurchasePrice?: number;
  lineDiscount?: number;
  allocatedFreight?: number;
  allocatedHandling?: number;
  supplierSchemeFreeQuantity?: number;
  manualFreeQuantity?: number;
  expiryDate?: Date | null;
}

export interface ReceiveStockParams {
  businessId?: string | mongoose.Types.ObjectId;
  dealershipId?: string | mongoose.Types.ObjectId;
  warehouseId: string | mongoose.Types.ObjectId;
  items: StockItemInput[];
  referenceId: string;
  referenceType?: string;
  supplierId?: string | mongoose.Types.ObjectId | null;
  principalCompanyId?: string | mongoose.Types.ObjectId | null;
  purchaseInvoiceRef?: string;
  challanNumber?: string;
  actorId?: string | mongoose.Types.ObjectId;
  session?: mongoose.ClientSession;
}

export interface ReserveStockParams {
  businessId?: string | mongoose.Types.ObjectId;
  dealershipId?: string | mongoose.Types.ObjectId;
  warehouseId: string | mongoose.Types.ObjectId;
  items: StockItemInput[];
  source?: "admin_dashboard" | "internal_staff" | "field_sales" | "api";
  orderNumber?: string;
  customerId?: string | mongoose.Types.ObjectId;
  idempotencyKey?: string;
  expiresInMinutes?: number;
  actorId?: string | mongoose.Types.ObjectId;
  session?: mongoose.ClientSession;
}

export interface FulfillStockParams {
  businessId?: string | mongoose.Types.ObjectId;
  dealershipId?: string | mongoose.Types.ObjectId;
  warehouseId: string | mongoose.Types.ObjectId;
  reservationId?: string | mongoose.Types.ObjectId;
  items: StockItemInput[];
  orderNumber: string;
  actorId?: string | mongoose.Types.ObjectId;
  session?: mongoose.ClientSession;
}

export interface AdjustStockParams {
  businessId?: string | mongoose.Types.ObjectId;
  dealershipId?: string | mongoose.Types.ObjectId;
  warehouseId: string | mongoose.Types.ObjectId;
  productId: string | mongoose.Types.ObjectId;
  variantId: string | mongoose.Types.ObjectId;
  adjustmentQty: number;
  reason: string;
  actorId?: string | mongoose.Types.ObjectId;
  session?: mongoose.ClientSession;
}

export interface RecordDamageParams {
  businessId?: string | mongoose.Types.ObjectId;
  dealershipId?: string | mongoose.Types.ObjectId;
  warehouseId: string | mongoose.Types.ObjectId;
  productId: string | mongoose.Types.ObjectId;
  variantId: string | mongoose.Types.ObjectId;
  damagedQty: number;
  reason: string;
  actorId?: string | mongoose.Types.ObjectId;
  session?: mongoose.ClientSession;
}

export class InventoryService {
  /**
   * Helper to ensure a dealership-scoped InventoryBalance record exists
   */
  static async getOrCreateBalance(
    businessId: string | mongoose.Types.ObjectId | undefined,
    dealershipId: string | mongoose.Types.ObjectId | null | undefined,
    warehouseId: string | mongoose.Types.ObjectId,
    productId: string | mongoose.Types.ObjectId,
    variantId: string | mongoose.Types.ObjectId,
    session?: mongoose.ClientSession
  ): Promise<IInventoryBalance> {
    const bId = businessId ? new mongoose.Types.ObjectId(String(businessId)) : undefined;
    const dId = dealershipId ? new mongoose.Types.ObjectId(String(dealershipId)) : null;
    const wId = new mongoose.Types.ObjectId(String(warehouseId));
    const pId = new mongoose.Types.ObjectId(String(productId));
    const vId = new mongoose.Types.ObjectId(String(variantId));

    const query: Record<string, unknown> = {
      warehouseId: wId,
      productId: pId,
      variantId: vId,
    };
    if (bId) query.businessId = bId;
    if (dId !== undefined) query.dealershipId = dId;

    let balance = await InventoryBalance.findOne(query).session(session || null);

    if (!balance) {
      const created = await InventoryBalance.create(
        [
          {
            businessId: bId || new mongoose.Types.ObjectId(),
            dealershipId: dId,
            warehouseId: wId,
            productId: pId,
            variantId: vId,
            onHandQuantity: 0,
            reservedQuantity: 0,
            availableQuantity: 0,
            damagedQuantity: 0,
            stockInTransit: 0,
            lastUpdated: new Date(),
          },
        ],
        session ? { session } : {}
      );
      balance = created[0];
    }
    return balance;
  }

  /**
   * Overloaded receiveStock: supports both single parameter object and legacy positional args
   */
  static async receiveStock(
    params: ReceiveStockParams
  ): Promise<void>;
  static async receiveStock(
    warehouseId: string | mongoose.Types.ObjectId,
    items: StockItemInput[],
    referenceId: string,
    referenceType?: string,
    actorId?: string | mongoose.Types.ObjectId,
    session?: mongoose.ClientSession
  ): Promise<void>;
  static async receiveStock(
    paramsOrWarehouseId: ReceiveStockParams | string | mongoose.Types.ObjectId,
    legacyItems?: StockItemInput[],
    legacyReferenceId?: string,
    legacyReferenceType?: string,
    legacyActorId?: string | mongoose.Types.ObjectId,
    legacySession?: mongoose.ClientSession
  ): Promise<void> {
    let params: ReceiveStockParams;

    if (typeof paramsOrWarehouseId === "object" && !("toHexString" in paramsOrWarehouseId)) {
      params = paramsOrWarehouseId as ReceiveStockParams;
    } else {
      params = {
        warehouseId: paramsOrWarehouseId as string | mongoose.Types.ObjectId,
        items: legacyItems || [],
        referenceId: legacyReferenceId || "RECEIPT",
        referenceType: legacyReferenceType,
        actorId: legacyActorId,
        session: legacySession,
      };
    }

    const wId = new mongoose.Types.ObjectId(String(params.warehouseId));
    const actId = params.actorId ? new mongoose.Types.ObjectId(String(params.actorId)) : undefined;
    const bId = params.businessId ? new mongoose.Types.ObjectId(String(params.businessId)) : new mongoose.Types.ObjectId();
    const dId = params.dealershipId ? new mongoose.Types.ObjectId(String(params.dealershipId)) : new mongoose.Types.ObjectId();

    for (const item of params.items) {
      const pId = new mongoose.Types.ObjectId(String(item.productId));
      const vId = new mongoose.Types.ObjectId(String(item.variantId));
      const qty = Number(item.quantity);

      if (qty <= 0) continue;

      // 1. Record Batch & Landed Cost Snapshot
      const batchDoc = await InventoryCostingService.recordPurchaseBatch(
        {
          businessId: bId,
          dealershipId: dId,
          warehouseId: wId,
          productId: pId,
          variantId: vId,
          supplierId: params.supplierId,
          principalCompanyId: params.principalCompanyId,
          batchNumber: item.batchNumber,
          purchaseInvoiceRef: params.purchaseInvoiceRef || params.referenceId,
          challanNumber: params.challanNumber,
          receiptDate: new Date(),
          expiryDate: item.expiryDate,
          purchasedQuantity: qty,
          supplierSchemeFreeQuantity: item.supplierSchemeFreeQuantity,
          manualFreeQuantity: item.manualFreeQuantity,
          grossPurchasePrice: item.grossPurchasePrice ?? (item.unitCost ? item.unitCost * qty : 0),
          lineDiscount: item.lineDiscount,
          allocatedFreight: item.allocatedFreight,
          allocatedHandling: item.allocatedHandling,
        },
        params.session
      );

      const totalUnitsReceived = batchDoc.totalReceivedQuantity;

      // 2. Update Inventory Balance
      const balance = await this.getOrCreateBalance(bId, dId, wId, pId, vId, params.session);
      const prevOnHand = balance.onHandQuantity;
      const prevReserved = balance.reservedQuantity;
      const newOnHand = prevOnHand + totalUnitsReceived;
      const newAvailable = newOnHand - prevReserved;

      balance.onHandQuantity = newOnHand;
      balance.availableQuantity = newAvailable;
      balance.lastUpdated = new Date();
      await balance.save({ session: params.session });

      // 3. Record Immutable Stock Movement Ledger
      const movementCode = generateReferenceCode("STK-REC", Math.floor(Math.random() * 9000 + 1000));
      await StockMovement.create(
        [
          {
            movementNumber: movementCode,
            type: "purchase_receive",
            businessId: bId,
            dealershipId: dId,
            productId: pId,
            variantId: vId,
            warehouseId: wId,
            batchId: batchDoc._id as mongoose.Types.ObjectId,
            batchNumber: batchDoc.batchNumber,
            quantity: totalUnitsReceived,
            unitCost: batchDoc.netLandedUnitCost,
            totalCost: Math.round(totalUnitsReceived * batchDoc.netLandedUnitCost * 100) / 100,
            previousOnHand: prevOnHand,
            newOnHand,
            previousReserved: prevReserved,
            newReserved: prevReserved,
            referenceType: params.referenceType || "purchase_receive",
            referenceId: params.referenceId,
            notes: `Received ${totalUnitsReceived} units at landed unit cost ৳${batchDoc.netLandedUnitCost}`,
            createdBy: actId,
          },
        ],
        params.session ? { session: params.session } : {}
      );
    }
  }

  /**
   * Concurrency-safe, atomic multi-line stock reservation
   */
  static async reserveStock(params: ReserveStockParams): Promise<IStockReservation> {
    const wId = new mongoose.Types.ObjectId(String(params.warehouseId));
    const actId = params.actorId ? new mongoose.Types.ObjectId(String(params.actorId)) : undefined;
    const custId = params.customerId ? new mongoose.Types.ObjectId(String(params.customerId)) : undefined;
    const bId = params.businessId ? new mongoose.Types.ObjectId(String(params.businessId)) : undefined;
    const dId = params.dealershipId ? new mongoose.Types.ObjectId(String(params.dealershipId)) : undefined;

    // Idempotency: replay existing reservation if matching key found
    if (params.idempotencyKey) {
      const existing = await StockReservation.findOne({
        idempotencyKey: params.idempotencyKey,
      }).session(params.session || null);
      if (existing) {
        return existing;
      }
    }

    // Pre-flight check
    for (const item of params.items) {
      const pId = new mongoose.Types.ObjectId(String(item.productId));
      const vId = new mongoose.Types.ObjectId(String(item.variantId));
      const qty = Number(item.quantity);

      const bal = await this.getOrCreateBalance(bId, dId, wId, pId, vId, params.session);
      const available = bal.onHandQuantity - bal.reservedQuantity;
      if (available < qty) {
        throw new Error(
          `Insufficient available stock for variant ${vId}. Available: ${available}, Requested: ${qty}`
        );
      }
    }

    const rollbackList: Array<{ productId: mongoose.Types.ObjectId; variantId: mongoose.Types.ObjectId; quantity: number }> = [];
    const reservedItemsRecord: Array<{ productId: mongoose.Types.ObjectId; variantId: mongoose.Types.ObjectId; quantity: number }> = [];

    try {
      for (const item of params.items) {
        const pId = new mongoose.Types.ObjectId(String(item.productId));
        const vId = new mongoose.Types.ObjectId(String(item.variantId));
        const qty = Number(item.quantity);

        const query: Record<string, unknown> = {
          warehouseId: wId,
          productId: pId,
          variantId: vId,
          $expr: {
            $gte: [
              { $subtract: ["$onHandQuantity", "$reservedQuantity"] },
              qty,
            ],
          },
        };
        if (bId) query.businessId = bId;
        if (dId) query.dealershipId = dId;

        const updated = await InventoryBalance.findOneAndUpdate(
          query,
          {
            $inc: { reservedQuantity: qty },
            $set: { lastUpdated: new Date() },
          },
          { new: true, session: params.session || null }
        );

        if (!updated) {
          throw new Error(
            `Atomic reservation failed: concurrent order reserved remaining stock for variant ${vId}`
          );
        }

        updated.availableQuantity = updated.onHandQuantity - updated.reservedQuantity;
        await updated.save({ session: params.session });

        rollbackList.push({ productId: pId, variantId: vId, quantity: qty });
        reservedItemsRecord.push({ productId: pId, variantId: vId, quantity: qty });

        // Record stock movement
        const moveCode = generateReferenceCode("STK-RES", Math.floor(Math.random() * 9000 + 1000));
        await StockMovement.create(
          [
            {
              movementNumber: moveCode,
              type: "reservation",
              businessId: bId,
              dealershipId: dId,
              productId: pId,
              variantId: vId,
              warehouseId: wId,
              quantity: qty,
              previousOnHand: updated.onHandQuantity,
              newOnHand: updated.onHandQuantity,
              previousReserved: updated.reservedQuantity - qty,
              newReserved: updated.reservedQuantity,
              referenceType: "order_reservation",
              referenceId: params.orderNumber || "RESERVATION",
              notes: `Reserved ${qty} units for order ${params.orderNumber || ""}`,
              createdBy: actId,
            },
          ],
          params.session ? { session: params.session } : {}
        );
      }
    } catch (err) {
      if (!params.session) {
        for (const rb of rollbackList) {
          const rbQuery: Record<string, unknown> = { warehouseId: wId, productId: rb.productId, variantId: rb.variantId };
          if (bId) rbQuery.businessId = bId;
          if (dId) rbQuery.dealershipId = dId;

          await InventoryBalance.findOneAndUpdate(
            rbQuery,
            { $inc: { reservedQuantity: -rb.quantity }, $set: { lastUpdated: new Date() } }
          );
        }
      }
      throw err;
    }

    const reservationNumber = generateReferenceCode("RES", Math.floor(Math.random() * 9000 + 1000));
    const expiresAt = params.expiresInMinutes
      ? new Date(Date.now() + params.expiresInMinutes * 60 * 1000)
      : undefined;

    const reservation = await StockReservation.create(
      [
        {
          reservationNumber,
          businessId: bId,
          dealershipId: dId,
          idempotencyKey: params.idempotencyKey,
          source: params.source || "admin_dashboard",
          orderNumber: params.orderNumber,
          customerId: custId,
          warehouseId: wId,
          items: reservedItemsRecord,
          status: "active",
          expiresAt,
          createdBy: actId,
        },
      ],
      params.session ? { session: params.session } : {}
    );

    return reservation[0];
  }

  /**
   * Release reservation: Restores available stock without altering onHandQuantity
   */
  static async releaseReservation(
    reservationId: string | mongoose.Types.ObjectId,
    reason = "Order Cancelled",
    actorId?: string | mongoose.Types.ObjectId,
    session?: mongoose.ClientSession
  ): Promise<void> {
    const resId = new mongoose.Types.ObjectId(String(reservationId));
    const actId = actorId ? new mongoose.Types.ObjectId(String(actorId)) : undefined;

    const reservation = await StockReservation.findById(resId).session(session || null);
    if (!reservation || reservation.status !== "active") {
      return;
    }

    for (const item of reservation.items) {
      const balance = await this.getOrCreateBalance(
        reservation.businessId,
        reservation.dealershipId,
        reservation.warehouseId,
        item.productId,
        item.variantId,
        session
      );

      const prevOnHand = balance.onHandQuantity;
      const prevReserved = balance.reservedQuantity;
      const newReserved = Math.max(0, prevReserved - item.quantity);

      balance.reservedQuantity = newReserved;
      balance.availableQuantity = prevOnHand - newReserved;
      balance.lastUpdated = new Date();
      await balance.save({ session });

      const moveCode = generateReferenceCode("STK-REL", Math.floor(Math.random() * 9000 + 1000));
      await StockMovement.create(
        [
          {
            movementNumber: moveCode,
            type: "reservation_release",
            businessId: reservation.businessId,
            dealershipId: reservation.dealershipId,
            productId: item.productId,
            variantId: item.variantId,
            warehouseId: reservation.warehouseId,
            quantity: item.quantity,
            previousOnHand: prevOnHand,
            newOnHand: prevOnHand,
            previousReserved: prevReserved,
            newReserved,
            referenceType: "reservation_release",
            referenceId: reservation.reservationNumber,
            notes: `Released reservation ${reservation.reservationNumber}: ${reason}`,
            createdBy: actId,
          },
        ],
        session ? { session } : {}
      );
    }

    reservation.status = "released";
    reservation.releasedAt = new Date();
    await reservation.save({ session });
  }

  /**
   * Overloaded fulfillStock: supports parameter object and legacy positional args
   */
  static async fulfillStock(
    params: FulfillStockParams
  ): Promise<{ totalCogs: number }>;
  static async fulfillStock(
    warehouseId: string | mongoose.Types.ObjectId,
    reservationId: string | mongoose.Types.ObjectId | undefined,
    items: StockItemInput[],
    orderNumber: string,
    actorId?: string | mongoose.Types.ObjectId,
    session?: mongoose.ClientSession
  ): Promise<{ totalCogs: number }>;
  static async fulfillStock(
    paramsOrWarehouseId: FulfillStockParams | string | mongoose.Types.ObjectId,
    legacyReservationId?: string | mongoose.Types.ObjectId,
    legacyItems?: StockItemInput[],
    legacyOrderNumber?: string,
    legacyActorId?: string | mongoose.Types.ObjectId,
    legacySession?: mongoose.ClientSession
  ): Promise<{ totalCogs: number }> {
    let params: FulfillStockParams;

    if (typeof paramsOrWarehouseId === "object" && !("toHexString" in paramsOrWarehouseId)) {
      params = paramsOrWarehouseId as FulfillStockParams;
    } else {
      params = {
        warehouseId: paramsOrWarehouseId as string | mongoose.Types.ObjectId,
        reservationId: legacyReservationId,
        items: legacyItems || [],
        orderNumber: legacyOrderNumber || "ORDER",
        actorId: legacyActorId,
        session: legacySession,
      };
    }

    const wId = new mongoose.Types.ObjectId(String(params.warehouseId));
    const actId = params.actorId ? new mongoose.Types.ObjectId(String(params.actorId)) : undefined;
    const bId = params.businessId ? new mongoose.Types.ObjectId(String(params.businessId)) : undefined;
    const dId = params.dealershipId ? new mongoose.Types.ObjectId(String(params.dealershipId)) : new mongoose.Types.ObjectId();

    let totalCogs = 0;

    for (const item of params.items) {
      const pId = new mongoose.Types.ObjectId(String(item.productId));
      const vId = new mongoose.Types.ObjectId(String(item.variantId));
      const qty = Number(item.quantity);

      // 1. Deplete FIFO cost layer
      const depletion = await InventoryCostingService.depleteFifoStock({
        dealershipId: dId,
        productId: pId,
        variantId: vId,
        quantity: qty,
        session: params.session,
      });

      totalCogs += depletion.totalCost;

      // 2. Reduce OnHand & Reserved
      const balance = await this.getOrCreateBalance(bId, dId, wId, pId, vId, params.session);
      const prevOnHand = balance.onHandQuantity;
      const prevReserved = balance.reservedQuantity;
      const newOnHand = Math.max(0, prevOnHand - qty);
      const newReserved = Math.max(0, prevReserved - qty);

      balance.onHandQuantity = newOnHand;
      balance.reservedQuantity = newReserved;
      balance.availableQuantity = newOnHand - newReserved;
      balance.lastUpdated = new Date();
      await balance.save({ session: params.session });

      // 3. Record Movement
      const moveCode = generateReferenceCode("STK-FUL", Math.floor(Math.random() * 9000 + 1000));
      await StockMovement.create(
        [
          {
            movementNumber: moveCode,
            type: "sales_fulfillment",
            businessId: bId,
            dealershipId: dId,
            productId: pId,
            variantId: vId,
            warehouseId: wId,
            quantity: -qty,
            unitCost: depletion.weightedUnitCost,
            totalCost: depletion.totalCost,
            previousOnHand: prevOnHand,
            newOnHand,
            previousReserved: prevReserved,
            newReserved,
            referenceType: "sales_order",
            referenceId: params.orderNumber,
            notes: `Fulfillment for Order ${params.orderNumber}. COGS: ৳${depletion.totalCost}`,
            createdBy: actId,
          },
        ],
        params.session ? { session: params.session } : {}
      );
    }

    if (params.reservationId) {
      const res = await StockReservation.findById(params.reservationId).session(params.session || null);
      if (res && res.status === "active") {
        res.status = "fulfilled";
        res.fulfilledAt = new Date();
        await res.save({ session: params.session });
      }
    }

    return { totalCogs: Math.round(totalCogs * 100) / 100 };
  }

  /**
   * Manual Stock Adjustment
   */
  static async adjustStock(params: AdjustStockParams): Promise<IInventoryBalance> {
    const bId = params.businessId ? new mongoose.Types.ObjectId(String(params.businessId)) : undefined;
    const dId = params.dealershipId ? new mongoose.Types.ObjectId(String(params.dealershipId)) : undefined;
    const wId = new mongoose.Types.ObjectId(String(params.warehouseId));
    const pId = new mongoose.Types.ObjectId(String(params.productId));
    const vId = new mongoose.Types.ObjectId(String(params.variantId));
    const actId = params.actorId ? new mongoose.Types.ObjectId(String(params.actorId)) : undefined;

    const balance = await this.getOrCreateBalance(bId, dId, wId, pId, vId, params.session);
    const prevOnHand = balance.onHandQuantity;
    const prevReserved = balance.reservedQuantity;
    const newOnHand = Math.max(0, prevOnHand + params.adjustmentQty);
    const newAvailable = newOnHand - prevReserved;

    if (newAvailable < 0) {
      throw new Error("Adjustment would result in negative available stock");
    }

    balance.onHandQuantity = newOnHand;
    balance.availableQuantity = newAvailable;
    balance.lastUpdated = new Date();
    await balance.save({ session: params.session });

    const moveCode = generateReferenceCode("STK-ADJ", Math.floor(Math.random() * 9000 + 1000));
    await StockMovement.create(
      [
        {
          movementNumber: moveCode,
          type: "manual_adjustment",
          businessId: bId,
          dealershipId: dId,
          productId: pId,
          variantId: vId,
          warehouseId: wId,
          quantity: params.adjustmentQty,
          previousOnHand: prevOnHand,
          newOnHand,
          previousReserved: prevReserved,
          newReserved: prevReserved,
          referenceType: "manual_adjustment",
          referenceId: moveCode,
          notes: params.reason,
          createdBy: actId,
        },
      ],
      params.session ? { session: params.session } : {}
    );

    return balance;
  }

  /**
   * Record Damaged Stock
   */
  static async recordDamage(params: RecordDamageParams): Promise<IInventoryBalance> {
    const bId = params.businessId ? new mongoose.Types.ObjectId(String(params.businessId)) : undefined;
    const dId = params.dealershipId ? new mongoose.Types.ObjectId(String(params.dealershipId)) : undefined;
    const wId = new mongoose.Types.ObjectId(String(params.warehouseId));
    const pId = new mongoose.Types.ObjectId(String(params.productId));
    const vId = new mongoose.Types.ObjectId(String(params.variantId));
    const actId = params.actorId ? new mongoose.Types.ObjectId(String(params.actorId)) : undefined;

    const balance = await this.getOrCreateBalance(bId, dId, wId, pId, vId, params.session);
    if (balance.availableQuantity < params.damagedQty) {
      throw new Error("Insufficient available stock to record as damaged");
    }

    const prevOnHand = balance.onHandQuantity;
    const prevReserved = balance.reservedQuantity;
    const newOnHand = prevOnHand - params.damagedQty;

    balance.onHandQuantity = newOnHand;
    balance.availableQuantity = newOnHand - prevReserved;
    balance.damagedQuantity = (balance.damagedQuantity || 0) + params.damagedQty;
    balance.lastUpdated = new Date();
    await balance.save({ session: params.session });

    const moveCode = generateReferenceCode("STK-DMG", Math.floor(Math.random() * 9000 + 1000));
    await StockMovement.create(
      [
        {
          movementNumber: moveCode,
          type: "damage",
          businessId: bId,
          dealershipId: dId,
          productId: pId,
          variantId: vId,
          warehouseId: wId,
          quantity: -params.damagedQty,
          previousOnHand: prevOnHand,
          newOnHand,
          previousReserved: prevReserved,
          newReserved: prevReserved,
          referenceType: "damage",
          referenceId: moveCode,
          notes: params.reason,
          createdBy: actId,
        },
      ],
      params.session ? { session: params.session } : {}
    );

    return balance;
  }

  /**
   * Warehouse Transfer between two warehouses for the SAME dealership
   */
  static async transferStock(params: {
    businessId?: string | mongoose.Types.ObjectId;
    dealershipId?: string | mongoose.Types.ObjectId;
    fromWarehouseId: string | mongoose.Types.ObjectId;
    toWarehouseId: string | mongoose.Types.ObjectId;
    productId: string | mongoose.Types.ObjectId;
    variantId: string | mongoose.Types.ObjectId;
    quantity: number;
    notes?: string;
    actorId?: string | mongoose.Types.ObjectId;
    session?: mongoose.ClientSession;
  }): Promise<{ fromBalance: IInventoryBalance; toBalance: IInventoryBalance }> {
    if (String(params.fromWarehouseId) === String(params.toWarehouseId)) {
      throw new Error("Source and destination warehouses cannot be the same");
    }

    const bId = params.businessId ? new mongoose.Types.ObjectId(String(params.businessId)) : undefined;
    const dId = params.dealershipId ? new mongoose.Types.ObjectId(String(params.dealershipId)) : undefined;
    const fromWId = new mongoose.Types.ObjectId(String(params.fromWarehouseId));
    const toWId = new mongoose.Types.ObjectId(String(params.toWarehouseId));
    const pId = new mongoose.Types.ObjectId(String(params.productId));
    const vId = new mongoose.Types.ObjectId(String(params.variantId));
    const qty = Number(params.quantity);
    const actId = params.actorId ? new mongoose.Types.ObjectId(String(params.actorId)) : undefined;

    if (qty <= 0) {
      throw new Error("Transfer quantity must be greater than zero");
    }

    const fromBalance = await this.getOrCreateBalance(bId, dId, fromWId, pId, vId, params.session);
    if (fromBalance.availableQuantity < qty) {
      throw new Error(`Insufficient available stock in source warehouse. Available: ${fromBalance.availableQuantity}, Requested: ${qty}`);
    }

    const fromPrevOnHand = fromBalance.onHandQuantity;
    fromBalance.onHandQuantity -= qty;
    fromBalance.availableQuantity = fromBalance.onHandQuantity - fromBalance.reservedQuantity;
    fromBalance.lastUpdated = new Date();
    await fromBalance.save({ session: params.session });

    const toBalance = await this.getOrCreateBalance(bId, dId, toWId, pId, vId, params.session);
    const toPrevOnHand = toBalance.onHandQuantity;
    toBalance.onHandQuantity += qty;
    toBalance.availableQuantity = toBalance.onHandQuantity - toBalance.reservedQuantity;
    toBalance.lastUpdated = new Date();
    await toBalance.save({ session: params.session });

    const transferRef = generateReferenceCode("TRF", Math.floor(Math.random() * 9000 + 1000));
    await StockMovement.create(
      [
        {
          movementNumber: `${transferRef}-OUT`,
          type: "warehouse_transfer_out",
          businessId: bId,
          dealershipId: dId,
          productId: pId,
          variantId: vId,
          warehouseId: fromWId,
          quantity: -qty,
          previousOnHand: fromPrevOnHand,
          newOnHand: fromBalance.onHandQuantity,
          previousReserved: fromBalance.reservedQuantity,
          newReserved: fromBalance.reservedQuantity,
          referenceType: "warehouse_transfer",
          referenceId: transferRef,
          notes: `Transfer to warehouse ${toWId}. ${params.notes || ""}`,
          createdBy: actId,
        },
        {
          movementNumber: `${transferRef}-IN`,
          type: "warehouse_transfer_in",
          businessId: bId,
          dealershipId: dId,
          productId: pId,
          variantId: vId,
          warehouseId: toWId,
          quantity: qty,
          previousOnHand: toPrevOnHand,
          newOnHand: toBalance.onHandQuantity,
          previousReserved: toBalance.reservedQuantity,
          newReserved: toBalance.reservedQuantity,
          referenceType: "warehouse_transfer",
          referenceId: transferRef,
          notes: `Transfer from warehouse ${fromWId}. ${params.notes || ""}`,
          createdBy: actId,
        },
      ],
      params.session ? { session: params.session } : {}
    );

    return { fromBalance, toBalance };
  }

  /**
   * Reconcile physical stock count with system on-hand
   */
  static async reconcilePhysicalCount(params: {
    businessId?: string | mongoose.Types.ObjectId;
    dealershipId?: string | mongoose.Types.ObjectId;
    warehouseId: string | mongoose.Types.ObjectId;
    productId: string | mongoose.Types.ObjectId;
    variantId: string | mongoose.Types.ObjectId;
    countedQuantity: number;
    reason: string;
    actorId?: string | mongoose.Types.ObjectId;
    session?: mongoose.ClientSession;
  }): Promise<{ balance: IInventoryBalance; variance: number }> {
    const bId = params.businessId ? new mongoose.Types.ObjectId(String(params.businessId)) : undefined;
    const dId = params.dealershipId ? new mongoose.Types.ObjectId(String(params.dealershipId)) : undefined;
    const wId = new mongoose.Types.ObjectId(String(params.warehouseId));
    const pId = new mongoose.Types.ObjectId(String(params.productId));
    const vId = new mongoose.Types.ObjectId(String(params.variantId));
    const counted = Number(params.countedQuantity);
    const actId = params.actorId ? new mongoose.Types.ObjectId(String(params.actorId)) : undefined;

    if (counted < 0) {
      throw new Error("Counted quantity cannot be negative");
    }

    const balance = await this.getOrCreateBalance(bId, dId, wId, pId, vId, params.session);
    const prevOnHand = balance.onHandQuantity;
    const variance = counted - prevOnHand;

    balance.onHandQuantity = counted;
    balance.availableQuantity = counted - balance.reservedQuantity;
    balance.lastUpdated = new Date();
    await balance.save({ session: params.session });

    const moveCode = generateReferenceCode("STK-CNT", Math.floor(Math.random() * 9000 + 1000));
    await StockMovement.create(
      [
        {
          movementNumber: moveCode,
          type: "physical_count_adjustment",
          businessId: bId,
          dealershipId: dId,
          productId: pId,
          variantId: vId,
          warehouseId: wId,
          quantity: variance,
          previousOnHand: prevOnHand,
          newOnHand: counted,
          previousReserved: balance.reservedQuantity,
          newReserved: balance.reservedQuantity,
          referenceType: "physical_count",
          referenceId: moveCode,
          notes: `Physical count adjustment. Variance: ${variance >= 0 ? `+${variance}` : variance}. ${params.reason}`,
          createdBy: actId,
        },
      ],
      params.session ? { session: params.session } : {}
    );

    return { balance, variance };
  }
}
