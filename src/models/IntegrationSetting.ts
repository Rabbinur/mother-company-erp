import mongoose, { Schema, Document, Model } from "mongoose";

export type IntegrationProviderType =
  | "sms"
  | "whatsapp"
  | "payment_gateway"
  | "ocr"
  | "notification_hub";

export type IntegrationStatus =
  | "CONFIGURED"
  | "NOT_CONFIGURED"
  | "DISABLED"
  | "ERROR";

export interface IIntegrationSetting extends Document {
  businessId: mongoose.Types.ObjectId;
  providerType: IntegrationProviderType;
  providerName: string;
  enabled: boolean;
  status: IntegrationStatus;
  metadata?: Record<string, unknown>;
  lastError?: string;
  lastActivityAt?: Date;
  updatedBy?: mongoose.Types.ObjectId;
  updatedByEmail?: string;
  createdAt: Date;
  updatedAt: Date;
}

const IntegrationSettingSchema = new Schema<IIntegrationSetting>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    providerType: {
      type: String,
      enum: ["sms", "whatsapp", "payment_gateway", "ocr", "notification_hub"],
      required: true,
      index: true,
    },
    providerName: {
      type: String,
      required: true,
      trim: true,
    },
    enabled: {
      type: Boolean,
      default: false,
      index: true,
    },
    status: {
      type: String,
      enum: ["CONFIGURED", "NOT_CONFIGURED", "DISABLED", "ERROR"],
      default: "NOT_CONFIGURED",
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    lastError: {
      type: String,
      trim: true,
    },
    lastActivityAt: {
      type: Date,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    updatedByEmail: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

IntegrationSettingSchema.index(
  { businessId: 1, providerType: 1 },
  { unique: true }
);

export const IntegrationSetting: Model<IIntegrationSetting> =
  mongoose.models.IntegrationSetting ||
  mongoose.model<IIntegrationSetting>(
    "IntegrationSetting",
    IntegrationSettingSchema
  );
