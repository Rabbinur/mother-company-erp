import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISupportTicket extends Document {
  ticketId: string;
  businessId: mongoose.Types.ObjectId;
  requestedBy: mongoose.Types.ObjectId;
  approvedBy: mongoose.Types.ObjectId;
  status: "pending" | "approved" | "rejected" | "revoked" | "expired";
  reason: string;
  isRevoked: boolean;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SupportTicketSchema = new Schema<ISupportTicket>(
  {
    ticketId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "revoked", "expired"],
      default: "pending",
      index: true,
    },
    reason: { type: String, required: true, trim: true },
    isRevoked: { type: Boolean, default: false, index: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

SupportTicketSchema.index({ ticketId: 1 }, { unique: true });
SupportTicketSchema.index({ businessId: 1, status: 1 });

export const SupportTicket: Model<ISupportTicket> =
  mongoose.models.SupportTicket ||
  mongoose.model<ISupportTicket>("SupportTicket", SupportTicketSchema);
