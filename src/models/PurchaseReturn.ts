import mongoose, { Schema, Document, Model } from "mongoose";

export type PurchaseReturnStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "DISPATCHED"
  | "SUPPLIER_ACKNOWLEDGED"
  | "CREDIT_NOTE_RECEIVED"
  | "SETTLED"
  | "REJECTED"
  | "CANCELLED"
  | "pending"
  | "approved"
  | "completed";

export interface IPurchaseReturnItem {
  productId: mongoose.Types.ObjectId;
  variantId: mongoose.Types.ObjectId;
  batchId?: mongoose.Types.ObjectId;
  batchNumber?: string;
  name: string;
  sku: string;
  returnedQuantity: number;
  unitCostSnapshot: number;
  debitAmount: number;
  reason?: string;
}

export interface IPurchaseReturn extends Document {
  returnNumber: string;
  businessId: mongoose.Types.ObjectId;
  dealershipId: mongoose.Types.ObjectId;
  grnId?: mongoose.Types.ObjectId;
  grnNumber?: string;
  purchaseId?: mongoose.Types.ObjectId;
  purchaseNumber?: string;
  vendorId: mongoose.Types.ObjectId;
  warehouseId: mongoose.Types.ObjectId;
  supplierPayableId?: mongoose.Types.ObjectId;
  items: IPurchaseReturnItem[];
  totalDebitAmount: number;
  settledAmount?: number;
  reason: string;
  status: PurchaseReturnStatus;
  supplierAuthorizationRef?: string;
  creditNoteNumber?: string;
  dispatchedAt?: Date;
  dispatchedBy?: mongoose.Types.ObjectId;
  settledAt?: Date;
  settlementType?: "payable_deduction" | "supplier_refund" | "replacement";
  rejectionReason?: string;
  notes?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseReturnItemSchema = new Schema<IPurchaseReturnItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variantId: {
      type: Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
    },
    batchId: {
      type: Schema.Types.ObjectId,
      ref: "StockBatch",
    },
    batchNumber: { type: String, trim: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    returnedQuantity: { type: Number, required: true, min: 1 },
    unitCostSnapshot: { type: Number, required: true, min: 0 },
    debitAmount: { type: Number, required: true, min: 0 },
    reason: { type: String, trim: true },
  },
  { _id: false }
);

const PurchaseReturnSchema = new Schema<IPurchaseReturn>(
  {
    returnNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
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
    grnId: {
      type: Schema.Types.ObjectId,
      ref: "GoodsReceiptNote",
      index: true,
    },
    grnNumber: { type: String, trim: true, index: true },
    purchaseId: {
      type: Schema.Types.ObjectId,
      ref: "Purchase",
      index: true,
    },
    purchaseNumber: { type: String, trim: true, index: true },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
      index: true,
    },
    supplierPayableId: {
      type: Schema.Types.ObjectId,
      ref: "SupplierPayable",
      index: true,
    },
    items: [PurchaseReturnItemSchema],
    totalDebitAmount: { type: Number, required: true, min: 0 },
    settledAmount: { type: Number, default: 0, min: 0 },
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: [
        "DRAFT",
        "SUBMITTED",
        "APPROVED",
        "DISPATCHED",
        "SUPPLIER_ACKNOWLEDGED",
        "CREDIT_NOTE_RECEIVED",
        "SETTLED",
        "REJECTED",
        "CANCELLED",
        "pending",
        "approved",
        "completed",
      ],
      default: "DRAFT",
      index: true,
    },
    supplierAuthorizationRef: { type: String, trim: true },
    creditNoteNumber: { type: String, trim: true },
    dispatchedAt: { type: Date },
    dispatchedBy: { type: Schema.Types.ObjectId, ref: "User" },
    settledAt: { type: Date },
    settlementType: {
      type: String,
      enum: ["payable_deduction", "supplier_refund", "replacement"],
    },
    rejectionReason: { type: String, trim: true },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

PurchaseReturnSchema.index({ businessId: 1, dealershipId: 1, status: 1 });
PurchaseReturnSchema.index({ businessId: 1, vendorId: 1 });
PurchaseReturnSchema.index({ businessId: 1, grnId: 1 });

export const PurchaseReturn: Model<IPurchaseReturn> =
  mongoose.models.PurchaseReturn ||
  mongoose.model<IPurchaseReturn>("PurchaseReturn", PurchaseReturnSchema);
