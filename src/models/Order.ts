import mongoose, { Schema, Document, Model } from "mongoose";

export interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  variantId: mongoose.Types.ObjectId;
  name: string;
  sku: string;
  quantity: number;
  customerPriceSnapshot: number; // authoritative price charged
  retailPriceSnapshot: number; // suggested resale price (informational)
  discount: number;
  subtotal: number;
}

export interface IOrder extends Document {
  orderNumber: string;
  externalOrderId?: string;
  idempotencyKey?: string;
  source: "admin_dashboard" | "internal_staff" | "field_sales" | "api";
  customerId: mongoose.Types.ObjectId;
  warehouseId: mongoose.Types.ObjectId;
  reservationId?: mongoose.Types.ObjectId;
  items: IOrderItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  paidAmount: number;
  receivableAmount: number;
  orderStatus:
    | "draft"
    | "confirmed"
    | "processing"
    | "fulfilled"
    | "delivered"
    | "cancelled"
    | "returned";
  fulfillmentStatus:
    | "unfulfilled"
    | "partially_fulfilled"
    | "fulfilled"
    | "returned";
  paymentStatus: "unpaid" | "partially_paid" | "paid";
  orderDate: Date;
  confirmedDate?: Date;
  fulfilledDate?: Date;
  cancelledDate?: Date;
  salesmanId?: mongoose.Types.ObjectId;
  notes?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
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
    name: { type: String, required: true },
    sku: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    customerPriceSnapshot: { type: Number, required: true, min: 0 },
    retailPriceSnapshot: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    externalOrderId: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    source: {
      type: String,
      enum: ["admin_dashboard", "internal_staff", "field_sales", "api"],
      default: "admin_dashboard",
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
      index: true,
    },
    reservationId: {
      type: Schema.Types.ObjectId,
      ref: "StockReservation",
      index: true,
    },
    items: [OrderItemSchema],
    subtotal: { type: Number, required: true, min: 0 },
    discountTotal: { type: Number, default: 0, min: 0 },
    taxTotal: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    receivableAmount: { type: Number, required: true, min: 0 },
    orderStatus: {
      type: String,
      enum: [
        "draft",
        "confirmed",
        "processing",
        "fulfilled",
        "delivered",
        "cancelled",
        "returned",
      ],
      default: "draft",
      index: true,
    },
    fulfillmentStatus: {
      type: String,
      enum: ["unfulfilled", "partially_fulfilled", "fulfilled", "returned"],
      default: "unfulfilled",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "partially_paid", "paid"],
      default: "unpaid",
      index: true,
    },
    orderDate: { type: Date, default: Date.now, index: true },
    confirmedDate: { type: Date },
    fulfilledDate: { type: Date },
    cancelledDate: { type: Date },
    salesmanId: { type: Schema.Types.ObjectId, ref: "User" },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const Order: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>("Order", OrderSchema);
