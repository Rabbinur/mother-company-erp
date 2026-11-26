import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAccountingPeriod extends Document {
  businessId: mongoose.Types.ObjectId;
  dealershipId?: mongoose.Types.ObjectId;
  periodName: string;
  startDate: Date;
  endDate: Date;
  status: "OPEN" | "CLOSED";
  journalCount?: number;
  closedAt?: Date;
  closedBy?: mongoose.Types.ObjectId;
  closingNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AccountingPeriodSchema = new Schema<IAccountingPeriod>(
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
      index: true,
    },
    periodName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    startDate: {
      type: Date,
      required: true,
      index: true,
    },
    endDate: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["OPEN", "CLOSED"],
      default: "OPEN",
      index: true,
    },
    journalCount: { type: Number, default: 0 },
    closedAt: { type: Date },
    closedBy: { type: Schema.Types.ObjectId, ref: "User" },
    closingNotes: { type: String, trim: true },
  },
  { timestamps: true }
);

export const AccountingPeriod: Model<IAccountingPeriod> =
  mongoose.models.AccountingPeriod ||
  mongoose.model<IAccountingPeriod>("AccountingPeriod", AccountingPeriodSchema);
