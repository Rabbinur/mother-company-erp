import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPaymentAllocation {
  invoiceType: "order" | "purchase";
  invoiceId: mongoose.Types.ObjectId;
  referenceNumber: string;
  amountAllocated: number;
}

export interface IPayment extends Document {
  paymentNumber: string;
  paymentType: "customer_receipt" | "vendor_payment";
  customerId?: mongoose.Types.ObjectId;
  vendorId?: mongoose.Types.ObjectId;
  accountId: mongoose.Types.ObjectId;
  paymentMethod: "cash" | "bank_transfer" | "bkash" | "nagad" | "rocket" | "other";
  transactionReference?: string;
  amount: number;
  date: Date;
  status: "verified" | "pending" | "cancelled";
  allocations: IPaymentAllocation[];
  notes?: string;
  idempotencyKey?: string;
  journalEntryId?: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentAllocationSchema = new Schema<IPaymentAllocation>(
  {
    invoiceType: {
      type: String,
      enum: ["order", "purchase"],
      required: true,
    },
    invoiceId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    referenceNumber: { type: String, required: true },
    amountAllocated: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const PaymentSchema = new Schema<IPayment>(
  {
    paymentNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    paymentType: {
      type: String,
      enum: ["customer_receipt", "vendor_payment"],
      required: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      index: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      index: true,
    },
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "bank_transfer", "bkash", "nagad", "rocket", "other"],
      default: "cash",
      index: true,
    },
    transactionReference: { type: String, trim: true },
    amount: { type: Number, required: true, min: 0.01 },
    date: { type: Date, default: Date.now, index: true },
    status: {
      type: String,
      enum: ["verified", "pending", "cancelled"],
      default: "verified",
      index: true,
    },
    allocations: [PaymentAllocationSchema],
    notes: { type: String, trim: true },
    idempotencyKey: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    journalEntryId: {
      type: Schema.Types.ObjectId,
      ref: "JournalEntry",
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const Payment: Model<IPayment> =
  mongoose.models.Payment || mongoose.model<IPayment>("Payment", PaymentSchema);
