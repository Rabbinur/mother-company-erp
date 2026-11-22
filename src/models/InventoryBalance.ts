import mongoose, { Schema, Document, Model } from "mongoose";

export interface IInventoryBalance extends Document {
  warehouseId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  variantId: mongoose.Types.ObjectId;
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  damagedQuantity: number;
  stockInTransit: number;
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryBalanceSchema = new Schema<IInventoryBalance>(
  {
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
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
    onHandQuantity: { type: Number, default: 0, min: 0 },
    reservedQuantity: { type: Number, default: 0, min: 0 },
    availableQuantity: { type: Number, default: 0 },
    damagedQuantity: { type: Number, default: 0, min: 0 },
    stockInTransit: { type: Number, default: 0, min: 0 },
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Compound unique index so each variant in a warehouse has one balance record
InventoryBalanceSchema.index(
  { warehouseId: 1, productId: 1, variantId: 1 },
  { unique: true }
);

export const InventoryBalance: Model<IInventoryBalance> =
  mongoose.models.InventoryBalance ||
  mongoose.model<IInventoryBalance>(
    "InventoryBalance",
    InventoryBalanceSchema
  );
