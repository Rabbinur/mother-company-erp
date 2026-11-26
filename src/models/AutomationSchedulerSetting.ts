import mongoose, { Schema, Document } from "mongoose";

/**
 * Persisted scheduler configuration per business.
 * DEFAULT STATE: For any newly registered business, scheduled automation defaults to ENABLED (true)
 * so operational and financial anomaly monitoring is active out-of-the-box unless explicitly toggled OFF
 * by the Business Owner or Super Admin.
 */
export interface IAutomationSchedulerSetting extends Document {
  businessId: mongoose.Types.ObjectId;
  enabled: boolean;
  lastToggledAt?: Date;
  toggledBy?: mongoose.Types.ObjectId;
  toggledByEmail?: string;
  reason?: string;
  lastScheduledRunAt?: Date; // Timestamp of the last scheduled batch processing for this business
  createdAt: Date;
  updatedAt: Date;
}

const AutomationSchedulerSettingSchema = new Schema<IAutomationSchedulerSetting>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      unique: true,
      index: true,
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastToggledAt: {
      type: Date,
    },
    toggledBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    toggledByEmail: {
      type: String,
      trim: true,
    },
    reason: {
      type: String,
      trim: true,
    },
    lastScheduledRunAt: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const AutomationSchedulerSetting =
  mongoose.models.AutomationSchedulerSetting ||
  mongoose.model<IAutomationSchedulerSetting>(
    "AutomationSchedulerSetting",
    AutomationSchedulerSettingSchema
  );
