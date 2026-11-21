import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
  businessId?: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  tokenVersion: number;
  customPermissions: string[];
  status: "active" | "inactive" | "suspended";
  isDeleted?: boolean;
  phone?: string;
  avatar?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      index: true,
    },
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      required: true,
      default: "sales_staff",
      index: true,
    },
    tokenVersion: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    customPermissions: [{ type: String, trim: true }],
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
      index: true,
    },
    isDeleted: { type: Boolean, default: false, index: true },
    phone: { type: String, trim: true },
    avatar: { type: String, trim: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
