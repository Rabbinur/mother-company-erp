import mongoose, { Schema, Document, Model } from "mongoose";

export type SalesReturnStatus =
  | "REQUESTED"
  | "RECEIVED"
  | "UNDER_INSPECTION"
  | "APPROVED"
  | "REJECTED"
  | "RESTOCKED"
  | "REFUND_PENDING"
  | "REFUNDED"
  | "CREDIT_NOTE_ISSUED"
  | "CLOSED"
  | "pending"
  | "approved"
  | "rejected"
  | "completed";

export type InspectionClassification =
  | "GOOD_RESTOCKABLE"
  | "DAMAGED"
  | "EXPIRED"
  | "WRONG_PRODUCT"
  | "QUARANTINED"
  | "REJECTED";

export interface ISalesReturnItem {
  productId: mongoose.Types.ObjectId;
  variantId: mongoose.Types.ObjectId;
  name: string;
  sku: string;
  batchId?: mongoose.Types.ObjectId;
  batchNumber?: string;
  returnedQuantity: number;
  customerPriceSnapshot: number;
  condition: "good" | "damaged" | "expired" | "wrong_product";
  inspectionClassification?: InspectionClassification;
  restockEligible: boolean;
  refundAmount: number;
  deductionAmount?: number;
}

export interface ISalesReturn extends Document {
  returnNumber: string;
  businessId: mongoose.Types.ObjectId;
  dealershipId: mongoose.Types.ObjectId;
  dispatchId?: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  orderNumber: string;
  customerId: mongoose.Types.ObjectId;
  customerDealershipAccountId?: mongoose.Types.ObjectId;
  warehouseId: mongoose.Types.ObjectId;
  items: ISalesReturnItem[];
  totalRefundAmount: number;
  totalDeductionAmount?: number;
  netRefundAmount?: number;
  reason: string;
  status: SalesReturnStatus;
  restocked: boolean;
  restockedAt?: Date;
  refundStatus?: "NONE" | "NOT_APPLICABLE" | "PENDING" | "REFUNDED" | "CREDIT_NOTE_ISSUED" | "REJECTED";
  refundMethod?: "credit_note" | "cash" | "bank_transfer" | "adjustment";
  refundReference?: string;
  refundedAmount?: number;
  refundedAt?: Date;
  inspectionNotes?: string;
  inspectedBy?: mongoose.Types.ObjectId;
  inspectedAt?: Date;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;
  evidenceAttachments?: string[];
  notes?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SalesReturnItemSchema = new Schema<ISalesReturnItem>(
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
    name: { type: String, required: true },
    sku: { type: String, required: true },
    batchId: { type: Schema.Types.ObjectId, ref: "StockBatch" },
    batchNumber: { type: String, trim: true },
    returnedQuantity: { type: Number, required: true, min: 1 },
    customerPriceSnapshot: { type: Number, required: true, min: 0 },
    condition: {
      type: String,
      enum: ["good", "damaged", "expired", "wrong_product"],
      default: "good",
    },
    inspectionClassification: {
      type: String,
      enum: [
        "GOOD_RESTOCKABLE",
        "DAMAGED",
        "EXPIRED",
        "WRONG_PRODUCT",
        "QUARANTINED",
        "REJECTED",
      ],
    },
    restockEligible: { type: Boolean, default: true },
    refundAmount: { type: Number, required: true, min: 0 },
    deductionAmount: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const SalesReturnSchema = new Schema<ISalesReturn>(
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
    dispatchId: {
      type: Schema.Types.ObjectId,
      ref: "Dispatch",
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    orderNumber: { type: String, required: true, trim: true, index: true },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    customerDealershipAccountId: {
      type: Schema.Types.ObjectId,
      ref: "CustomerDealershipAccount",
      index: true,
    },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
      index: true,
    },
    items: [SalesReturnItemSchema],
    totalRefundAmount: { type: Number, required: true, min: 0 },
    totalDeductionAmount: { type: Number, default: 0, min: 0 },
    netRefundAmount: { type: Number, default: 0, min: 0 },
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: [
        "REQUESTED",
        "RECEIVED",
        "UNDER_INSPECTION",
        "APPROVED",
        "REJECTED",
        "RESTOCKED",
        "REFUND_PENDING",
        "REFUNDED",
        "CREDIT_NOTE_ISSUED",
        "CLOSED",
        "pending",
        "approved",
        "rejected",
        "completed",
      ],
      default: "REQUESTED",
      index: true,
    },
    restocked: { type: Boolean, default: false },
    restockedAt: { type: Date },
    refundStatus: {
      type: String,
      enum: ["NONE", "NOT_APPLICABLE", "PENDING", "REFUNDED", "CREDIT_NOTE_ISSUED", "REJECTED"],
      default: "NOT_APPLICABLE",
      index: true,
    },
    refundMethod: {
      type: String,
      enum: ["credit_note", "cash", "bank_transfer", "adjustment"],
    },
    refundReference: { type: String, trim: true },
    refundedAmount: { type: Number, min: 0 },
    refundedAt: { type: Date },
    inspectionNotes: { type: String, trim: true },
    inspectedBy: { type: Schema.Types.ObjectId, ref: "User" },
    inspectedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    rejectionReason: { type: String, trim: true },
    evidenceAttachments: [{ type: String, trim: true }],
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

SalesReturnSchema.index({ businessId: 1, dealershipId: 1, status: 1 });
SalesReturnSchema.index({ businessId: 1, orderId: 1 });
SalesReturnSchema.index({ businessId: 1, customerId: 1 });

export const SalesReturn: Model<ISalesReturn> =
  mongoose.models.SalesReturn ||
  mongoose.model<ISalesReturn>("SalesReturn", SalesReturnSchema);
