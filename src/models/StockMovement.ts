import mongoose, { Schema, Document, Model } from "mongoose";

export type StockMovementType =
  | "purchase_receive"
  | "sales_fulfillment"
  | "reservation"
  | "reservation_release"
  | "sales_return"
  | "purchase_return"
  | "manual_adjustment"
  | "damage"
  | "correction";

export interface IStockMovement extends Document {
  movementNumber: string;
  type: StockMovementType;
  productId: mongoose.Types.ObjectId;
  variantId: mongoose.Types.ObjectId;
  warehouseId: mongoose.Types.ObjectId;
  quantity: number; // positive or negative
  unitCost?: number;
  previousOnHand: number;
  newOnHand: number;
  previousReserved: number;
  newReserved: number;
  referenceType?: string; // e.g. "purchase", "order", "sales_return", "manual"
  referenceId?: string; // e.g. order number, purchase number
  notes?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const StockMovementSchema = new Schema<IStockMovement>(
  {
    movementNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        "purchase_receive",
        "sales_fulfillment",
        "reservation",
        "reservation_release",
        "sales_return",
        "purchase_return",
        "manual_adjustment",
        "damage",
        "correction",
      ],
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    variantId: {
      type: Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
      index: true,
    },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
      index: true,
    },
    quantity: { type: Number, required: true },
    unitCost: { type: Number },
    previousOnHand: { type: Number, required: true },
    newOnHand: { type: Number, required: true },
    previousReserved: { type: Number, required: true },
    newReserved: { type: Number, required: true },
    referenceType: { type: String, trim: true, index: true },
    referenceId: { type: String, trim: true, index: true },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

StockMovementSchema.index({ createdAt: -1 });

export const StockMovement: Model<IStockMovement> =
  mongoose.models.StockMovement ||
  mongoose.model<IStockMovement>("StockMovement", StockMovementSchema);
