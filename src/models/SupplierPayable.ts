import mongoose, { Schema, Document, Model } from "mongoose";

export type SupplierPayableStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";

export interface ISupplierPayable extends Document {
  businessId: mongoose.Types.ObjectId;
  dealershipId: mongoose.Types.ObjectId;
  supplierId: mongoose.Types.ObjectId; // References Vendor
  principalCompanyId?: mongoose.Types.ObjectId | null;
  grnId: mongoose.Types.ObjectId; // References GoodsReceiptNote
  purchaseOrderId?: mongoose.Types.ObjectId | null; // References Purchase / PurchaseOrder

  payableNumber: string; // e.g. PAYABLE-202611-XXXX
  invoiceNumber: string;
  invoiceDate: Date;
  challanNumber: string;

  grossAmount: number;
  earnedDiscounts: number;
  conditionalCashDiscount: number; // Eligible if paid within cash terms
  freightCharge: number;
  handlingCharge: number;
  taxAmount: number;
  netPayable: number;
  paidAmount: number;
  outstandingBalance: number;

  status: SupplierPayableStatus;
  dueDate?: Date;
  isCancelled: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const SupplierPayableSchema = new Schema<ISupplierPayable>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    dealershipId: {
      type: Schema.Types.ObjectId,
      ref: "Dealership",
      required: true,
      index: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },
    principalCompanyId: {
      type: Schema.Types.ObjectId,
      ref: "PrincipalCompany",
      default: null,
      index: true,
    },
    grnId: {
      type: Schema.Types.ObjectId,
      ref: "GoodsReceiptNote",
      required: true,
      index: true,
    },
    purchaseOrderId: {
      type: Schema.Types.ObjectId,
      ref: "Purchase",
      default: null,
      index: true,
    },
    payableNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    invoiceDate: {
      type: Date,
      required: true,
    },
    challanNumber: {
      type: String,
      required: true,
      trim: true,
    },
    grossAmount: { type: Number, required: true, min: 0 },
    earnedDiscounts: { type: Number, default: 0, min: 0 },
    conditionalCashDiscount: { type: Number, default: 0, min: 0 },
    freightCharge: { type: Number, default: 0, min: 0 },
    handlingCharge: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    netPayable: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    outstandingBalance: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["UNPAID", "PARTIALLY_PAID", "PAID", "CANCELLED"],
      default: "UNPAID",
      index: true,
    },
    dueDate: { type: Date },
    isCancelled: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

SupplierPayableSchema.index({ businessId: 1, dealershipId: 1, status: 1 });
SupplierPayableSchema.index({ businessId: 1, supplierId: 1, status: 1 });
SupplierPayableSchema.index(
  { businessId: 1, supplierId: 1, invoiceNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { isCancelled: false },
    name: "uniq_payable_business_supplier_invoice",
  }
);

export const SupplierPayable: Model<ISupplierPayable> =
  mongoose.models.SupplierPayable ||
  mongoose.model<ISupplierPayable>("SupplierPayable", SupplierPayableSchema);
