import mongoose, { Schema, Document, Model } from "mongoose";

export interface IDealershipPrice extends Document {
  businessId: mongoose.Types.ObjectId;
  dealershipId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  variantId?: mongoose.Types.ObjectId | null;
  purchasePrice: number; // Confidential Acquisition Cost (BDT)
  customerPrice: number; // Dealership Selling Price (BDT)
  retailPrice: number;   // Suggested Retail Price / MSRP (BDT)
  currency: string;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  status: "active" | "inactive";
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DealershipPriceSchema = new Schema<IDealershipPrice>(
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
    purchasePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    customerPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    retailPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "BDT",
      trim: true,
    },
    effectiveFrom: {
      type: Date,
      default: Date.now,
      index: true,
    },
    effectiveTo: {
      type: Date,
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

DealershipPriceSchema.index(
  { dealershipId: 1, productId: 1, variantId: 1, status: 1, effectiveFrom: -1 }
);
DealershipPriceSchema.index({ businessId: 1, dealershipId: 1 });

export const DealershipPrice: Model<IDealershipPrice> =
  mongoose.models.DealershipPrice ||
  mongoose.model<IDealershipPrice>("DealershipPrice", DealershipPriceSchema);
