import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPrincipalCompany extends Document {
  businessId: mongoose.Types.ObjectId;
  name: string;
  code: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  status: "active" | "inactive";
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PrincipalCompanySchema = new Schema<IPrincipalCompany>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    contactPerson: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

PrincipalCompanySchema.index({ businessId: 1, code: 1 }, { unique: true });

export const PrincipalCompany: Model<IPrincipalCompany> =
  mongoose.models.PrincipalCompany ||
  mongoose.model<IPrincipalCompany>("PrincipalCompany", PrincipalCompanySchema);
