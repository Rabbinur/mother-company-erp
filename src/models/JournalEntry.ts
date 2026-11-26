import mongoose, { Schema, Document, Model } from "mongoose";

export interface IJournalLine {
  accountId: mongoose.Types.ObjectId;
  accountCode?: string;
  accountName?: string;
  dealershipId?: mongoose.Types.ObjectId;
  debit: number;
  credit: number;
  memo?: string;
  description?: string;
}

export type JournalSourceType =
  | "purchase_grn"
  | "supplier_payment"
  | "sales_fulfillment"
  | "customer_payment"
  | "sales_return"
  | "purchase_return"
  | "expense"
  | "claim_settlement"
  | "manual_adjustment"
  | "opening_balance"
  | "sales_order"
  | "purchase_receive"
  | "vendor_payment";

export type JournalStatus = "DRAFT" | "POSTED" | "VOIDED" | "REVERSED" | "REVERSING";

export interface IJournalEntry extends Document {
  businessId?: mongoose.Types.ObjectId;
  dealershipId?: mongoose.Types.ObjectId;
  journalNumber: string;
  entryNumber?: string;
  postingDate: Date;
  date?: Date;
  periodId?: mongoose.Types.ObjectId;
  sourceType: JournalSourceType;
  sourceId?: string;
  referenceType?: string;
  referenceId?: string;
  narration: string;
  description?: string;
  lines: IJournalLine[];
  debitsTotal: number;
  creditsTotal: number;
  status: JournalStatus;
  isPosted: boolean;
  postedBy?: mongoose.Types.ObjectId;
  postedAt?: Date;
  idempotencyKey?: string;
  reversalOfJournalId?: mongoose.Types.ObjectId;
  reversedByJournalId?: mongoose.Types.ObjectId;
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
    dealershipId: { type: Schema.Types.ObjectId, ref: "Dealership" },
    debit: { type: Number, default: 0, min: 0 },
    credit: { type: Number, default: 0, min: 0 },
    memo: { type: String, trim: true },
    description: { type: String, trim: true },
  },
  { _id: false }
);

const JournalEntrySchema = new Schema<IJournalEntry>(
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
    journalNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    entryNumber: { type: String, uppercase: true, trim: true },
    postingDate: { type: Date, default: Date.now, index: true },
    date: { type: Date, default: Date.now, index: true },
    periodId: { type: Schema.Types.ObjectId, ref: "AccountingPeriod", index: true },
    sourceType: {
      type: String,
      required: true,
      index: true,
    },
    sourceId: { type: String, trim: true, index: true },
    referenceType: { type: String, trim: true, index: true },
    referenceId: { type: String, trim: true, index: true },
    narration: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    lines: [JournalLineSchema],
    debitsTotal: { type: Number, required: true, min: 0 },
    creditsTotal: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["DRAFT", "POSTED", "VOIDED", "REVERSED", "REVERSING"],
      default: "POSTED",
      index: true,
    },
    isPosted: { type: Boolean, default: true, index: true },
    postedBy: { type: Schema.Types.ObjectId, ref: "User" },
    postedAt: { type: Date },
    idempotencyKey: { type: String, trim: true, index: true, sparse: true },
    reversalOfJournalId: { type: Schema.Types.ObjectId, ref: "JournalEntry" },
    reversedByJournalId: { type: Schema.Types.ObjectId, ref: "JournalEntry" },
  },
  { timestamps: true }
);

// Alias synchronization & Balanced entry validator
JournalEntrySchema.pre("validate", function () {
  if (!this.entryNumber && this.journalNumber) this.entryNumber = this.journalNumber;
  if (!this.journalNumber && this.entryNumber) this.journalNumber = this.entryNumber;
  if (!this.date && this.postingDate) this.date = this.postingDate;
  if (!this.postingDate && this.date) this.postingDate = this.date;
  if (!this.referenceType && this.sourceType) this.referenceType = this.sourceType;
  if (!this.sourceType && this.referenceType) this.sourceType = this.referenceType as any;
  if (!this.referenceId && this.sourceId) this.referenceId = this.sourceId;
  if (!this.sourceId && this.referenceId) this.sourceId = this.referenceId;
  if (!this.description && this.narration) this.description = this.narration;
  if (!this.narration && this.description) this.narration = this.description;

  if (this.status === "POSTED" || this.status === "REVERSED") this.isPosted = true;
  if (this.isPosted && !this.status) this.status = "POSTED";

  const diff = Math.abs((this.debitsTotal || 0) - (this.creditsTotal || 0));
  if (diff > 0.01) {
    throw new Error(`Unbalanced journal entry: Debits (৳${this.debitsTotal}) != Credits (৳${this.creditsTotal})`);
  }
});

// Immutability protection: prevent mutating lines or un-posting posted journal entries
JournalEntrySchema.pre("save", function () {
  if (!this.isNew) {
    if (this.isModified("lines") && (this.status === "POSTED" || this.status === "REVERSED")) {
      throw new Error("Posted journal entries are historically immutable; lines cannot be modified");
    }
    if (this.isModified("isPosted") && !this.isPosted && (this.status === "POSTED" || this.status === "REVERSED")) {
      throw new Error("Posted journal entries cannot have isPosted set to false");
    }
  }
});

export const JournalEntry: Model<IJournalEntry> =
  mongoose.models.JournalEntry ||
  mongoose.model<IJournalEntry>("JournalEntry", JournalEntrySchema);
