import mongoose, { Schema, Document, Model } from "mongoose";

export interface IDealershipProduct extends Document {
  businessId: mongoose.Types.ObjectId;
  dealershipId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  principalCompanyId?: mongoose.Types.ObjectId | null;
  isAvailable: boolean;
  status: "active" | "inactive";
  assignedAt: Date;
  assignedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DealershipProductSchema = new Schema<IDealershipProduct>(
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
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    principalCompanyId: {
      type: Schema.Types.ObjectId,
      ref: "PrincipalCompany",
      default: null,
      index: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Enforce unique product assignment per dealership
DealershipProductSchema.index({ dealershipId: 1, productId: 1 }, { unique: true });
DealershipProductSchema.index({ businessId: 1, dealershipId: 1 });
DealershipProductSchema.index({ dealershipId: 1, isAvailable: 1, status: 1 });

export const DealershipProduct: Model<IDealershipProduct> =
  mongoose.models.DealershipProduct ||
  mongoose.model<IDealershipProduct>("DealershipProduct", DealershipProductSchema);
