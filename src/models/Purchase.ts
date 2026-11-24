import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPurchaseItem {
  productId: mongoose.Types.ObjectId;
  variantId: mongoose.Types.ObjectId;
  name: string;
  sku: string;
  orderedQuantity: number;
  receivedQuantity: number;
  remainingQuantity?: number;
  unitCost: number;
  discount: number;
  tax: number;
  subtotal: number;
  supplierSchemeInfo?: string;
}

export type PurchaseOrderStatus =
  | "draft"
  | "ordered"
  | "submitted"
  | "partially_received"
  | "received"
  | "fully_received"
  | "cancelled"
  | "DRAFT"
  | "SUBMITTED"
  | "PARTIALLY_RECEIVED"
  | "FULLY_RECEIVED"
  | "CANCELLED";

export interface IPurchase extends Document {
  businessId?: mongoose.Types.ObjectId;
  dealershipId?: mongoose.Types.ObjectId;
  principalCompanyId?: mongoose.Types.ObjectId | null;
  purchaseNumber: string;
  vendorId: mongoose.Types.ObjectId;
  warehouseId: mongoose.Types.ObjectId;
  status: PurchaseOrderStatus;
  items: IPurchaseItem[];
  grnIds?: mongoose.Types.ObjectId[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  paidAmount: number;
  balanceDue: number;
  orderDate: Date;
  expectedDate?: Date;
  receivedDate?: Date;
  submittedAt?: Date;
  submittedBy?: mongoose.Types.ObjectId;
  cancelledAt?: Date;
  cancelledBy?: mongoose.Types.ObjectId;
  cancellationReason?: string;
  notes?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseItemSchema = new Schema<IPurchaseItem>(
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
    orderedQuantity: { type: Number, required: true, min: 1 },
    receivedQuantity: { type: Number, default: 0, min: 0 },
    remainingQuantity: { type: Number, default: 0, min: 0 },
    unitCost: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
    supplierSchemeInfo: { type: String, trim: true },
  },
  { _id: false }
);

const PurchaseSchema = new Schema<IPurchase>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      index: true,
    },
    dealershipId: {
      type: Schema.Types.ObjectId,
      ref: "Dealership",
      index: true,
    },
    principalCompanyId: {
      type: Schema.Types.ObjectId,
      ref: "PrincipalCompany",
      default: null,
      index: true,
    },
    purchaseNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
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
    status: {
      type: String,
      enum: [
        "draft",
        "ordered",
        "submitted",
        "partially_received",
        "received",
        "fully_received",
        "cancelled",
        "DRAFT",
        "SUBMITTED",
        "PARTIALLY_RECEIVED",
        "FULLY_RECEIVED",
        "CANCELLED",
      ],
      default: "DRAFT",
      index: true,
    },
    items: [PurchaseItemSchema],
    grnIds: [{ type: Schema.Types.ObjectId, ref: "GoodsReceiptNote" }],
    subtotal: { type: Number, required: true, min: 0 },
    discountTotal: { type: Number, default: 0, min: 0 },
    taxTotal: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    balanceDue: { type: Number, required: true, min: 0 },
    orderDate: { type: Date, default: Date.now, index: true },
    expectedDate: { type: Date },
    receivedDate: { type: Date },
    submittedAt: { type: Date },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User" },
    cancelledAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
    cancellationReason: { type: String, trim: true },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

PurchaseSchema.index({ businessId: 1, dealershipId: 1, status: 1 });
PurchaseSchema.index({ businessId: 1, vendorId: 1 });

export const Purchase: Model<IPurchase> =
  mongoose.models.Purchase ||
  mongoose.model<IPurchase>("Purchase", PurchaseSchema);

// Explicit aliases for Purchase Order
export const PurchaseOrder = Purchase;
export type IPurchaseOrder = IPurchase;
