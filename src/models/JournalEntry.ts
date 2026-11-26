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

  // Monetary precision normalization and safe integer validation
  if (this.lines && Array.isArray(this.lines)) {
    for (const l of this.lines) {
      l.debit = Math.round((Number(l.debit) || 0) * 100) / 100;
      l.credit = Math.round((Number(l.credit) || 0) * 100) / 100;
      const dMinor = Math.round(l.debit * 100);
      const cMinor = Math.round(l.credit * 100);
      if (!Number.isSafeInteger(dMinor) || !Number.isSafeInteger(cMinor)) {
        throw new Error("Monetary precision overflow: journal line amount exceeds safe integer boundary");
      }
    }
  }

  if (this.debitsTotal !== undefined) {
    this.debitsTotal = Math.round((Number(this.debitsTotal) || 0) * 100) / 100;
    const dtMinor = Math.round(this.debitsTotal * 100);
    if (!Number.isSafeInteger(dtMinor)) {
      throw new Error("Monetary precision overflow: debitsTotal exceeds safe integer boundary");
    }
  }

  if (this.creditsTotal !== undefined) {
    this.creditsTotal = Math.round((Number(this.creditsTotal) || 0) * 100) / 100;
    const ctMinor = Math.round(this.creditsTotal * 100);
    if (!Number.isSafeInteger(ctMinor)) {
      throw new Error("Monetary precision overflow: creditsTotal exceeds safe integer boundary");
    }
  }

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

const IMMUTABLE_JOURNAL_FIELDS = [
  "lines",
  "debitsTotal",
  "creditsTotal",
  "postingDate",
  "date",
  "entryNumber",
  "journalNumber",
  "businessId",
  "sourceType",
  "sourceId",
];

// Query middleware protection against updateOne, updateMany, and findOneAndUpdate
JournalEntrySchema.pre(["updateOne", "updateMany", "findOneAndUpdate"], async function () {
  const update = this.getUpdate() as Record<string, any>;
  if (!update) return;

  const hasImmutableMutation = (obj: any): boolean => {
    if (!obj || typeof obj !== "object") return false;
    for (const key of Object.keys(obj)) {
      if (IMMUTABLE_JOURNAL_FIELDS.includes(key) || key.startsWith("lines.")) {
        return true;
      }
    }
    return false;
  };

  const isMutatingCore =
    hasImmutableMutation(update) ||
    hasImmutableMutation(update.$set) ||
    hasImmutableMutation(update.$unset) ||
    update.$push?.lines !== undefined ||
    update.$pull?.lines !== undefined ||
    update.$addToSet?.lines !== undefined;

  const isUnposting =
    update.isPosted === false ||
    update.$set?.isPosted === false;

  if (isMutatingCore || isUnposting) {
    const targetQuery = {
      ...this.getQuery(),
      $or: [
        { status: { $in: ["POSTED", "REVERSED", "REVERSING"] } },
        { isPosted: true },
      ],
    };
    const hasPostedMatch = await (this.model as any).exists(targetQuery);
    if (hasPostedMatch) {
      if (isMutatingCore) {
        throw new Error("Posted journal entries are historically immutable; lines and financial figures cannot be updated");
      }
      if (isUnposting) {
        throw new Error("Posted journal entries cannot have isPosted set to false");
      }
    }
  }
});

// Query middleware protection against replaceOne and findOneAndReplace
JournalEntrySchema.pre(["replaceOne", "findOneAndReplace"], async function () {
  const targetQuery = {
    ...this.getQuery(),
    $or: [
      { status: { $in: ["POSTED", "REVERSED", "REVERSING"] } },
      { isPosted: true },
    ],
  };
  const hasPostedMatch = await (this.model as any).exists(targetQuery);
  if (hasPostedMatch) {
    throw new Error("Posted journal entries are historically immutable; replacement is strictly forbidden");
  }
});

// Query middleware protection against deletion (deleteOne, deleteMany, findOneAndDelete)
JournalEntrySchema.pre(["deleteOne", "deleteMany", "findOneAndDelete"], async function () {
  const targetQuery = {
    ...this.getQuery(),
    $or: [
      { status: { $in: ["POSTED", "REVERSED", "REVERSING"] } },
      { isPosted: true },
    ],
  };
  const hasPostedMatch = await (this.model as any).exists(targetQuery);
  if (hasPostedMatch) {
    throw new Error("Posted journal entries are historically immutable and cannot be deleted");
  }
});

// bulkWrite static guard
JournalEntrySchema.statics.bulkWrite = async function (ops: any[], options?: any) {
  for (const op of ops) {
    const filter =
      op.updateOne?.filter ||
      op.updateMany?.filter ||
      op.replaceOne?.filter ||
      op.deleteOne?.filter ||
      op.deleteMany?.filter;

    if (filter) {
      const targetQuery = {
        ...filter,
        $or: [
          { status: { $in: ["POSTED", "REVERSED", "REVERSING"] } },
          { isPosted: true },
        ],
      };
      const hasPosted = await (this as any).exists(targetQuery);
      if (hasPosted) {
        throw new Error("bulkWrite mutation rejected: Posted journal entries are historically immutable");
      }
    }
  }
  return await mongoose.Model.bulkWrite.call(this, ops, options);
};

export const JournalEntry: Model<IJournalEntry> =
  mongoose.models.JournalEntry ||
  mongoose.model<IJournalEntry>("JournalEntry", JournalEntrySchema);
