import mongoose, { Schema, Document, Model } from "mongoose";

export interface IWarehouse extends Document {
  businessId?: mongoose.Types.ObjectId;
  dealershipIds?: mongoose.Types.ObjectId[];
  name: string;
  code: string;
  address?: string;
  isCentral: boolean;
  status: "active" | "inactive";
  contactPerson?: string;
  phone?: string;
  email?: string;
  isDeleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const WarehouseSchema = new Schema<IWarehouse>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      index: true,
    },
    dealershipIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Dealership",
      },
    ],
    name: { type: String, required: true, trim: true },
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    address: { type: String, trim: true },
    isCentral: { type: Boolean, default: false, index: true },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
    contactPerson: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

WarehouseSchema.index({ businessId: 1, code: 1 }, { unique: true, sparse: true });

export const Warehouse: Model<IWarehouse> =
  mongoose.models.Warehouse ||
  mongoose.model<IWarehouse>("Warehouse", WarehouseSchema);
