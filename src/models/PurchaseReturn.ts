import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPurchaseReturnItem {
  productId: mongoose.Types.ObjectId;
  variantId: mongoose.Types.ObjectId;
  name: string;
  sku: string;
  returnedQuantity: number;
  unitCostSnapshot: number;
  debitAmount: number;
}

export interface IPurchaseReturn extends Document {
  returnNumber: string;
  purchaseId: mongoose.Types.ObjectId;
  purchaseNumber: string;
  vendorId: mongoose.Types.ObjectId;
  warehouseId: mongoose.Types.ObjectId;
  items: IPurchaseReturnItem[];
  totalDebitAmount: number;
  reason: string;
  status: "pending" | "approved" | "completed";
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
    name: { type: String, required: true },
    sku: { type: String, required: true },
    returnedQuantity: { type: Number, required: true, min: 1 },
    unitCostSnapshot: { type: Number, required: true, min: 0 },
    debitAmount: { type: Number, required: true, min: 0 },
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
    purchaseId: {
      type: Schema.Types.ObjectId,
      ref: "Purchase",
      required: true,
      index: true,
    },
    purchaseNumber: { type: String, required: true, trim: true, index: true },
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
    items: [PurchaseReturnItemSchema],
    totalDebitAmount: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["pending", "approved", "completed"],
      default: "completed",
      index: true,
    },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const PurchaseReturn: Model<IPurchaseReturn> =
  mongoose.models.PurchaseReturn ||
  mongoose.model<IPurchaseReturn>("PurchaseReturn", PurchaseReturnSchema);
