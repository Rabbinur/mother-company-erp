import mongoose, { Schema, Document, Model } from "mongoose";

export interface IDealershipMembership extends Document {
  businessId: mongoose.Types.ObjectId;
  dealershipId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: string;
  isPrimary: boolean;
  status: "active" | "inactive" | "suspended";
  permissions: string[];
  employeeId?: string;
  designation?: string;
  department?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DealershipMembershipSchema = new Schema<IDealershipMembership>(
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
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      required: true,
      trim: true,
      default: "salesman",
      index: true,
    },
    isPrimary: { type: Boolean, default: false, index: true },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
      index: true,
    },
    permissions: [{ type: String, trim: true }],
    employeeId: { type: String, trim: true },
    designation: { type: String, trim: true },
    department: { type: String, trim: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// Compound unique index: user can only have one membership record per dealership
DealershipMembershipSchema.index({ dealershipId: 1, userId: 1 }, { unique: true });
DealershipMembershipSchema.index({ userId: 1, businessId: 1, status: 1 });

export const DealershipMembership: Model<IDealershipMembership> =
  mongoose.models.DealershipMembership ||
  mongoose.model<IDealershipMembership>(
    "DealershipMembership",
    DealershipMembershipSchema
  );
