import mongoose, { Schema, Document, Model } from "mongoose";

export type CollectionStatus =
  | "pending_verification"
  | "verified"
  | "deposited"
  | "reconciled"
  | "cancelled";

export type SyncStatus = "PENDING_SYNC" | "SYNCED" | "FAILED_RETRY";

export interface IDeliveryCollection extends Document {
  collectionId: string; // Globally unique ID (e.g. COL-1732688000-xxxx)
  businessId: mongoose.Types.ObjectId;
  dealershipId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  deliverymanId: mongoose.Types.ObjectId;
  dispatchId?: mongoose.Types.ObjectId;
  amount: number;
  paymentMethod: "cash" | "bkash" | "nagad" | "bank_transfer" | "other";
  transactionReference?: string;
  status: CollectionStatus;
  syncStatus: SyncStatus;
  depositId?: string; // Links collection to deposit batch
  notes?: string;
  source: "field_sales" | "mother_erp";
  idempotencyKey?: string;
  verifiedBy?: mongoose.Types.ObjectId;
  verifiedAt?: Date;
  depositedAt?: Date;
  reconciledAt?: Date;
  reconciledBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DeliveryCollectionSchema = new Schema<IDeliveryCollection>(
  {
    collectionId: {
      type: String,
      required: true,
      unique: true,
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
      required: true,
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    deliverymanId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    dispatchId: {
      type: Schema.Types.ObjectId,
      ref: "Dispatch",
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "bkash", "nagad", "bank_transfer", "other"],
      default: "cash",
      index: true,
    },
    transactionReference: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: [
        "pending_verification",
        "verified",
        "deposited",
        "reconciled",
        "cancelled",
      ],
      default: "pending_verification",
      index: true,
    },
    syncStatus: {
      type: String,
      enum: ["PENDING_SYNC", "SYNCED", "FAILED_RETRY"],
      default: "SYNCED",
      index: true,
    },
    depositId: {
      type: String,
      trim: true,
      index: true,
    },
    notes: { type: String, trim: true },
    source: {
      type: String,
      enum: ["field_sales", "mother_erp"],
      default: "mother_erp",
      index: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    verifiedAt: { type: Date },
    depositedAt: { type: Date },
    reconciledAt: { type: Date },
    reconciledBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

DeliveryCollectionSchema.index({ deliverymanId: 1, status: 1 });
DeliveryCollectionSchema.index({ orderId: 1, createdAt: -1 });

export const DeliveryCollection: Model<IDeliveryCollection> =
  mongoose.models.DeliveryCollection ||
  mongoose.model<IDeliveryCollection>(
    "DeliveryCollection",
    DeliveryCollectionSchema
  );
