import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISalesReturnItem {
  productId: mongoose.Types.ObjectId;
  variantId: mongoose.Types.ObjectId;
  name: string;
  sku: string;
  returnedQuantity: number;
  customerPriceSnapshot: number;
  condition: "good" | "damaged";
  restockEligible: boolean;
  refundAmount: number;
}

export interface ISalesReturn extends Document {
  returnNumber: string;
  orderId: mongoose.Types.ObjectId;
  orderNumber: string;
  customerId: mongoose.Types.ObjectId;
  warehouseId: mongoose.Types.ObjectId;
  items: ISalesReturnItem[];
  totalRefundAmount: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "completed";
  restocked: boolean;
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
    returnedQuantity: { type: Number, required: true, min: 1 },
    customerPriceSnapshot: { type: Number, required: true, min: 0 },
    condition: {
      type: String,
      enum: ["good", "damaged"],
      default: "good",
    },
    restockEligible: { type: Boolean, default: true },
    refundAmount: { type: Number, required: true, min: 0 },
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
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
      index: true,
    },
    items: [SalesReturnItemSchema],
    totalRefundAmount: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "completed"],
      default: "completed",
      index: true,
    },
    restocked: { type: Boolean, default: false },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const SalesReturn: Model<ISalesReturn> =
  mongoose.models.SalesReturn ||
  mongoose.model<ISalesReturn>("SalesReturn", SalesReturnSchema);
