import mongoose, { Schema, Document, Model } from "mongoose";

export interface IBankReconciliation extends Document {
  businessId: mongoose.Types.ObjectId;
  dealershipId?: mongoose.Types.ObjectId | null;
  accountId: mongoose.Types.ObjectId;
  accountCode: string;
  accountName: string;
  isSharedTreasury: boolean;
  statementDate: Date;
  statementEndingBalance: number;
  ledgerClosingBalance: number;
  discrepancy: number;
  status: "RECONCILED" | "DISCREPANCY";
  reconciledBy?: mongoose.Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BankReconciliationSchema = new Schema<IBankReconciliation>(
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
      default: null,
      index: true,
    },
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },
    accountCode: { type: String, required: true, trim: true },
    accountName: { type: String, required: true, trim: true },
    isSharedTreasury: { type: Boolean, default: false, index: true },
    statementDate: { type: Date, required: true, default: Date.now, index: true },
    statementEndingBalance: { type: Number, required: true },
    ledgerClosingBalance: { type: Number, required: true },
    discrepancy: { type: Number, required: true, default: 0 },
    status: {
      type: String,
      enum: ["RECONCILED", "DISCREPANCY"],
      default: "RECONCILED",
      index: true,
    },
    reconciledBy: { type: Schema.Types.ObjectId, ref: "User" },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

BankReconciliationSchema.index({ accountId: 1, statementDate: 1 });
BankReconciliationSchema.index({ businessId: 1, dealershipId: 1, statementDate: 1 });

export const BankReconciliation: Model<IBankReconciliation> =
  mongoose.models.BankReconciliation ||
  mongoose.model<IBankReconciliation>("BankReconciliation", BankReconciliationSchema);
