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
  | "correction"
  | "warehouse_transfer_in"
  | "warehouse_transfer_out"
  | "physical_count_adjustment"
  | "dispatch_load"
  | "dispatch_unload"
  | "undelivered_return";

export interface IStockMovement extends Document {
  movementNumber: string;
  type: StockMovementType;
  businessId?: mongoose.Types.ObjectId;
  dealershipId?: mongoose.Types.ObjectId | null;
  productId: mongoose.Types.ObjectId;
  variantId: mongoose.Types.ObjectId;
  warehouseId: mongoose.Types.ObjectId;
  batchId?: mongoose.Types.ObjectId;
  batchNumber?: string;
  quantity: number; // positive or negative
  unitCost?: number;
  totalCost?: number;
  previousOnHand: number;
  newOnHand: number;
  previousReserved: number;
  newReserved: number;
  referenceType?: string; // e.g. "purchase", "order", "transfer", "count"
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
        "warehouse_transfer_in",
        "warehouse_transfer_out",
        "physical_count_adjustment",
        "dispatch_load",
        "dispatch_unload",
        "undelivered_return",
      ],
      index: true,
    },
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      index: true,
    },
    dealershipId: {
      type: Schema.Types.ObjectId,
      ref: "Dealership",
      default: null,
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
    batchId: {
      type: Schema.Types.ObjectId,
      ref: "StockBatch",
      index: true,
    },
    batchNumber: { type: String, trim: true },
    quantity: { type: Number, required: true },
    unitCost: { type: Number },
    totalCost: { type: Number },
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
StockMovementSchema.index({ dealershipId: 1, createdAt: -1 });
StockMovementSchema.index({ businessId: 1, dealershipId: 1, warehouseId: 1 });

export const StockMovement: Model<IStockMovement> =
  mongoose.models.StockMovement ||
  mongoose.model<IStockMovement>("StockMovement", StockMovementSchema);
