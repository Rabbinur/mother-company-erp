import mongoose, { Schema, Document, Model } from "mongoose";

export interface IReservationItem {
  productId: mongoose.Types.ObjectId;
  variantId: mongoose.Types.ObjectId;
  quantity: number;
}

export interface IStockReservation extends Document {
  reservationNumber: string;
  idempotencyKey?: string;
  source: "admin_dashboard" | "internal_staff" | "field_sales" | "api";
  orderId?: mongoose.Types.ObjectId;
  orderNumber?: string;
  customerId?: mongoose.Types.ObjectId;
  warehouseId: mongoose.Types.ObjectId;
  items: IReservationItem[];
  status: "active" | "fulfilled" | "released" | "expired" | "cancelled";
  expiresAt?: Date;
  fulfilledAt?: Date;
  releasedAt?: Date;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ReservationItemSchema = new Schema<IReservationItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variantId: {
      type: Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
    },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const StockReservationSchema = new Schema<IStockReservation>(
  {
    reservationNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
      index: true,
    },
    source: {
      type: String,
      enum: ["admin_dashboard", "internal_staff", "field_sales", "api"],
      default: "admin_dashboard",
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      index: true,
    },
    orderNumber: { type: String, trim: true, index: true },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      index: true,
    },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
      index: true,
    },
    items: [ReservationItemSchema],
    status: {
      type: String,
      enum: ["active", "fulfilled", "released", "expired", "cancelled"],
      default: "active",
      index: true,
    },
    expiresAt: { type: Date, index: true },
    fulfilledAt: { type: Date },
    releasedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const StockReservation: Model<IStockReservation> =
  mongoose.models.StockReservation ||
  mongoose.model<IStockReservation>(
    "StockReservation",
    StockReservationSchema
  );
