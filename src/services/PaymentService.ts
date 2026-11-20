import mongoose from "mongoose";
import { Payment, IPayment, IPaymentAllocation } from "@/models/Payment";
import { Customer } from "@/models/Customer";
import { Vendor } from "@/models/Vendor";
import { Order } from "@/models/Order";
import { Purchase } from "@/models/Purchase";
import { Account } from "@/models/Account";
import { AccountingService } from "./AccountingService";
import { AuditService } from "./AuditService";
import { generateReferenceCode } from "@/lib/utils";

export interface RecordCustomerPaymentInput {
  customerId: string | mongoose.Types.ObjectId;
  accountId: string | mongoose.Types.ObjectId;
  amount: number;
  paymentMethod: "cash" | "bank_transfer" | "bkash" | "nagad" | "rocket" | "other";
  transactionReference?: string;
  date?: Date;
  notes?: string;
  idempotencyKey?: string;
  allocations?: Array<{
    orderId: string | mongoose.Types.ObjectId;
    amount: number;
  }>;
  actorId?: string | mongoose.Types.ObjectId;
}

export interface RecordVendorPaymentInput {
  vendorId: string | mongoose.Types.ObjectId;
  accountId: string | mongoose.Types.ObjectId;
  amount: number;
  paymentMethod: "cash" | "bank_transfer" | "bkash" | "nagad" | "rocket" | "other";
  transactionReference?: string;
  date?: Date;
  notes?: string;
  idempotencyKey?: string;
  allocations?: Array<{
    purchaseId: string | mongoose.Types.ObjectId;
    amount: number;
  }>;
  actorId?: string | mongoose.Types.ObjectId;
}

export class PaymentService {
  /**
   * Record Customer Receipt
   */
  static async recordCustomerPayment(
    input: RecordCustomerPaymentInput
  ): Promise<IPayment> {
    const cId = new mongoose.Types.ObjectId(String(input.customerId));
    const aId = new mongoose.Types.ObjectId(String(input.accountId));
    const actId = input.actorId ? new mongoose.Types.ObjectId(String(input.actorId)) : undefined;

    // Idempotency check
    if (input.idempotencyKey) {
      const existing = await Payment.findOne({ idempotencyKey: input.idempotencyKey });
      if (existing) {
        return existing;
      }
    }

    const customer = await Customer.findById(cId);
    if (!customer) {
      throw new Error("Customer not found");
    }

    const account = await Account.findById(aId);
    if (!account) {
      throw new Error("Payment receiving account not found");
    }

    const amount = Number(input.amount);
    if (amount <= 0) {
      throw new Error("Payment amount must be greater than zero");
    }

    const paymentNumber = generateReferenceCode(
      "RCT-CUST",
      Math.floor(Math.random() * 9000 + 1000)
    );

    const allocations: IPaymentAllocation[] = [];

    // Process order allocations if specified
    if (input.allocations && input.allocations.length > 0) {
      for (const alloc of input.allocations) {
        const oId = new mongoose.Types.ObjectId(String(alloc.orderId));
        const allocAmount = Number(alloc.amount);
        if (allocAmount <= 0) continue;

        const order = await Order.findById(oId);
        if (order) {
          order.paidAmount = Math.round((order.paidAmount + allocAmount) * 100) / 100;
          order.receivableAmount = Math.max(
            0,
            Math.round((order.grandTotal - order.paidAmount) * 100) / 100
          );
          order.paymentStatus =
            order.receivableAmount === 0
              ? "paid"
              : order.paidAmount > 0
              ? "partially_paid"
              : "unpaid";
          await order.save();

          allocations.push({
            invoiceType: "order",
            invoiceId: oId,
            referenceNumber: order.orderNumber,
            amountAllocated: allocAmount,
          });
        }
      }
    }

    // Update Customer Receivable
    customer.currentReceivable =
      Math.round((customer.currentReceivable - amount) * 100) / 100;
    await customer.save();

    // Double-Entry: Debit Cash/Bank/MFS, Credit Accounts Receivable
    let journalEntryId: mongoose.Types.ObjectId | undefined;
    try {
      const arAccount = await AccountingService.getAccountBySubType("accounts_receivable");

      const je = await AccountingService.postJournalEntry({
        referenceType: "customer_payment",
        referenceId: paymentNumber,
        narration: `Payment received from customer ${customer.shopName} via ${input.paymentMethod}`,
        lines: [
          {
            accountId: aId,
            debit: amount,
            credit: 0,
            description: `Deposit to ${account.name}`,
          },
          {
            accountId: arAccount._id as mongoose.Types.ObjectId,
            debit: 0,
            credit: amount,
            description: `Receivable collected from ${customer.shopName}`,
          },
        ],
        postedBy: actId,
      });
      journalEntryId = je._id as mongoose.Types.ObjectId;
    } catch (accErr) {
      console.error("[PaymentService.recordCustomerPayment] Accounting error:", accErr);
    }

    const payment = await Payment.create({
      paymentNumber,
      paymentType: "customer_receipt",
      customerId: cId,
      accountId: aId,
      paymentMethod: input.paymentMethod,
      transactionReference: input.transactionReference,
      amount,
      date: input.date || new Date(),
      status: "verified",
      allocations,
      notes: input.notes,
      idempotencyKey: input.idempotencyKey,
      journalEntryId,
      createdBy: actId,
    });

    await AuditService.log({
      actorId: actId,
      action: "CUSTOMER_PAYMENT_RECORDED",
      entityType: "payment",
      entityId: String(payment._id),
      afterSnapshot: {
        paymentNumber,
        amount,
        customerName: customer.shopName,
      },
    });

    return payment;
  }

  /**
   * Record Vendor Payment
   */
  static async recordVendorPayment(
    input: RecordVendorPaymentInput
  ): Promise<IPayment> {
    const vId = new mongoose.Types.ObjectId(String(input.vendorId));
    const aId = new mongoose.Types.ObjectId(String(input.accountId));
    const actId = input.actorId ? new mongoose.Types.ObjectId(String(input.actorId)) : undefined;

    if (input.idempotencyKey) {
      const existing = await Payment.findOne({ idempotencyKey: input.idempotencyKey });
      if (existing) {
        return existing;
      }
    }

    const vendor = await Vendor.findById(vId);
    if (!vendor) {
      throw new Error("Vendor not found");
    }

    const account = await Account.findById(aId);
    if (!account) {
      throw new Error("Payment disbursement account not found");
    }

    const amount = Number(input.amount);
    if (amount <= 0) {
      throw new Error("Payment amount must be greater than zero");
    }

    const paymentNumber = generateReferenceCode(
      "PMT-VEND",
      Math.floor(Math.random() * 9000 + 1000)
    );

    const allocations: IPaymentAllocation[] = [];

    // Process purchase allocations
    if (input.allocations && input.allocations.length > 0) {
      for (const alloc of input.allocations) {
        const purId = new mongoose.Types.ObjectId(String(alloc.purchaseId));
        const allocAmount = Number(alloc.amount);
        if (allocAmount <= 0) continue;

        const purchase = await Purchase.findById(purId);
        if (purchase) {
          purchase.paidAmount = Math.round((purchase.paidAmount + allocAmount) * 100) / 100;
          purchase.balanceDue = Math.max(
            0,
            Math.round((purchase.grandTotal - purchase.paidAmount) * 100) / 100
          );
          await purchase.save();

          allocations.push({
            invoiceType: "purchase",
            invoiceId: purId,
            referenceNumber: purchase.purchaseNumber,
            amountAllocated: allocAmount,
          });
        }
      }
    }

    // Update Vendor Payable
    vendor.currentPayable =
      Math.round((vendor.currentPayable - amount) * 100) / 100;
    await vendor.save();

    // Double-Entry: Debit Accounts Payable, Credit Cash/Bank/MFS
    let journalEntryId: mongoose.Types.ObjectId | undefined;
    try {
      const apAccount = await AccountingService.getAccountBySubType("accounts_payable");

      const je = await AccountingService.postJournalEntry({
        referenceType: "vendor_payment",
        referenceId: paymentNumber,
        narration: `Payment to vendor ${vendor.companyName} via ${input.paymentMethod}`,
        lines: [
          {
            accountId: apAccount._id as mongoose.Types.ObjectId,
            debit: amount,
            credit: 0,
            description: `Payable reduced for ${vendor.companyName}`,
          },
          {
            accountId: aId,
            debit: 0,
            credit: amount,
            description: `Disbursement from ${account.name}`,
          },
        ],
        postedBy: actId,
      });
      journalEntryId = je._id as mongoose.Types.ObjectId;
    } catch (accErr) {
      console.error("[PaymentService.recordVendorPayment] Accounting error:", accErr);
    }

    const payment = await Payment.create({
      paymentNumber,
      paymentType: "vendor_payment",
      vendorId: vId,
      accountId: aId,
      paymentMethod: input.paymentMethod,
      transactionReference: input.transactionReference,
      amount,
      date: input.date || new Date(),
      status: "verified",
      allocations,
      notes: input.notes,
      idempotencyKey: input.idempotencyKey,
      journalEntryId,
      createdBy: actId,
    });

    await AuditService.log({
      actorId: actId,
      action: "VENDOR_PAYMENT_RECORDED",
      entityType: "payment",
      entityId: String(payment._id),
      afterSnapshot: {
        paymentNumber,
        amount,
        vendorName: vendor.companyName,
      },
    });

    return payment;
  }
}
