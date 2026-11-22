import mongoose from "mongoose";
import {
  InventoryBalance,
  IInventoryBalance,
} from "@/models/InventoryBalance";
import { StockMovement, StockMovementType } from "@/models/StockMovement";
import { StockReservation, IStockReservation } from "@/models/StockReservation";
import { generateReferenceCode } from "@/lib/utils";

export interface StockItemInput {
  productId: string | mongoose.Types.ObjectId;
  variantId: string | mongoose.Types.ObjectId;
  quantity: number;
  unitCost?: number;
}

export class InventoryService {
  /**
   * Helper to ensure an InventoryBalance record exists
   */
  static async getOrCreateBalance(
    warehouseId: mongoose.Types.ObjectId,
    productId: mongoose.Types.ObjectId,
    variantId: mongoose.Types.ObjectId,
    session?: mongoose.ClientSession
  ): Promise<IInventoryBalance> {
    let balance = await InventoryBalance.findOne({
      warehouseId,
      productId,
      variantId,
    }).session(session || null);

    if (!balance) {
      const created = await InventoryBalance.create(
        [
          {
            warehouseId,
            productId,
            variantId,
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
   * Receive physical stock into the warehouse (from Purchase Receive or initial stock)
   * Increases onHandQuantity.
   */
  static async receiveStock(
    warehouseId: string | mongoose.Types.ObjectId,
    items: StockItemInput[],
    referenceId: string,
    referenceType = "purchase_receive",
    actorId?: string | mongoose.Types.ObjectId,
    session?: mongoose.ClientSession
  ): Promise<void> {
    const wId = new mongoose.Types.ObjectId(String(warehouseId));
    const actId = actorId ? new mongoose.Types.ObjectId(String(actorId)) : undefined;

    for (const item of items) {
      const pId = new mongoose.Types.ObjectId(String(item.productId));
      const vId = new mongoose.Types.ObjectId(String(item.variantId));
      const qty = Number(item.quantity);

      if (qty <= 0) continue;

      const balance = await this.getOrCreateBalance(wId, pId, vId, session);
      const prevOnHand = balance.onHandQuantity;
      const prevReserved = balance.reservedQuantity;
      const newOnHand = prevOnHand + qty;
      const newAvailable = newOnHand - prevReserved;

      balance.onHandQuantity = newOnHand;
      balance.availableQuantity = newAvailable;
      balance.lastUpdated = new Date();
      await balance.save({ session });

      const movementCode = generateReferenceCode("STK-REC", Math.floor(Math.random() * 9000 + 1000));

      await StockMovement.create(
        [
          {
            movementNumber: movementCode,
            type: "purchase_receive",
            productId: pId,
            variantId: vId,
            warehouseId: wId,
            quantity: qty,
            unitCost: item.unitCost,
            previousOnHand: prevOnHand,
            newOnHand,
            previousReserved: prevReserved,
            newReserved: prevReserved,
            referenceType,
            referenceId,
            notes: `Received ${qty} units for ${referenceId}`,
            createdBy: actId,
          },
        ],
        session ? { session } : {}
      );
    }
  }

  /**
   * Atomic stock reservation
   * Validates Available = OnHand - Reserved >= Requested Quantity
   * Never allows overselling!
   */
  static async reserveStock(params: {
    warehouseId: string | mongoose.Types.ObjectId;
    items: StockItemInput[];
    source?: "admin_dashboard" | "internal_staff" | "field_sales" | "api";
    orderNumber?: string;
    customerId?: string | mongoose.Types.ObjectId;
    idempotencyKey?: string;
    expiresInMinutes?: number;
    actorId?: string | mongoose.Types.ObjectId;
    session?: mongoose.ClientSession;
  }): Promise<IStockReservation> {
    const wId = new mongoose.Types.ObjectId(String(params.warehouseId));
    const actId = params.actorId ? new mongoose.Types.ObjectId(String(params.actorId)) : undefined;
    const custId = params.customerId ? new mongoose.Types.ObjectId(String(params.customerId)) : undefined;

    // Idempotency check: if reservation already exists with this idempotency key, return it
    if (params.idempotencyKey) {
      const existing = await StockReservation.findOne({
        idempotencyKey: params.idempotencyKey,
      }).session(params.session || null);
      if (existing) {
        return existing;
      }
    }

    // Step 1: Pre-validate that all items have sufficient available quantity
    for (const item of params.items) {
      const pId = new mongoose.Types.ObjectId(String(item.productId));
      const vId = new mongoose.Types.ObjectId(String(item.variantId));
      const qty = Number(item.quantity);

      const bal = await this.getOrCreateBalance(wId, pId, vId, params.session);
      const available = bal.onHandQuantity - bal.reservedQuantity;
      if (available < qty) {
        throw new Error(
          `Insufficient stock for item variant ${vId}. Available: ${available}, Requested: ${qty}`
        );
      }
    }

    // Step 2: Concurrency-safe atomic reservations
    // We increment reservedQuantity only where onHand - reserved >= qty
    const reservedItemsRecord: Array<{
      productId: mongoose.Types.ObjectId;
      variantId: mongoose.Types.ObjectId;
      quantity: number;
    }> = [];

    const rollbackList: Array<{
      productId: mongoose.Types.ObjectId;
      variantId: mongoose.Types.ObjectId;
      quantity: number;
    }> = [];

    try {
      for (const item of params.items) {
        const pId = new mongoose.Types.ObjectId(String(item.productId));
        const vId = new mongoose.Types.ObjectId(String(item.variantId));
        const qty = Number(item.quantity);

        // Atomic update with MongoDB expression condition
        const updated = await InventoryBalance.findOneAndUpdate(
          {
            warehouseId: wId,
            productId: pId,
            variantId: vId,
            $expr: {
              $gte: [
                { $subtract: ["$onHandQuantity", "$reservedQuantity"] },
                qty,
              ],
            },
          },
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

        // Update availableQuantity
        updated.availableQuantity = updated.onHandQuantity - updated.reservedQuantity;
        await updated.save({ session: params.session });

        rollbackList.push({ productId: pId, variantId: vId, quantity: qty });
        reservedItemsRecord.push({ productId: pId, variantId: vId, quantity: qty });

        // Record stock movement for reservation
        const moveCode = generateReferenceCode("STK-RES", Math.floor(Math.random() * 9000 + 1000));
        await StockMovement.create(
          [
            {
              movementNumber: moveCode,
              type: "reservation",
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
      // Rollback any successfully incremented reserved quantities if part of the loop failed
      if (!params.session) {
        for (const rb of rollbackList) {
          await InventoryBalance.findOneAndUpdate(
            { warehouseId: wId, productId: rb.productId, variantId: rb.variantId },
            {
              $inc: { reservedQuantity: -rb.quantity },
              $set: { lastUpdated: new Date() },
            }
          );
        }
      }
      throw err;
    }

    const reservationNumber = generateReferenceCode(
      "RES",
      Math.floor(Math.random() * 9000 + 1000)
    );

    const expiresAt = params.expiresInMinutes
      ? new Date(Date.now() + params.expiresInMinutes * 60 * 1000)
      : undefined;

    const reservation = await StockReservation.create(
      [
        {
          reservationNumber,
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
   * Release an active reservation (e.g. order cancelled or expired)
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
    if (!reservation) {
      throw new Error("Reservation not found");
    }

    if (reservation.status !== "active") {
      // Already released or fulfilled
      return;
    }

    for (const item of reservation.items) {
      const balance = await this.getOrCreateBalance(
        reservation.warehouseId,
        item.productId,
        item.variantId,
        session
      );

      const prevOnHand = balance.onHandQuantity;
      const prevReserved = balance.reservedQuantity;
      const newReserved = Math.max(0, prevReserved - item.quantity);
      const newAvailable = prevOnHand - newReserved;

      balance.reservedQuantity = newReserved;
      balance.availableQuantity = newAvailable;
      balance.lastUpdated = new Date();
      await balance.save({ session });

      const moveCode = generateReferenceCode("STK-REL", Math.floor(Math.random() * 9000 + 1000));
      await StockMovement.create(
        [
          {
            movementNumber: moveCode,
            type: "reservation_release",
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
   * Fulfill order: Deducts reservedQuantity AND onHandQuantity simultaneously
   */
  static async fulfillStock(
    warehouseId: string | mongoose.Types.ObjectId,
    reservationId: string | mongoose.Types.ObjectId | undefined,
    items: StockItemInput[],
    orderNumber: string,
    actorId?: string | mongoose.Types.ObjectId,
    session?: mongoose.ClientSession
  ): Promise<void> {
    const wId = new mongoose.Types.ObjectId(String(warehouseId));
    const actId = actorId ? new mongoose.Types.ObjectId(String(actorId)) : undefined;

    for (const item of items) {
      const pId = new mongoose.Types.ObjectId(String(item.productId));
      const vId = new mongoose.Types.ObjectId(String(item.variantId));
      const qty = Number(item.quantity);

      const balance = await this.getOrCreateBalance(wId, pId, vId, session);
      const prevOnHand = balance.onHandQuantity;
      const prevReserved = balance.reservedQuantity;

      const newOnHand = Math.max(0, prevOnHand - qty);
      // If reserved, reduce reserved quantity as well
      const newReserved = Math.max(0, prevReserved - qty);
      const newAvailable = newOnHand - newReserved;

      balance.onHandQuantity = newOnHand;
      balance.reservedQuantity = newReserved;
      balance.availableQuantity = newAvailable;
      balance.lastUpdated = new Date();
      await balance.save({ session });

      const moveCode = generateReferenceCode("STK-FUL", Math.floor(Math.random() * 9000 + 1000));
      await StockMovement.create(
        [
          {
            movementNumber: moveCode,
            type: "sales_fulfillment",
            productId: pId,
            variantId: vId,
            warehouseId: wId,
            quantity: -qty,
            unitCost: item.unitCost,
            previousOnHand: prevOnHand,
            newOnHand,
            previousReserved: prevReserved,
            newReserved,
            referenceType: "sales_order",
            referenceId: orderNumber,
            notes: `Fulfillment for Order ${orderNumber}`,
            createdBy: actId,
          },
        ],
        session ? { session } : {}
      );
    }

    if (reservationId) {
      const reservation = await StockReservation.findById(reservationId).session(session || null);
      if (reservation && reservation.status === "active") {
        reservation.status = "fulfilled";
        reservation.fulfilledAt = new Date();
        await reservation.save({ session });
      }
    }
  }

  /**
   * Manual Stock Adjustment
   */
  static async adjustStock(params: {
    warehouseId: string | mongoose.Types.ObjectId;
    productId: string | mongoose.Types.ObjectId;
    variantId: string | mongoose.Types.ObjectId;
    adjustmentQty: number; // positive to add, negative to subtract
    reason: string;
    actorId?: string | mongoose.Types.ObjectId;
    session?: mongoose.ClientSession;
  }): Promise<IInventoryBalance> {
    const wId = new mongoose.Types.ObjectId(String(params.warehouseId));
    const pId = new mongoose.Types.ObjectId(String(params.productId));
    const vId = new mongoose.Types.ObjectId(String(params.variantId));
    const actId = params.actorId ? new mongoose.Types.ObjectId(String(params.actorId)) : undefined;

    const balance = await this.getOrCreateBalance(wId, pId, vId, params.session);
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
   * Mark Damaged Stock (moves from onHand to damagedQuantity)
   */
  static async recordDamage(params: {
    warehouseId: string | mongoose.Types.ObjectId;
    productId: string | mongoose.Types.ObjectId;
    variantId: string | mongoose.Types.ObjectId;
    damagedQty: number;
    reason: string;
    actorId?: string | mongoose.Types.ObjectId;
    session?: mongoose.ClientSession;
  }): Promise<IInventoryBalance> {
    const wId = new mongoose.Types.ObjectId(String(params.warehouseId));
    const pId = new mongoose.Types.ObjectId(String(params.productId));
    const vId = new mongoose.Types.ObjectId(String(params.variantId));
    const actId = params.actorId ? new mongoose.Types.ObjectId(String(params.actorId)) : undefined;

    const balance = await this.getOrCreateBalance(wId, pId, vId, params.session);
    const prevOnHand = balance.onHandQuantity;
    const prevReserved = balance.reservedQuantity;

    if (balance.availableQuantity < params.damagedQty) {
      throw new Error("Insufficient available stock to mark as damaged");
    }

    const newOnHand = prevOnHand - params.damagedQty;
    const newAvailable = newOnHand - prevReserved;

    balance.onHandQuantity = newOnHand;
    balance.availableQuantity = newAvailable;
    balance.damagedQuantity = (balance.damagedQuantity || 0) + params.damagedQty;
    balance.lastUpdated = new Date();
    await balance.save({ session: params.session });

    const moveCode = generateReferenceCode("STK-DMG", Math.floor(Math.random() * 9000 + 1000));
    await StockMovement.create(
      [
        {
          movementNumber: moveCode,
          type: "damage",
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
}
