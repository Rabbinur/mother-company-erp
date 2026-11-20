import mongoose, { Schema, Document, Model } from "mongoose";

export interface IJournalLine {
  accountId: mongoose.Types.ObjectId;
  accountCode?: string;
  accountName?: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface IJournalEntry extends Document {
  entryNumber: string;
  date: Date;
  referenceType:
    | "sales_order"
    | "purchase_receive"
    | "customer_payment"
    | "vendor_payment"
    | "expense"
    | "sales_return"
    | "purchase_return"
    | "manual_adjustment"
    | "opening_balance";
  referenceId?: string;
  narration: string;
  lines: IJournalLine[];
  debitsTotal: number;
  creditsTotal: number;
  isPosted: boolean;
  postedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const JournalLineSchema = new Schema<IJournalLine>(
  {
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },
    accountCode: { type: String, trim: true },
    accountName: { type: String, trim: true },
    debit: { type: Number, default: 0, min: 0 },
    credit: { type: Number, default: 0, min: 0 },
    description: { type: String, trim: true },
  },
  { _id: false }
);

const JournalEntrySchema = new Schema<IJournalEntry>(
  {
    entryNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    date: { type: Date, default: Date.now, index: true },
    referenceType: {
      type: String,
      required: true,
      enum: [
        "sales_order",
        "purchase_receive",
        "customer_payment",
        "vendor_payment",
        "expense",
        "sales_return",
        "purchase_return",
        "manual_adjustment",
        "opening_balance",
      ],
      index: true,
    },
    referenceId: { type: String, trim: true, index: true },
    narration: { type: String, required: true, trim: true },
    lines: [JournalLineSchema],
    debitsTotal: { type: Number, required: true, min: 0 },
    creditsTotal: { type: Number, required: true, min: 0 },
    isPosted: { type: Boolean, default: true, index: true },
    postedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Balanced entry validator
JournalEntrySchema.pre("validate", function () {
  const diff = Math.abs((this.debitsTotal || 0) - (this.creditsTotal || 0));
  if (diff > 0.01) {
    throw new Error(`Unbalanced journal entry: Debits (৳${this.debitsTotal}) != Credits (৳${this.creditsTotal})`);
  }
});

export const JournalEntry: Model<IJournalEntry> =
  mongoose.models.JournalEntry ||
  mongoose.model<IJournalEntry>("JournalEntry", JournalEntrySchema);
