import mongoose from "mongoose";
import { DeliveryCollection, type IDeliveryCollection } from "@/models/DeliveryCollection";
import { Order } from "@/models/Order";
import { Customer } from "@/models/Customer";
import { Dispatch } from "@/models/Dispatch";
import { RateLimit } from "@/models/RateLimit";
import { Account } from "@/models/Account";
import { CustomerDealershipAccount } from "@/models/CustomerDealershipAccount";
import { PaymentService } from "@/services/PaymentService";

export interface RecordDeliveryCollectionInput {
  collectionId?: string;
  orderId?: string | mongoose.Types.ObjectId;
  customerId?: string | mongoose.Types.ObjectId;
  dealershipId?: string | mongoose.Types.ObjectId;
  deliverymanId?: string | mongoose.Types.ObjectId;
  salesmanId?: string | mongoose.Types.ObjectId;
  collectorId?: string | mongoose.Types.ObjectId;
  collectorRole?: "salesman" | "deliveryman";
  amount: number;
  paymentMethod?: "cash";
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
  totalCashCollected: number;
  totalCashDeposited: number;
  currentCashHeld: number; // Formula: verifiedCashCollected - verifiedCashDeposited
  pendingReconciliation: number;
  verifiedDeposits: number;
  verifiedCashCollected: number;
  pendingCashCollected: number;
  // Compatibility aliases
  totalCollected: number;
  totalDeposited: number;
  reconciledAmount: number;
  verifiedCount: number;
  pendingCount: number;
  recentCollections: Array<{
    collectionId: string;
    amount: number;
    paymentMethod: "cash";
    status: string;
    syncStatus: string;
    collectedAt: string;
    orderId?: string;
  }>;
}

export class DeliveryCollectionSyncService {
  /**
   * Record physical cash collection from deliveryman with durable cross-app idempotency
   */
  static async recordCollection(input: RecordDeliveryCollectionInput): Promise<IDeliveryCollection> {
    const amount = Number(input.amount);
    if (!amount || amount <= 0 || !Number.isFinite(amount)) throw new Error("Collection amount must be positive");

    if (input.paymentMethod && input.paymentMethod !== "cash") {
      throw new Error("Deliveryman collections currently accept physical cash only.");
    }

    const collectorRole = input.collectorRole || (input.salesmanId ? "salesman" : "deliveryman");
    const collectorId = input.collectorId || input.salesmanId || input.deliverymanId;
    if (!collectorId) throw new Error("Collector identity is required");

    // STRICT LAW: Salesman can NEVER self-verify their own collection. New collections always start pending_verification.
    const isSalesman = collectorRole === "salesman";
    const isAutoVerified = isSalesman ? false : Boolean(input.autoVerifyIfPermitted);

    // Derive order, customer, dealership, business
    let oId = input.orderId ? new mongoose.Types.ObjectId(String(input.orderId)) : undefined;
    let customerId = input.customerId ? new mongoose.Types.ObjectId(String(input.customerId)) : undefined;
    let dealershipId = input.dealershipId ? new mongoose.Types.ObjectId(String(input.dealershipId)) : undefined;
    let businessId: any = null;

    if (oId) {
      const order = await Order.findById(oId);
      if (!order) throw new Error("Order not found for collection");
      customerId = order.customerId;
      dealershipId = order.dealershipId;
      businessId = order.businessId;
    } else if (customerId && dealershipId) {
      const customer = await Customer.findById(customerId);
      if (!customer) throw new Error("Customer not found for collection");
      const account = await CustomerDealershipAccount.findOne({ customerId, dealershipId });
      if (!account) throw new Error("Customer has no account with this dealership");
      businessId = account.businessId;
    } else {
      throw new Error("Either orderId or both customerId and dealershipId are required");
    }

    const idempKey = input.idempotencyKey || input.collectionId;
    if (idempKey && mongoose.connection.readyState === 1) {
      try {
        await RateLimit.create({ key: `idemp:col:${idempKey}`, windowId: 0, hits: 1, expireAt: new Date(Date.now() + 86400000) });
      } catch (err: any) {
        if (err?.code === 11000) {
          const existing = await DeliveryCollection.findOne({ $or: [{ collectionId: idempKey }, { idempotencyKey: idempKey }] });
          if (existing) return existing;
        }
      }
    }

    const collectionId = input.collectionId || `COL-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;

    const collection = await DeliveryCollection.create({
      collectionId,
      businessId,
      dealershipId,
      orderId: oId,
      customerId,
      deliverymanId: collectorRole === "deliveryman" ? new mongoose.Types.ObjectId(String(collectorId)) : undefined,
      salesmanId: collectorRole === "salesman" ? new mongoose.Types.ObjectId(String(collectorId)) : undefined,
      collectorRole,
      dispatchId: input.dispatchId ? new mongoose.Types.ObjectId(String(input.dispatchId)) : undefined,
      amount,
      paymentMethod: "cash",
      transactionReference: input.transactionReference,
      status: isAutoVerified ? "verified" : "pending_verification",
      syncStatus: "SYNCED",
      source: input.source || "field_sales",
      idempotencyKey: idempKey,
      notes: input.notes,
      verifiedBy: isAutoVerified && input.actorId ? new mongoose.Types.ObjectId(String(input.actorId)) : undefined,
      verifiedAt: isAutoVerified ? new Date() : undefined,
    });

    if (input.dispatchId && oId) {
      await Dispatch.updateOne(
        { _id: new mongoose.Types.ObjectId(String(input.dispatchId)), "orders.orderId": oId },
        { $inc: { "orders.$.cashCollected": amount } }
      ).catch(() => {});
    }

    if (collection.status === "verified") await this.settleCollectionToLedger(collection);
    return collection;
  }

  /**
   * Verify collection and settle double-entry accounting ledger
   */
  static async verifyCollection(params: { collectionId: string; verifierId: string | mongoose.Types.ObjectId }): Promise<IDeliveryCollection> {
    const col = await DeliveryCollection.findOne({ collectionId: params.collectionId });
    if (!col) throw new Error("Delivery collection record not found");
    if (col.status === "verified" || col.status === "deposited" || col.status === "reconciled") return col;

    // Strict Security Rule: Collector cannot verify their own collection
    const verifierStr = String(params.verifierId);
    const collectorStr = String(col.deliverymanId || col.salesmanId || "");
    if (verifierStr && verifierStr === collectorStr) {
      throw new Error("Security Violation: Collector cannot verify their own collection.");
    }

    col.status = "verified";
    col.verifiedBy = new mongoose.Types.ObjectId(verifierStr);
    col.verifiedAt = new Date();
    await col.save();

    await this.settleCollectionToLedger(col);
    return col;
  }

  private static async settleCollectionToLedger(col: IDeliveryCollection): Promise<void> {
    const receivingAccount = (await Account.findOne({ type: "asset", subType: "cash", isActive: true })) || (await Account.findOne({ type: "asset", isActive: true }));
    if (!receivingAccount) return;

    await PaymentService.recordCustomerPayment({
      customerId: col.customerId,
      dealershipId: col.dealershipId,
      accountId: receivingAccount._id as mongoose.Types.ObjectId,
      amount: col.amount,
      paymentMethod: "cash",
      transactionReference: col.collectionId,
      idempotencyKey: `col-settle-${col.collectionId}`,
      notes: `${col.collectorRole === "salesman" ? "Salesman" : "Deliveryman"} cash collection ${col.collectionId} verified`,
      allocations: col.orderId ? [{ orderId: col.orderId, amount: col.amount }] : [],
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
    if (dManId === recBy) throw new Error("Security Violation: Deliveryman cannot approve their own deposit reconciliation.");

    const depositId = `DEP-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const now = new Date();

    const result = await DeliveryCollection.updateMany(
      { collectionId: { $in: params.collectionIds }, deliverymanId: new mongoose.Types.ObjectId(dManId), status: { $in: ["verified", "pending_verification"] } },
      { $set: { status: "reconciled", depositId, depositedAt: now, reconciledAt: now, reconciledBy: new mongoose.Types.ObjectId(recBy) } }
    );

    return { depositId, reconciledCount: result.modifiedCount, totalReconciled: Number(params.depositAmount) };
  }

  /**
   * Real-time financial summary of deliveryman cash held and deposit reconciliation.
   * STRICT CASH LAW: currentCashHeld = verifiedCashCollected - verifiedCashDeposited
   */
  static async getDeliverymanFinancialSummary(deliverymanId: string | mongoose.Types.ObjectId): Promise<DeliverymanFinancialSummary> {
    const dManId = new mongoose.Types.ObjectId(String(deliverymanId));
    const collections = await DeliveryCollection.find({ deliverymanId: dManId }).sort({ createdAt: -1 }).limit(50);

    let totalCashCollected = 0;
    let verifiedCashCollected = 0;
    let pendingCashCollected = 0;
    let totalCashDeposited = 0;
    let verifiedDeposits = 0;
    let verifiedCount = 0;
    let pendingCount = 0;

    for (const c of collections) {
      if (c.status === "cancelled") continue;
      totalCashCollected += c.amount;

      const isVerified = c.status === "verified" || c.status === "deposited" || c.status === "reconciled";
      const isDeposited = c.status === "deposited" || c.status === "reconciled";
      const isReconciled = c.status === "reconciled";

      if (isVerified) {
        verifiedCashCollected += c.amount;
        verifiedCount++;
        if (isDeposited) {
          totalCashDeposited += c.amount;
        }
        if (isReconciled) {
          verifiedDeposits += c.amount;
        }
      } else {
        pendingCashCollected += c.amount;
        pendingCount++;
      }
    }

    // Formula: currentCashHeld = verifiedCashCollected - verifiedCashDeposited
    const currentCashHeld = Math.max(0, Math.round((verifiedCashCollected - totalCashDeposited) * 100) / 100);
    const pendingReconciliation = Math.round((currentCashHeld + pendingCashCollected) * 100) / 100;

    return {
      deliverymanId: String(dManId),
      totalCashCollected: Math.round(totalCashCollected * 100) / 100,
      totalCashDeposited: Math.round(totalCashDeposited * 100) / 100,
      currentCashHeld,
      pendingReconciliation,
      verifiedDeposits: Math.round(verifiedDeposits * 100) / 100,
      verifiedCashCollected: Math.round(verifiedCashCollected * 100) / 100,
      pendingCashCollected: Math.round(pendingCashCollected * 100) / 100,
      // Compatibility aliases
      totalCollected: Math.round(totalCashCollected * 100) / 100,
      totalDeposited: Math.round(totalCashDeposited * 100) / 100,
      reconciledAmount: Math.round(verifiedDeposits * 100) / 100,
      verifiedCount,
      pendingCount,
      recentCollections: collections.map((c) => ({
        collectionId: c.collectionId,
        amount: c.amount,
        paymentMethod: "cash" as const,
        status: c.status,
        syncStatus: c.syncStatus,
        collectedAt: c.createdAt.toISOString(),
        orderId: c.orderId ? String(c.orderId) : undefined,
      })),
    };
  }
}
