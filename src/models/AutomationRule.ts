import mongoose, { Schema, Document, Model } from "mongoose";

export type AutomationCategory =
  | "INVENTORY"
  | "CUSTOMER"
  | "SUPPLIER"
  | "SALES"
  | "FINANCIAL"
  | "OPERATIONAL";

export type AutomationSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface IAutomationRule extends Document {
  businessId: mongoose.Types.ObjectId;
  dealershipId?: mongoose.Types.ObjectId | null;
  ruleKey: string;
  category: AutomationCategory;
  name: string;
  description: string;
  enabled: boolean;
  severity: AutomationSeverity;
  configuration: Record<string, any>;
  isConfigured: boolean;
  unconfiguredReason?: string;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AutomationRuleSchema = new Schema<IAutomationRule>(
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
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: true, index: true },
    severity: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      default: "MEDIUM",
      index: true,
    },
    configuration: { type: Schema.Types.Mixed, default: {} },
    isConfigured: { type: Boolean, default: true, index: true },
    unconfiguredReason: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

AutomationRuleSchema.index({ businessId: 1, ruleKey: 1, dealershipId: 1 }, { unique: true });
AutomationRuleSchema.index({ businessId: 1, enabled: 1, category: 1 });

export const AutomationRule: Model<IAutomationRule> =
  mongoose.models.AutomationRule ||
  mongoose.model<IAutomationRule>("AutomationRule", AutomationRuleSchema);
