import mongoose, { Schema, Document, Model } from "mongoose";

export type ClaimCategory =
  | "supplier_shortage"
  | "supplier_damage"
  | "warehouse_damage"
  | "delivery_transit_damage"
  | "principal_reimbursement"
  | "operational_claim";

export type ClaimStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "SETTLED"
  | "CANCELLED";

export interface IClaimItem {
  productId?: mongoose.Types.ObjectId;
  variantId?: mongoose.Types.ObjectId;
  name?: string;
  sku?: string;
  batchNumber?: string;
  quantity?: number;
  unitCost?: number;
  claimedAmount: number;
  reason?: string;
}

export interface IClaim extends Document {
  claimNumber: string;
  businessId: mongoose.Types.ObjectId;
  dealershipId: mongoose.Types.ObjectId;
  principalCompanyId?: mongoose.Types.ObjectId;
  vendorId?: mongoose.Types.ObjectId;
  title?: string;
  claimedAgainstType?: "supplier" | "transporter" | "principal" | "internal" | "insurance" | string;
  claimCategory: ClaimCategory;
  referenceType?: "grn" | "purchase" | "dispatch" | "sales_return" | "other" | string;
  referenceId?: string;
  referenceDocId?: mongoose.Types.ObjectId;
  items: IClaimItem[];
  claimedAmount: number;
  approvedAmount?: number;
  settledAmount?: number;
  status: ClaimStatus;
  reason: string;
  calculationBasis?: string;
  evidenceAttachments?: string[];
  submittedBy?: mongoose.Types.ObjectId;
  submittedDate: Date;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;
  settlementRef?: string;
  settlementDate?: Date;
  settlementNotes?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ClaimItemSchema = new Schema<IClaimItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product" },
    variantId: { type: Schema.Types.ObjectId, ref: "ProductVariant" },
    name: { type: String },
    sku: { type: String },
    batchNumber: { type: String, trim: true },
    quantity: { type: Number, min: 0 },
    unitCost: { type: Number, min: 0 },
    claimedAmount: { type: Number, required: true, min: 0 },
    reason: { type: String, trim: true },
  },
  { _id: false }
);

const ClaimSchema = new Schema<IClaim>(
  {
    claimNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
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
    principalCompanyId: {
      type: Schema.Types.ObjectId,
      ref: "PrincipalCompany",
      index: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      index: true,
    },
    title: { type: String, trim: true },
    claimedAgainstType: { type: String, trim: true, default: "internal" },
    claimCategory: {
      type: String,
      enum: [
        "supplier_shortage",
        "supplier_damage",
        "warehouse_damage",
        "delivery_transit_damage",
        "principal_reimbursement",
        "operational_claim",
      ],
      required: true,
      index: true,
    },
    referenceType: {
      type: String,
      enum: ["grn", "purchase", "dispatch", "sales_return", "other"],
      required: true,
      index: true,
    },
    referenceId: { type: String, trim: true, index: true },
    referenceDocId: { type: Schema.Types.ObjectId },
    items: [ClaimItemSchema],
    claimedAmount: { type: Number, required: true, min: 0 },
    approvedAmount: { type: Number, min: 0 },
    settledAmount: { type: Number, min: 0 },
    status: {
      type: String,
      enum: [
        "SUBMITTED",
        "UNDER_REVIEW",
        "APPROVED",
        "REJECTED",
        "SETTLED",
        "CANCELLED",
      ],
      default: "SUBMITTED",
      index: true,
    },
    reason: { type: String, required: true, trim: true },
    calculationBasis: { type: String, trim: true },
    evidenceAttachments: [{ type: String, trim: true }],
    submittedBy: { type: Schema.Types.ObjectId, ref: "User" },
    submittedDate: { type: Date, default: Date.now, index: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    rejectionReason: { type: String, trim: true },
    settlementRef: { type: String, trim: true },
    settlementDate: { type: Date },
    settlementNotes: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

ClaimSchema.index({ businessId: 1, dealershipId: 1, status: 1 });
ClaimSchema.index({ businessId: 1, claimCategory: 1, status: 1 });
ClaimSchema.index({ referenceType: 1, referenceId: 1 });

export const Claim: Model<IClaim> =
  mongoose.models.Claim || mongoose.model<IClaim>("Claim", ClaimSchema);
