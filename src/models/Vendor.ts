import mongoose, { Schema, Document, Model } from "mongoose";

export interface IVendor extends Document {
  businessId?: mongoose.Types.ObjectId;
  code?: string;
  name: string;
  companyName: string;
  phone: string;
  email?: string;
  address?: string;
  contactPerson?: string;
  taxVatNumber?: string;
  principalCompanyId?: mongoose.Types.ObjectId | null;
  paymentTerms?: "cash" | "net7" | "net15" | "net30" | "net45" | "net60" | "custom";
  customPaymentTermsDays?: number;
  openingBalance: number;
  currentPayable: number;
  status: "active" | "inactive";
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VendorSchema = new Schema<IVendor>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      index: true,
    },
    code: {
      type: String,
      uppercase: true,
      trim: true,
      sparse: true,
    },
    name: { type: String, required: true, trim: true },
    companyName: { type: String, required: true, trim: true, index: true },
    phone: { type: String, required: true, trim: true, index: true },
    email: { type: String, lowercase: true, trim: true },
    address: { type: String, trim: true },
    contactPerson: { type: String, trim: true },
    taxVatNumber: { type: String, trim: true },
    principalCompanyId: {
      type: Schema.Types.ObjectId,
      ref: "PrincipalCompany",
      default: null,
      index: true,
    },
    paymentTerms: {
      type: String,
      enum: ["cash", "net7", "net15", "net30", "net45", "net60", "custom"],
      default: "net30",
    },
    customPaymentTermsDays: { type: Number, default: 30 },
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

VendorSchema.index({ businessId: 1, code: 1 }, { unique: true, sparse: true });
VendorSchema.index({ businessId: 1, phone: 1 });
VendorSchema.index({ companyName: "text", name: "text", phone: "text" });

export const Vendor: Model<IVendor> =
  mongoose.models.Vendor || mongoose.model<IVendor>("Vendor", VendorSchema);

// Export Supplier alias to explicitly fulfill Supplier management requirements without model duplication
export const Supplier = Vendor;
export type ISupplier = IVendor;
