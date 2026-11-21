import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITransactionOutcome extends Document {
  businessId: mongoose.Types.ObjectId;
  dealershipId: mongoose.Types.ObjectId;
  operationType: string;
  idempotencyKey: string;
  payloadHash: string;
  actorId: mongoose.Types.ObjectId;
  status: "PENDING" | "COMMITTED" | "ABORTED" | "RECONCILIATION_REQUIRED";
  entityId?: string;
  responseSnapshot?: Record<string, unknown>;
  errorMessage?: string;
  recordedAt?: Date;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionOutcomeSchema = new Schema<ITransactionOutcome>(
  {
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
    operationType: { type: String, required: true, index: true },
    idempotencyKey: { type: String, required: true, trim: true, index: true },
    payloadHash: { type: String, required: true },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "COMMITTED", "ABORTED", "RECONCILIATION_REQUIRED"],
      default: "PENDING",
      index: true,
    },
    entityId: { type: String, trim: true },
    responseSnapshot: { type: Schema.Types.Mixed },
    errorMessage: { type: String },
    recordedAt: { type: Date },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

// Compound unique index ensuring exact duplicate operations with same idempotency key are rejected
TransactionOutcomeSchema.index(
  { businessId: 1, dealershipId: 1, operationType: 1, idempotencyKey: 1 },
  { unique: true }
);

export const TransactionOutcome: Model<ITransactionOutcome> =
  mongoose.models.TransactionOutcome ||
  mongoose.model<ITransactionOutcome>("TransactionOutcome", TransactionOutcomeSchema);
