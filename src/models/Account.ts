import mongoose, { Schema, Document, Model } from "mongoose";

export type AccountType =
  | "asset"
  | "liability"
  | "equity"
  | "revenue"
  | "expense";

export type AccountSubType =
  | "cash"
  | "bank"
  | "mfs_bkash"
  | "mfs_nagad"
  | "mfs_rocket"
  | "accounts_receivable"
  | "inventory_asset"
  | "accounts_payable"
  | "sales_revenue"
  | "cost_of_goods_sold"
  | "operating_expense"
  | "sales_discount"
  | "tax_payable"
  | "owner_equity";

export interface IAccount extends Document {
  code: string;
  name: string;
  type: AccountType;
  subType: AccountSubType;
  balance: number;
  currency: string;
  isSystem: boolean;
  status: "active" | "inactive";
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AccountSchema = new Schema<IAccount>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      required: true,
      enum: ["asset", "liability", "equity", "revenue", "expense"],
      index: true,
    },
    subType: {
      type: String,
      required: true,
      index: true,
    },
    balance: { type: Number, default: 0 },
    currency: { type: String, default: "BDT" },
    isSystem: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
    description: { type: String, trim: true },
  },
  { timestamps: true }
);

export const Account: Model<IAccount> =
  mongoose.models.Account || mongoose.model<IAccount>("Account", AccountSchema);
