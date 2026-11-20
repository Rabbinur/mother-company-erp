import mongoose, { Schema, Document, Model } from "mongoose";

export interface IExpense extends Document {
  expenseNumber: string;
  categoryId: mongoose.Types.ObjectId;
  accountId: mongoose.Types.ObjectId;
  amount: number;
  date: Date;
  payee: string;
  description: string;
  approvalStatus: "approved" | "pending" | "rejected";
  approvedBy?: mongoose.Types.ObjectId;
  receiptAttachment?: string;
  journalEntryId?: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema = new Schema<IExpense>(
  {
    expenseNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "ExpenseCategory",
      required: true,
      index: true,
    },
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0.01 },
    date: { type: Date, default: Date.now, index: true },
    payee: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    approvalStatus: {
      type: String,
      enum: ["approved", "pending", "rejected"],
      default: "approved",
      index: true,
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    receiptAttachment: { type: String, trim: true },
    journalEntryId: { type: Schema.Types.ObjectId, ref: "JournalEntry" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const Expense: Model<IExpense> =
  mongoose.models.Expense || mongoose.model<IExpense>("Expense", ExpenseSchema);
