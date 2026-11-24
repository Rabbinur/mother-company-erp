import mongoose, { Schema, Document, Model } from "mongoose";

export interface IProduct extends Document {
  businessId?: mongoose.Types.ObjectId;
  principalCompanyId?: mongoose.Types.ObjectId | null;
  name: string;
  slug: string;
  sku: string;
  code?: string;
  barcode?: string;
  description?: string;
  categoryId: mongoose.Types.ObjectId;
  brandId?: mongoose.Types.ObjectId | null;
  unit: string;
  uom?: string;
  productType: "simple" | "variable" | "service";
  hasVariants: boolean;
  images: string[];
  status: "active" | "inactive" | "archived";
  minStock: number;
  maxStock?: number;
  reorderLevel: number;
  taxRate: number; // percentage (e.g. 0, 5, 15)
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: false,
      index: true,
    },
    principalCompanyId: {
      type: Schema.Types.ObjectId,
      ref: "PrincipalCompany",
      default: null,
      index: true,
    },
    name: { type: String, required: true, trim: true, index: true },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    sku: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    code: { type: String, trim: true, index: true },
    barcode: { type: String, trim: true, index: true },
    description: { type: String, trim: true },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    brandId: {
      type: Schema.Types.ObjectId,
      ref: "Brand",
      default: null,
      index: true,
    },
    unit: { type: String, default: "pcs", trim: true },
    uom: { type: String, default: "pcs", trim: true },
    productType: {
      type: String,
      enum: ["simple", "variable", "service"],
      default: "simple",
      index: true,
    },
    hasVariants: { type: Boolean, default: false },
    images: [{ type: String }],
    status: {
      type: String,
      enum: ["active", "inactive", "archived"],
      default: "active",
      index: true,
    },
    minStock: { type: Number, default: 5, min: 0 },
    maxStock: { type: Number, min: 0 },
    reorderLevel: { type: Number, default: 10, min: 0 },
    taxRate: { type: Number, default: 0, min: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

ProductSchema.index({ businessId: 1, sku: 1 });
ProductSchema.index({ businessId: 1, status: 1 });
ProductSchema.index({ name: "text", sku: "text", barcode: "text" });

export const Product: Model<IProduct> =
  mongoose.models.Product || mongoose.model<IProduct>("Product", ProductSchema);
