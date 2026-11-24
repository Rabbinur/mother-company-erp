import mongoose, { Schema, Document, Model } from "mongoose";

export interface IVehicle extends Document {
  registrationNumber: string;
  businessId: mongoose.Types.ObjectId;
  dealershipId?: mongoose.Types.ObjectId | null;
  vehicleType: "van" | "truck" | "pickup" | "motorcycle" | "other";
  modelName?: string;
  capacityWeightKg: number;
  capacityVolumeCft: number;
  ownership: "owned" | "rented" | "principal_provided";
  status: "active" | "maintenance" | "inactive";
  defaultDriverId?: mongoose.Types.ObjectId;
  driverName?: string;
  driverPhone?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VehicleSchema = new Schema<IVehicle>(
  {
    registrationNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    dealershipId: {
      type: Schema.Types.ObjectId,
      ref: "Dealership",
      default: null,
      index: true,
    },
    vehicleType: {
      type: String,
      enum: ["van", "truck", "pickup", "motorcycle", "other"],
      default: "pickup",
      required: true,
    },
    modelName: { type: String, trim: true },
    capacityWeightKg: { type: Number, default: 0, min: 0 },
    capacityVolumeCft: { type: Number, default: 0, min: 0 },
    ownership: {
      type: String,
      enum: ["owned", "rented", "principal_provided"],
      default: "owned",
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "maintenance", "inactive"],
      default: "active",
      index: true,
    },
    defaultDriverId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    driverName: { type: String, trim: true },
    driverPhone: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

VehicleSchema.index({ businessId: 1, status: 1 });
VehicleSchema.index({ businessId: 1, registrationNumber: 1 });

export const Vehicle: Model<IVehicle> =
  mongoose.models.Vehicle || mongoose.model<IVehicle>("Vehicle", VehicleSchema);
