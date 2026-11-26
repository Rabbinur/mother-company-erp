import mongoose, { Schema, Document, Model } from "mongoose";
import type { AutomationCategory, AutomationSeverity } from "./AutomationRule";

export type AutomationEventStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED";

export interface IAutomationEvent extends Document {
  businessId: mongoose.Types.ObjectId;
  dealershipId?: mongoose.Types.ObjectId | null;
  ruleKey: string;
  category: AutomationCategory;
  severity: AutomationSeverity;
  title: string;
  message: string;
  sourceEntityType: string;
  sourceEntityId?: string;
  deduplicationKey: string;
  status: AutomationEventStatus;
  detectedAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: mongoose.Types.ObjectId;
  resolvedAt?: Date;
  resolvedBy?: mongoose.Types.ObjectId;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const AutomationEventSchema = new Schema<IAutomationEvent>(
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
    ruleKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      enum: ["INVENTORY", "CUSTOMER", "SUPPLIER", "SALES", "FINANCIAL", "OPERATIONAL"],
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    sourceEntityType: { type: String, required: true, trim: true, index: true },
    sourceEntityId: { type: String, trim: true, index: true },
    deduplicationKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["OPEN", "ACKNOWLEDGED", "RESOLVED", "DISMISSED"],
      default: "OPEN",
      index: true,
    },
    detectedAt: { type: Date, default: Date.now, index: true },
    acknowledgedAt: { type: Date },
    acknowledgedBy: { type: Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

AutomationEventSchema.index({ businessId: 1, status: 1, detectedAt: -1 });
AutomationEventSchema.index({ businessId: 1, deduplicationKey: 1, status: 1 });
AutomationEventSchema.index({ businessId: 1, category: 1, severity: 1 });

export const AutomationEvent: Model<IAutomationEvent> =
  mongoose.models.AutomationEvent ||
  mongoose.model<IAutomationEvent>("AutomationEvent", AutomationEventSchema);
