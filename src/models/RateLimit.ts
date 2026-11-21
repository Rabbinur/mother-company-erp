import mongoose, { Schema, Document, Model } from "mongoose";

export interface IRateLimit extends Document {
  key: string;
  windowId: number;
  hits: number;
  expireAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RateLimitSchema = new Schema<IRateLimit>(
  {
    key: { type: String, required: true, trim: true },
    windowId: { type: Number, required: true },
    hits: { type: Number, default: 1, min: 1 },
    expireAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Compound unique index ensuring one logical counter per key and windowId
RateLimitSchema.index({ key: 1, windowId: 1 }, { unique: true });
// TTL index for automatic cleanup of expired records
RateLimitSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimit: Model<IRateLimit> =
  mongoose.models.RateLimit ||
  mongoose.model<IRateLimit>("RateLimit", RateLimitSchema);
