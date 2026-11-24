import mongoose, { Schema, Document, Model } from "mongoose";

export interface IVariantAttribute {
  name: string; // e.g. "Size", "Color"
  value: string; // e.g. "XL", "Navy Blue"
}

export interface IProductVariant extends Document {
  businessId?: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  variantName: string; // e.g. "XL / Navy Blue" or "Default"
  sku: string;
  barcode?: string;
  attributes: IVariantAttribute[];
  purchasePrice: number; // Confidential Acquisition Cost (BDT)
  customerPrice: number; // Sales Price to Customers / Retailers (BDT)
  retailPrice: number; // Suggested Resale Retail Price (BDT)
  image?: string;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

const ProductVariantSchema = new Schema<IProductVariant>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: false,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    variantName: { type: String, required: true, trim: true },
    sku: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    barcode: { type: String, trim: true, index: true },
    attributes: [
      {
        name: { type: String, required: true, trim: true },
        value: { type: String, required: true, trim: true },
      },
    ],
    purchasePrice: { type: Number, required: true, min: 0 },
    customerPrice: { type: Number, required: true, min: 0 },
    retailPrice: { type: Number, required: true, min: 0 },
    image: { type: String, trim: true },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);

ProductVariantSchema.index({ productId: 1, sku: 1 });
ProductVariantSchema.index({ businessId: 1, sku: 1 });

export const ProductVariant: Model<IProductVariant> =
  mongoose.models.ProductVariant ||
  mongoose.model<IProductVariant>("ProductVariant", ProductVariantSchema);
