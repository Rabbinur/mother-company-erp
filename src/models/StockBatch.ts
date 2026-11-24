import mongoose, { Schema, Document, Model } from "mongoose";

export interface IStockBatch extends Document {
  businessId: mongoose.Types.ObjectId;
  dealershipId: mongoose.Types.ObjectId;
  warehouseId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  variantId: mongoose.Types.ObjectId;
  supplierId?: mongoose.Types.ObjectId | null;
  principalCompanyId?: mongoose.Types.ObjectId | null;
  batchNumber?: string;
  purchaseInvoiceRef?: string;
  challanNumber?: string;
  receiptDate: Date;
  manufacturingDate?: Date | null;
  expiryDate?: Date | null;

  // Quantity Breakdown
  purchasedQuantity: number;
  supplierSchemeFreeQuantity: number;
  manualFreeQuantity: number;
  totalReceivedQuantity: number;
  remainingQuantity: number; // Consumed via FIFO/FEFO
  reservedQuantity: number;

  // Cost Snapshot (Immutable Landed Cost)
  grossPurchasePrice: number;
  lineDiscount: number;
  allocatedFreight: number;
  allocatedHandling: number;
  netLandedUnitCost: number; // ((gross - discount) + freight + handling) / totalReceivedQuantity
  currency: string;

  status: "active" | "depleted" | "expired" | "quarantined";
  createdAt: Date;
  updatedAt: Date;
}

const StockBatchSchema = new Schema<IStockBatch>(
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
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      default: null,
      index: true,
    },
    principalCompanyId: {
      type: Schema.Types.ObjectId,
      ref: "PrincipalCompany",
      default: null,
      index: true,
    },
    batchNumber: { type: String, trim: true, index: true },
    purchaseInvoiceRef: { type: String, trim: true, index: true },
    challanNumber: { type: String, trim: true, index: true },
    receiptDate: { type: Date, default: Date.now, index: true },
    manufacturingDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null, index: true },

    purchasedQuantity: { type: Number, required: true, min: 0 },
    supplierSchemeFreeQuantity: { type: Number, default: 0, min: 0 },
    manualFreeQuantity: { type: Number, default: 0, min: 0 },
    totalReceivedQuantity: { type: Number, required: true, min: 1 },
    remainingQuantity: { type: Number, required: true, min: 0 },
    reservedQuantity: { type: Number, default: 0, min: 0 },

    grossPurchasePrice: { type: Number, required: true, min: 0 },
    lineDiscount: { type: Number, default: 0, min: 0 },
    allocatedFreight: { type: Number, default: 0, min: 0 },
    allocatedHandling: { type: Number, default: 0, min: 0 },
    netLandedUnitCost: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "BDT", trim: true },

    status: {
      type: String,
      enum: ["active", "depleted", "expired", "quarantined"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);

// FIFO query index (oldest receipt first)
StockBatchSchema.index({
  dealershipId: 1,
  productId: 1,
  variantId: 1,
  status: 1,
  receiptDate: 1,
});

// FEFO query index (soonest expiry first)
StockBatchSchema.index({
  dealershipId: 1,
  productId: 1,
  variantId: 1,
  status: 1,
  expiryDate: 1,
});

StockBatchSchema.index({ businessId: 1, dealershipId: 1, warehouseId: 1 });

export const StockBatch: Model<IStockBatch> =
  mongoose.models.StockBatch ||
  mongoose.model<IStockBatch>("StockBatch", StockBatchSchema);
