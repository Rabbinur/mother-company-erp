import mongoose, { Schema, Document, Model } from "mongoose";

export type AutomationTriggerSource = "SCHEDULED" | "MANUAL" | "EVENT";
export type AutomationExecutionStatus = "RUNNING" | "COMPLETED" | "FAILED" | "COMPLETED_WITH_ERRORS";

export interface IAutomationExecution extends Document {
  businessId: mongoose.Types.ObjectId;
  executionKey: string;
  status: AutomationExecutionStatus;
  triggeredBy: AutomationTriggerSource;
  startedAt: Date;
  completedAt?: Date;
  rulesEvaluated: number;
  eventsGenerated: number;
  executionErrors: Array<{ ruleKey: string; error: string }>;
  createdAt: Date;
  updatedAt: Date;
}

const AutomationExecutionSchema = new Schema<IAutomationExecution>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    executionKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["RUNNING", "COMPLETED", "FAILED", "COMPLETED_WITH_ERRORS"],
      default: "RUNNING",
      index: true,
    },
    triggeredBy: {
      type: String,
      enum: ["SCHEDULED", "MANUAL", "EVENT"],
      default: "SCHEDULED",
      index: true,
    },
    startedAt: { type: Date, default: Date.now, index: true },
    completedAt: { type: Date },
    rulesEvaluated: { type: Number, default: 0 },
    eventsGenerated: { type: Number, default: 0 },
    executionErrors: [
      {
        ruleKey: { type: String, required: true },
        error: { type: String, required: true },
      },
    ],
  },
  { timestamps: true }
);

AutomationExecutionSchema.index({ businessId: 1, startedAt: -1 });

export const AutomationExecution: Model<IAutomationExecution> =
  mongoose.models.AutomationExecution ||
  mongoose.model<IAutomationExecution>("AutomationExecution", AutomationExecutionSchema);
