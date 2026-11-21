import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICustomerDealershipAccount extends Document {
  businessId: mongoose.Types.ObjectId;
  dealershipId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  creditLimit: number;
  openingBalance: number;
  currentBalance: number; // Positive = Receivable (retailer owes dealership)
  totalInvoiced: number;
  totalCollected: number;
  totalReturned: number;
  status: "active" | "suspended" | "blocked";
  assignedSalesmanId?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerDealershipAccountSchema = new Schema<ICustomerDealershipAccount>(
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
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    creditLimit: { type: Number, default: 0, min: 0 },
    openingBalance: { type: Number, default: 0 },
    currentBalance: { type: Number, default: 0 },
    totalInvoiced: { type: Number, default: 0 },
    totalCollected: { type: Number, default: 0 },
    totalReturned: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["active", "suspended", "blocked"],
      default: "active",
      index: true,
    },
    assignedSalesmanId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// One financial account per customer per dealership
CustomerDealershipAccountSchema.index(
  { dealershipId: 1, customerId: 1 },
  { unique: true }
);

export const CustomerDealershipAccount: Model<ICustomerDealershipAccount> =
  mongoose.models.CustomerDealershipAccount ||
  mongoose.model<ICustomerDealershipAccount>(
    "CustomerDealershipAccount",
    CustomerDealershipAccountSchema
  );
