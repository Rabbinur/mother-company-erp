import mongoose, { Schema, Document, Model } from "mongoose";

export interface IDealership extends Document {
  businessId: mongoose.Types.ObjectId;
  principalCompanyId?: mongoose.Types.ObjectId;
  name: string;
  code: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  status: "active" | "inactive";
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DealershipSchema = new Schema<IDealership>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    principalCompanyId: {
      type: Schema.Types.ObjectId,
      ref: "PrincipalCompany",
      required: false,
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
    contactPhone: { type: String, trim: true },
    contactEmail: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

DealershipSchema.index({ businessId: 1, code: 1 }, { unique: true });

export const Dealership: Model<IDealership> =
  mongoose.models.Dealership ||
  mongoose.model<IDealership>("Dealership", DealershipSchema);
