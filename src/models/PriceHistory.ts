import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPriceHistory extends Document {
  businessId?: mongoose.Types.ObjectId;
  dealershipId?: mongoose.Types.ObjectId | null;
  productId: mongoose.Types.ObjectId;
  variantId?: mongoose.Types.ObjectId | null;
  oldPurchasePrice: number;
  newPurchasePrice: number;
  oldCustomerPrice: number;
  newCustomerPrice: number;
  oldRetailPrice: number;
  newRetailPrice: number;
  currency: string;
  changedBy?: mongoose.Types.ObjectId;
  reason?: string;
  effectiveDate: Date;
  createdAt: Date;
}

const PriceHistorySchema = new Schema<IPriceHistory>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: false,
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
      default: null,
      index: true,
    },
    oldPurchasePrice: { type: Number, required: true },
    newPurchasePrice: { type: Number, required: true },
    oldCustomerPrice: { type: Number, required: true },
    newCustomerPrice: { type: Number, required: true },
    oldRetailPrice: { type: Number, required: true },
    newRetailPrice: { type: Number, required: true },
    currency: { type: String, default: "BDT" },
    changedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reason: { type: String, trim: true },
    effectiveDate: { type: Date, default: Date.now, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

PriceHistorySchema.index({ productId: 1, variantId: 1, createdAt: -1 });
PriceHistorySchema.index({ businessId: 1, dealershipId: 1, createdAt: -1 });

export const PriceHistory: Model<IPriceHistory> =
  mongoose.models.PriceHistory ||
  mongoose.model<IPriceHistory>("PriceHistory", PriceHistorySchema);
