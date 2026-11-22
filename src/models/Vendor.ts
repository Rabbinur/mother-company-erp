import mongoose, { Schema, Document, Model } from "mongoose";

export interface IVendor extends Document {
  name: string;
  companyName: string;
  phone: string;
  email?: string;
  address?: string;
  contactPerson?: string;
  taxVatNumber?: string;
  openingBalance: number;
  currentPayable: number;
  status: "active" | "inactive";
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VendorSchema = new Schema<IVendor>(
  {
    name: { type: String, required: true, trim: true },
    companyName: { type: String, required: true, trim: true, index: true },
    phone: { type: String, required: true, trim: true, index: true },
    email: { type: String, lowercase: true, trim: true },
    address: { type: String, trim: true },
    contactPerson: { type: String, trim: true },
    taxVatNumber: { type: String, trim: true },
    openingBalance: { type: Number, default: 0 },
    currentPayable: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

VendorSchema.index({ companyName: "text", name: "text", phone: "text" });

export const Vendor: Model<IVendor> =
  mongoose.models.Vendor || mongoose.model<IVendor>("Vendor", VendorSchema);
