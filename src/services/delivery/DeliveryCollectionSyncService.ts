import mongoose from "mongoose";
import { DeliveryCollection, type IDeliveryCollection } from "@/models/DeliveryCollection";
import { Order } from "@/models/Order";
import { Customer } from "@/models/Customer";
import { Dispatch } from "@/models/Dispatch";
import { RateLimit } from "@/models/RateLimit";
import { Account } from "@/models/Account";
import { PaymentService } from "@/services/PaymentService";

export interface RecordDeliveryCollectionInput {
  collectionId?: string;
  orderId: string | mongoose.Types.ObjectId;
  deliverymanId: string | mongoose.Types.ObjectId;
  amount: number;
  paymentMethod: "cash" | "bkash" | "nagad" | "bank_transfer" | "other";
  transactionReference?: string;
  dispatchId?: string | mongoose.Types.ObjectId;
  notes?: string;
  source?: "field_sales" | "mother_erp";
  idempotencyKey?: string;
  autoVerifyIfPermitted?: boolean;
  actorId?: string | mongoose.Types.ObjectId;
}

export interface DeliverymanFinancialSummary {
  deliverymanId: string;
  totalCollected: number;
  totalDeposited: number;
  currentCashHeld: number;
  pendingReconciliation: number;
  verifiedCount: number;
  pendingCount: number;
  recentCollections: Array<{
    collectionId: string;
    orderNumber?: string;
    amount: number;
    paymentMethod: string;
    status: string;
    syncStatus: string;
    collectedAt: string;
  }>;
}

export class DeliveryCollectionSyncService {
  /**
   * Record collection from deliveryman with durable cross-app idempotency
   */
  static async recordCollection(
    input: RecordDeliveryCollectionInput
  ): Promise<IDeliveryCollection> {
    const oId = new mongoose.Types.ObjectId(String(input.orderId));
    const dManId = new mongoose.Types.ObjectId(String(input.deliverymanId));
    const amount = Number(input.amount);

    if (!amount || amount <= 0 || !Number.isFinite(amount)) {
      throw new Error("Collection amount must be a positive number");
    }

    // 1. Durable Idempotency Check
    const idempKey = input.idempotencyKey || input.collectionId;
    if (idempKey) {
      if (mongoose.connection.readyState === 1) {
        try {
          await RateLimit.create({
            key: `idemp:col:${idempKey}`,
            windowId: 0,
            hits: 1,
            expireAt: new Date(Date.now() + 86400000),
          });
        } catch (err: any) {
          if (err?.code === 11000) {
            const existing = await DeliveryCollection.findOne({
              $or: [{ collectionId: idempKey }, { idempotencyKey: idempKey }],
            });
            if (existing) return existing;
          }
        }
      }
    }

    const order = await Order.findById(oId);
    if (!order) {
      throw new Error("Order not found for collection");
    }

    const customer = await Customer.findById(order.customerId);
    if (!customer) {
      throw new Error("Customer not found for order");
    }

    const collectionId =
      input.collectionId || `COL-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;

    const collection = await DeliveryCollection.create({
      collectionId,
      businessId: order.businessId,
      dealershipId: order.dealershipId,
      orderId: oId,
      customerId: order.customerId,
      deliverymanId: dManId,
      dispatchId: input.dispatchId ? new mongoose.Types.ObjectId(String(input.dispatchId)) : undefined,
      amount,
      paymentMethod: input.paymentMethod || "cash",
      transactionReference: input.transactionReference,
      status: input.autoVerifyIfPermitted ? "verified" : "pending_verification",
      syncStatus: "SYNCED",
      source: input.source || "mother_erp",
      idempotencyKey: idempKey,
      notes: input.notes,
      verifiedBy: input.autoVerifyIfPermitted && input.actorId ? new mongoose.Types.ObjectId(String(input.actorId)) : undefined,
      verifiedAt: input.autoVerifyIfPermitted ? new Date() : undefined,
    });

    // Update dispatch stop collection if dispatch linked
    if (input.dispatchId) {
      await Dispatch.updateOne(
        { _id: new mongoose.Types.ObjectId(String(input.dispatchId)), "orders.orderId": oId },
        {
          $inc: {
            "orders.$.cashCollected": input.paymentMethod === "cash" ? amount : 0,
            "orders.$.digitalPaymentCollected": input.paymentMethod !== "cash" ? amount : 0,
          },
        }
      ).catch(() => {});
    }

    // If auto-verified, settle directly to ledger
    if (collection.status === "verified") {
      await this.settleCollectionToLedger(collection);
    }

    return collection;
  }

  /**
   * Verify collection and settle double-entry accounting ledger
   */
  static async verifyCollection(params: {
    collectionId: string;
    verifierId: string | mongoose.Types.ObjectId;
  }): Promise<IDeliveryCollection> {
    const col = await DeliveryCollection.findOne({ collectionId: params.collectionId });
    if (!col) throw new Error("Delivery collection record not found");
    if (col.status === "verified" || col.status === "deposited" || col.status === "reconciled") {
      return col;
    }

    col.status = "verified";
    col.verifiedBy = new mongoose.Types.ObjectId(String(params.verifierId));
    col.verifiedAt = new Date();
    await col.save();

    await this.settleCollectionToLedger(col);
    return col;
  }

  /**
   * Internal double-entry posting to PaymentService
   */
  private static async settleCollectionToLedger(col: IDeliveryCollection): Promise<void> {
    let receivingAccount = await Account.findOne({
      type: "asset",
      subType: col.paymentMethod === "cash" ? "cash" : "bank",
      isActive: true,
    });

    if (!receivingAccount) {
      receivingAccount = await Account.findOne({ type: "asset", isActive: true });
    }

    if (!receivingAccount) return;

    await PaymentService.recordCustomerPayment({
      customerId: col.customerId,
      dealershipId: col.dealershipId,
      accountId: receivingAccount._id as mongoose.Types.ObjectId,
      amount: col.amount,
      paymentMethod: col.paymentMethod,
      transactionReference: col.collectionId,
      idempotencyKey: `col-settle-${col.collectionId}`,
      notes: `Deliveryman collection ${col.collectionId} verified`,
      allocations: [{ orderId: col.orderId, amount: col.amount }],
      actorId: col.verifiedBy,
    });
  }

  /**
   * Record deliveryman deposit and reconciliation.
   * STRICT SECURITY RULE: Deliveryman cannot approve their own deposit.
   */
  static async recordDeliverymanDeposit(params: {
    deliverymanId: string | mongoose.Types.ObjectId;
    collectionIds: string[];
    depositAmount: number;
    depositedToAccountId: string | mongoose.Types.ObjectId;
    reconciledByUserId: string | mongoose.Types.ObjectId;
    notes?: string;
  }): Promise<{ depositId: string; reconciledCount: number; totalReconciled: number }> {
    const dManId = String(params.deliverymanId);
    const recBy = String(params.reconciledByUserId);

    if (dManId === recBy) {
      throw new Error("Security Violation: Deliveryman cannot approve their own deposit reconciliation.");
    }

    const depositId = `DEP-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const now = new Date();

    const result = await DeliveryCollection.updateMany(
      {
        collectionId: { $in: params.collectionIds },
        deliverymanId: new mongoose.Types.ObjectId(dManId),
        status: { $in: ["verified", "pending_verification"] },
      },
      {
        $set: {
          status: "reconciled",
          depositId,
          depositedAt: now,
          reconciledAt: now,
          reconciledBy: new mongoose.Types.ObjectId(recBy),
        },
      }
    );

    return {
      depositId,
      reconciledCount: result.modifiedCount,
      totalReconciled: Number(params.depositAmount),
    };
  }

  /**
   * Real-time financial summary of deliveryman cash held and reconciliation
   */
  static async getDeliverymanFinancialSummary(
    deliverymanId: string | mongoose.Types.ObjectId
  ): Promise<DeliverymanFinancialSummary> {
    const dManId = new mongoose.Types.ObjectId(String(deliverymanId));

    const collections = await DeliveryCollection.find({ deliverymanId: dManId })
      .sort({ createdAt: -1 })
      .limit(50);

    let totalCollected = 0;
    let totalDeposited = 0;
    let verifiedCount = 0;
    let pendingCount = 0;

    for (const c of collections) {
      if (c.status !== "cancelled") {
        totalCollected += c.amount;
        if (c.status === "deposited" || c.status === "reconciled") {
          totalDeposited += c.amount;
        }
        if (c.status === "verified" || c.status === "reconciled") {
          verifiedCount++;
        } else {
          pendingCount++;
        }
      }
    }

    const currentCashHeld = Math.max(0, Math.round((totalCollected - totalDeposited) * 100) / 100);
    const pendingReconciliation = currentCashHeld;

    return {
      deliverymanId: String(dManId),
      totalCollected: Math.round(totalCollected * 100) / 100,
      totalDeposited: Math.round(totalDeposited * 100) / 100,
      currentCashHeld,
      pendingReconciliation,
      verifiedCount,
      pendingCount,
      recentCollections: collections.map((c) => ({
        collectionId: c.collectionId,
        amount: c.amount,
        paymentMethod: c.paymentMethod,
        status: c.status,
        syncStatus: c.syncStatus,
        collectedAt: c.createdAt.toISOString(),
      })),
    };
  }
}
