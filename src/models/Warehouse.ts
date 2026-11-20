import mongoose, { Schema, Document, Model } from "mongoose";

export interface IWarehouse extends Document {
  name: string;
  code: string;
  address?: string;
  isCentral: boolean;
  status: "active" | "inactive";
  contactPerson?: string;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WarehouseSchema = new Schema<IWarehouse>(
  {
    name: { type: String, required: true, trim: true },
    code: {
      type: String,
      required: true,
      unique: true,
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
  },
  { timestamps: true }
);

export const Warehouse: Model<IWarehouse> =
  mongoose.models.Warehouse ||
  mongoose.model<IWarehouse>("Warehouse", WarehouseSchema);
