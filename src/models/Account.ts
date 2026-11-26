import mongoose, { Schema, Document, Model } from "mongoose";

export type AccountCategory =
  | "ASSET"
  | "LIABILITY"
  | "EQUITY"
  | "REVENUE"
  | "EXPENSE"
  | "CONTRA_REVENUE"
  | "CONTRA_ASSET";

export type AccountType =
  | "asset"
  | "liability"
  | "equity"
  | "revenue"
  | "expense"
  | "contra_revenue"
  | "contra_asset"
  | AccountCategory;

export type AccountSubType =
  | "cash"
  | "bank"
  | "mfs_bkash"
  | "mfs_nagad"
  | "mfs_rocket"
  | "accounts_receivable"
  | "principal_receivable"
  | "inventory_asset"
  | "accounts_payable"
  | "customer_advance"
  | "other_payable"
  | "owner_capital"
  | "owner_equity"
  | "retained_earnings"
  | "sales_revenue"
  | "other_revenue"
  | "sales_return"
  | "sales_discount"
  | "cost_of_goods_sold"
  | "delivery_expense"
  | "loading_unloading_expense"
  | "warehouse_expense"
  | "salary_expense"
  | "operating_expense"
  | "tax_payable";

export type NormalBalance = "DEBIT" | "CREDIT";

export interface IAccount extends Document {
  businessId?: mongoose.Types.ObjectId;
  dealershipId?: mongoose.Types.ObjectId;
  code: string;
  name: string;
  category?: AccountCategory;
  type: AccountType;
  subType: AccountSubType;
  normalBalance?: NormalBalance;
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
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      index: true,
    },
    dealershipId: {
      type: Schema.Types.ObjectId,
      ref: "Dealership",
      index: true,
    },
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: [
        "ASSET",
        "LIABILITY",
        "EQUITY",
        "REVENUE",
        "EXPENSE",
        "CONTRA_REVENUE",
        "CONTRA_ASSET",
      ],
      index: true,
    },
    type: {
      type: String,
      required: true,
      index: true,
    },
    subType: {
      type: String,
      required: true,
      index: true,
    },
    normalBalance: {
      type: String,
      enum: ["DEBIT", "CREDIT"],
      default: "DEBIT",
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

// Auto-align category, type, and normalBalance
AccountSchema.pre("validate", function () {
  if (!this.category) {
    const t = String(this.type).toUpperCase();
    if (t === "ASSET") this.category = "ASSET";
    else if (t === "LIABILITY") this.category = "LIABILITY";
    else if (t === "EQUITY") this.category = "EQUITY";
    else if (t === "REVENUE") this.category = "REVENUE";
    else if (t === "EXPENSE") this.category = "EXPENSE";
    else if (t === "CONTRA_REVENUE") this.category = "CONTRA_REVENUE";
    else if (t === "CONTRA_ASSET") this.category = "CONTRA_ASSET";
    else this.category = "ASSET";
  }

  if (
    this.category === "ASSET" ||
    this.category === "EXPENSE" ||
    this.category === "CONTRA_REVENUE"
  ) {
    this.normalBalance = "DEBIT";
  } else {
    this.normalBalance = "CREDIT";
  }
});

export const Account: Model<IAccount> =
  mongoose.models.Account || mongoose.model<IAccount>("Account", AccountSchema);
