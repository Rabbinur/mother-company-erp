import mongoose, { Schema, Document, Model } from "mongoose";

export type TargetPeriod = "daily" | "weekly" | "monthly";
export type TargetScope = "business" | "dealership" | "salesman";
export type TargetStatus = "in_progress" | "achieved" | "exceeded" | "missed";

export interface ISalesTarget extends Document {
  businessId: mongoose.Types.ObjectId;
  dealershipId?: mongoose.Types.ObjectId;
  salesmanId?: mongoose.Types.ObjectId;
  title: string;
  scope: TargetScope;
  period: TargetPeriod;
  startDate: Date;
  endDate: Date;
  targetAmount: number;
  achievedAmount: number;
  achievementPercentage: number;
  status: TargetStatus;
  lastAlertSentAt?: Date;
  alertHistory: Array<{
    alertType: string;
    sentAt: Date;
    recipientEmail?: string;
  }>;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SalesTargetSchema = new Schema<ISalesTarget>(
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
    salesmanId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    title: { type: String, required: true, trim: true },
    scope: {
      type: String,
      enum: ["business", "dealership", "salesman"],
      required: true,
      index: true,
    },
    period: {
      type: String,
      enum: ["daily", "weekly", "monthly"],
      required: true,
      index: true,
    },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    targetAmount: { type: Number, required: true, min: 1 },
    achievedAmount: { type: Number, default: 0, min: 0 },
    achievementPercentage: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["in_progress", "achieved", "exceeded", "missed"],
      default: "in_progress",
      index: true,
    },
    lastAlertSentAt: { type: Date },
    alertHistory: [
      {
        alertType: { type: String, required: true },
        sentAt: { type: Date, default: Date.now },
        recipientEmail: { type: String },
      },
    ],
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

SalesTargetSchema.index({ businessId: 1, period: 1, startDate: 1, endDate: 1 });

export const SalesTarget: Model<ISalesTarget> =
  mongoose.models.SalesTarget ||
  mongoose.model<ISalesTarget>("SalesTarget", SalesTargetSchema);
