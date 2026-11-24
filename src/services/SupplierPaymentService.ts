import mongoose from "mongoose";
import { SupplierPayable, type ISupplierPayable } from "@/models/SupplierPayable";
import { Payment, type IPayment } from "@/models/Payment";
import { Vendor } from "@/models/Vendor";
import { AuditLog } from "@/models/AuditLog";
import { generateReferenceCode } from "@/lib/utils";

export interface RecordSupplierPaymentInput {
  businessId: string | mongoose.Types.ObjectId;
  dealershipId?: string | mongoose.Types.ObjectId;
  supplierId?: string | mongoose.Types.ObjectId;
  payableId?: string | mongoose.Types.ObjectId;
  amount: number;
  paymentMethod: "cash" | "bank_transfer" | "bkash" | "nagad" | "rocket" | "other" | string;
  paymentDate?: Date | string;
  transactionReference?: string;
  cashDiscountEarned?: number;
  idempotencyKey?: string;
  notes?: string;
  actorId?: string | mongoose.Types.ObjectId;
  session?: mongoose.ClientSession;
}

export class SupplierPaymentService {
  /**
   * List unpaid/partially paid/paid payables scoped to tenancy
   */
  static async listPayables(params: {
    businessId: string | mongoose.Types.ObjectId;
    dealershipId?: string | mongoose.Types.ObjectId;
    supplierId?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const bId = new mongoose.Types.ObjectId(String(params.businessId));
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      businessId: bId,
      isCancelled: false,
    };

    if (params.dealershipId) {
      filter.dealershipId = new mongoose.Types.ObjectId(String(params.dealershipId));
    }
    if (params.supplierId) {
      filter.supplierId = new mongoose.Types.ObjectId(params.supplierId);
    }
    if (params.status) {
      filter.status = params.status;
    }
    if (params.search) {
      const q = params.search.trim();
      filter.$or = [
        { payableNumber: { $regex: q, $options: "i" } },
        { invoiceNumber: { $regex: q, $options: "i" } },
        { challanNumber: { $regex: q, $options: "i" } },
      ];
    }

    const [payables, total] = await Promise.all([
      SupplierPayable.find(filter)
        .populate("supplierId", "name companyName phone code")
        .populate("dealershipId", "name code")
        .populate("grnId", "grnNumber challanNumber challanDate")
        .sort({ invoiceDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SupplierPayable.countDocuments(filter),
    ]);

    return {
      payables,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Record a supplier payment idempotently and update payable & vendor balances
   */
  static async recordPayment(input: RecordSupplierPaymentInput): Promise<any> {
    const bId = new mongoose.Types.ObjectId(String(input.businessId));
    let dId = input.dealershipId ? new mongoose.Types.ObjectId(String(input.dealershipId)) : null;
    let sId = input.supplierId ? new mongoose.Types.ObjectId(String(input.supplierId)) : null;
    const actId = input.actorId ? new mongoose.Types.ObjectId(String(input.actorId)) : null;
    const payAmt = Math.max(0, Number(input.amount));
    const earnedCashDisc = Math.max(0, Number(input.cashDiscountEarned || 0));

    if (payAmt <= 0 && earnedCashDisc <= 0) {
      throw new Error("Payment amount or earned cash discount must be greater than zero");
    }

    const cleanIdempotencyKey = input.idempotencyKey?.trim();
    if (cleanIdempotencyKey) {
      const existing = await Payment.findOne({ idempotencyKey: cleanIdempotencyKey }).session(
        input.session || null
      );
      if (existing) {
        let existingPayable: ISupplierPayable | null = null;
        if (input.payableId) {
          existingPayable = await SupplierPayable.findById(input.payableId).session(input.session || null);
        }
        const cachedRes: any = existing;
        cachedRes.payment = existing;
        cachedRes.payable = existingPayable;
        return cachedRes;
      }
    }

    const paymentNumber = generateReferenceCode("VMT", Math.floor(Math.random() * 9000 + 1000));
    const allocations: Array<{
      invoiceType: "order" | "purchase";
      invoiceId: mongoose.Types.ObjectId;
      referenceNumber: string;
      amountAllocated: number;
    }> = [];

    // If specific payable provided
    let payable: ISupplierPayable | null = null;
    if (input.payableId) {
      payable = await SupplierPayable.findById(input.payableId).session(input.session || null);
      if (!payable) throw new Error("Supplier Payable record not found");
      if (payable.status === "PAID") {
        throw new Error(`Payable ${payable.payableNumber} is already fully paid`);
      }

      const totalRelief = payAmt + earnedCashDisc;
      if (totalRelief > payable.outstandingBalance + 0.001) {
        throw new Error(
          `Payment total (${totalRelief}) exceeds outstanding balance (${payable.outstandingBalance})`
        );
      }

      if (!sId && payable.supplierId) {
        sId = new mongoose.Types.ObjectId(String(payable.supplierId));
      }
      if (!dId && payable.dealershipId) {
        dId = new mongoose.Types.ObjectId(String(payable.dealershipId));
      }

      const newPaid = Math.min(payable.netPayable, (payable.paidAmount || 0) + payAmt);
      const newDiscounts = (payable.earnedDiscounts || 0) + earnedCashDisc;
      const totalSettled = newPaid + newDiscounts;
      const newOutstanding = Math.max(0, payable.netPayable - totalSettled);

      payable.paidAmount = newPaid;
      payable.earnedDiscounts = newDiscounts;
      payable.outstandingBalance = newOutstanding;
      payable.status = newOutstanding === 0 ? "PAID" : "PARTIALLY_PAID";
      await payable.save({ session: input.session });

      allocations.push({
        invoiceType: "purchase",
        invoiceId: payable._id as mongoose.Types.ObjectId,
        referenceNumber: payable.invoiceNumber,
        amountAllocated: totalRelief,
      });
    }

    if (!sId) {
      throw new Error("Supplier ID is required to record payment");
    }

    // Default accountId placeholder if accounts not configured yet
    const dummyAccountId = new mongoose.Types.ObjectId();

    const createdPayments: any = await Payment.create(
      [
        {
          paymentNumber,
          paymentType: "vendor_payment",
          vendorId: sId,
          accountId: dummyAccountId,
          paymentMethod: (input.paymentMethod as any) || "bank_transfer",
          transactionReference: input.transactionReference?.trim(),
          amount: payAmt,
          date: input.paymentDate ? new Date(input.paymentDate) : new Date(),
          status: "verified",
          allocations,
          notes: input.notes?.trim(),
          idempotencyKey: cleanIdempotencyKey,
          createdBy: actId || undefined,
        },
      ],
      { session: input.session }
    );
    const payment = Array.isArray(createdPayments) ? createdPayments[0] : createdPayments;

    // Update vendor current payable
    const totalDeduction = payAmt + earnedCashDisc;
    await Vendor.findByIdAndUpdate(
      sId,
      { $inc: { currentPayable: -totalDeduction } },
      { session: input.session }
    );

    if (actId) {
      await AuditLog.create({
        actorId: actId,
        action: "SUPPLIER_PAYMENT_RECORDED",
        entityType: "payment",
        entityId: String(payment._id),
        afterSnapshot: {
          paymentNumber,
          supplierId: String(sId),
          amount: payAmt,
          cashDiscountEarned: earnedCashDisc,
          payableId: input.payableId ? String(input.payableId) : undefined,
        },
      });
    }

    const res: any = payment;
    res.payment = payment;
    res.payable = payable;
    return res;
  }

  /**
   * List payment history for supplier or dealership
   */
  static async listPayments(params: {
    supplierId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      paymentType: "vendor_payment",
    };

    if (params.supplierId) {
      filter.vendorId = new mongoose.Types.ObjectId(params.supplierId);
    }

    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .populate("vendorId", "name companyName phone code")
        .populate("createdBy", "name email")
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Payment.countDocuments(filter),
    ]);

    return {
      payments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Supplier-wise and Dealership-wise Outstanding Report Summary
   */
  static async getOutstandingReport(businessId: string | mongoose.Types.ObjectId) {
    const bId = new mongoose.Types.ObjectId(String(businessId));

    const [supplierBalances, payablesSummary] = await Promise.all([
      Vendor.find({
        $or: [{ businessId: bId }, { businessId: { $exists: false } }],
        currentPayable: { $gt: 0 },
      })
        .select("name companyName phone code currentPayable openingBalance")
        .sort({ currentPayable: -1 })
        .lean(),

      SupplierPayable.aggregate([
        { $match: { businessId: bId, isCancelled: false, status: { $ne: "PAID" } } },
        {
          $group: {
            _id: "$dealershipId",
            totalOutstanding: { $sum: "$outstandingBalance" },
            unpaidInvoicesCount: { $sum: 1 },
          },
        },
      ]),
    ]);

    const totalBusinessOutstanding = supplierBalances.reduce(
      (sum, s) => sum + (s.currentPayable || 0),
      0
    );

    return {
      totalBusinessOutstanding,
      supplierBalances,
      dealershipOutstanding: payablesSummary,
    };
  }
}
