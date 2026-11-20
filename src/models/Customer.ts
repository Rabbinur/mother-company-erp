import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICustomer extends Document {
  customerCode: string;
  name: string;
  shopName: string;
  ownerName?: string;
  phone: string;
  email?: string;
  address?: string;
  district?: string;
  area?: string;
  gpsCoordinates?: {
    lat: number;
    lng: number;
  };
  customerType: "retailer" | "dealer" | "wholesaler" | "corporate";
  creditLimit: number;
  openingBalance: number;
  currentReceivable: number;
  status: "active" | "inactive" | "blocked";
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    customerCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    shopName: { type: String, required: true, trim: true, index: true },
    ownerName: { type: String, trim: true },
    phone: { type: String, required: true, trim: true, index: true },
    email: { type: String, lowercase: true, trim: true },
    address: { type: String, trim: true },
    district: { type: String, trim: true, index: true },
    area: { type: String, trim: true },
    gpsCoordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
    customerType: {
      type: String,
      enum: ["retailer", "dealer", "wholesaler", "corporate"],
      default: "retailer",
      index: true,
    },
    creditLimit: { type: Number, default: 0, min: 0 },
    openingBalance: { type: Number, default: 0 },
    currentReceivable: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["active", "inactive", "blocked"],
      default: "active",
      index: true,
    },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

CustomerSchema.index({ shopName: "text", name: "text", phone: "text" });

export const Customer: Model<ICustomer> =
  mongoose.models.Customer ||
  mongoose.model<ICustomer>("Customer", CustomerSchema);
