import mongoose, { Schema, Document, Model } from "mongoose";

export interface INotification extends Document {
  title: string;
  message: string;
  type:
    | "low_stock"
    | "out_of_stock"
    | "purchase_received"
    | "new_order"
    | "order_cancelled"
    | "payment_received"
    | "credit_limit_reached"
    | "system";
  targetRole?: string;
  targetUserId?: mongoose.Types.ObjectId;
  isRead: boolean;
  link?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: [
        "low_stock",
        "out_of_stock",
        "purchase_received",
        "new_order",
        "order_cancelled",
        "payment_received",
        "credit_limit_reached",
        "system",
      ],
      default: "system",
      index: true,
    },
    targetRole: { type: String, trim: true, index: true },
    targetUserId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    isRead: { type: Boolean, default: false, index: true },
    link: { type: String, trim: true },
  },
  { timestamps: true }
);

NotificationSchema.index({ createdAt: -1 });

export const Notification: Model<INotification> =
  mongoose.models.Notification ||
  mongoose.model<INotification>("Notification", NotificationSchema);
