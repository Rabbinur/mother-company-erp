import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPriceHistory extends Document {
  productId: mongoose.Types.ObjectId;
  variantId: mongoose.Types.ObjectId;
  oldPurchasePrice: number;
  newPurchasePrice: number;
  oldCustomerPrice: number;
  newCustomerPrice: number;
  oldRetailPrice: number;
  newRetailPrice: number;
  changedBy?: mongoose.Types.ObjectId;
  reason?: string;
  effectiveDate: Date;
  createdAt: Date;
}

const PriceHistorySchema = new Schema<IPriceHistory>(
  {
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
    oldPurchasePrice: { type: Number, required: true },
    newPurchasePrice: { type: Number, required: true },
    oldCustomerPrice: { type: Number, required: true },
    newCustomerPrice: { type: Number, required: true },
    oldRetailPrice: { type: Number, required: true },
    newRetailPrice: { type: Number, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reason: { type: String, trim: true },
    effectiveDate: { type: Date, default: Date.now, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const PriceHistory: Model<IPriceHistory> =
  mongoose.models.PriceHistory ||
  mongoose.model<IPriceHistory>("PriceHistory", PriceHistorySchema);
