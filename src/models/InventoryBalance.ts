import mongoose, { Schema, Document, Model } from "mongoose";

export interface IInventoryBalance extends Document {
  businessId: mongoose.Types.ObjectId;
  dealershipId?: mongoose.Types.ObjectId | null;
  warehouseId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  variantId: mongoose.Types.ObjectId;
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  damagedQuantity: number;
  stockInTransit: number;
  quarantineReason?: string;
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryBalanceSchema = new Schema<IInventoryBalance>(
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
      default: null,
      index: true,
    },
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
    quarantineReason: { type: String, trim: true },
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Active dealership inventory balance compound index
InventoryBalanceSchema.index(
  {
    businessId: 1,
    dealershipId: 1,
    warehouseId: 1,
    productId: 1,
    variantId: 1,
  },
  {
    unique: true,
    partialFilterExpression: { dealershipId: { $type: "objectId" } },
  }
);

// Quarantined inventory balance compound index
InventoryBalanceSchema.index(
  {
    businessId: 1,
    warehouseId: 1,
    productId: 1,
    variantId: 1,
  },
  {
    unique: true,
    partialFilterExpression: { dealershipId: null },
  }
);

InventoryBalanceSchema.index({ dealershipId: 1, productId: 1, variantId: 1 });
InventoryBalanceSchema.index({ warehouseId: 1, productId: 1 });

export const InventoryBalance: Model<IInventoryBalance> =
  mongoose.models.InventoryBalance ||
  mongoose.model<IInventoryBalance>(
    "InventoryBalance",
    InventoryBalanceSchema
  );
