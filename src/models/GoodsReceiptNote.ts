import mongoose, { Schema, Document, Model } from "mongoose";

export type GRNStatus =
  | "DRAFT"
  | "OCR_PROCESSING"
  | "NEEDS_REVIEW"
  | "READY_FOR_CONFIRMATION"
  | "VERIFIED"
  | "FAILED"
  | "CANCELLED";

export type GRNOcrStatus =
  | "NOT_RUN"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "NOT_CONFIGURED";

export interface IGRNItem {
  lineItemNumber: number;
  productId?: mongoose.Types.ObjectId | null;
  variantId?: mongoose.Types.ObjectId | null;
  productName: string;
  sku?: string;
  barcode?: string;
  uom?: string;
  matchStatus: "matched" | "ambiguous" | "unmatched" | "manual";
  matchConfidence?: number; // 0.0 - 1.0
  matchedVariantName?: string;

  // Challan Stated Quantities
  challanQuantity: number;
  supplierSchemeFreeQuantity: number;
  manualFreeQuantity: number;

  // Actual Physical Quantities
  receivedQuantity: number;
  shortageQuantity: number; // challanQuantity - receivedQuantity
  excessQuantity: number; // if received > challan
  damagedQuantity: number; // quarantined / damaged on arrival
  rejectedQuantity: number; // rejected back to supplier

  // Batch & Expiry Tracking
  batchNumber?: string;
  manufacturingDate?: Date | null;
  expiryDate?: Date | null;

  // Landed Cost & Pricing (Confidential)
  unitPurchasePrice: number; // Gross price per unit
  lineDiscount: number;
  lineDiscountType?: "fixed" | "percentage";
  allocatedInvoiceDiscount: number;
  allocatedFreight: number;
  allocatedHandling: number;
  netLandedUnitCost: number; // Unit landed cost snapshot
  lineTotal: number;
  taxAmount: number;
  notes?: string;
}

export interface IGRNDocument {
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  hash: string;
  uploadedAt: Date;
  uploadedBy?: mongoose.Types.ObjectId;
}

export interface IGRNCorrection {
  field: string;
  previousValue: any;
  newValue: any;
  actorId: mongoose.Types.ObjectId;
  reason?: string;
  timestamp: Date;
}

export interface IGoodsReceiptNote extends Document {
  businessId: mongoose.Types.ObjectId;
  dealershipId: mongoose.Types.ObjectId;
  warehouseId: mongoose.Types.ObjectId;
  supplierId: mongoose.Types.ObjectId; // References Vendor
  principalCompanyId?: mongoose.Types.ObjectId | null;
  purchaseOrderId?: mongoose.Types.ObjectId | null;

  grnNumber: string;
  challanNumber: string;
  challanDate: Date;
  invoiceNumber?: string;
  invoiceDate?: Date;

  status: GRNStatus;
  ocrStatus: GRNOcrStatus;
  ocrMetadata?: {
    provider?: string;
    rawText?: string;
    extractedAt?: Date;
    overallConfidence?: number;
    fieldConfidences?: Record<string, number>;
  };

  document?: IGRNDocument;
  items: IGRNItem[];

  // Commercial Totals (Confidential)
  grossTotal: number;
  totalLineDiscount: number;
  invoiceDiscount: number;
  invoiceDiscountType?: "fixed" | "percentage";
  cashDiscount: number;
  tradeDiscount: number;
  freightCharge: number;
  handlingCharge: number;
  otherCharges: number;
  taxTotal: number;
  netInvoiceTotal: number;
  discountAllocationPolicy: "proportional_value" | "proportional_quantity";

  // Concurrency & Safeguards
  idempotencyKey?: string;

  // Audit & Workflow
  createdBy: mongoose.Types.ObjectId;
  receivedBy?: mongoose.Types.ObjectId;
  verifiedBy?: mongoose.Types.ObjectId;
  verifiedAt?: Date;
  cancelledBy?: mongoose.Types.ObjectId;
  cancelledAt?: Date;
  cancellationReason?: string;
  corrections?: IGRNCorrection[];
  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

const GRNItemSchema = new Schema<IGRNItem>(
  {
    lineItemNumber: { type: Number, required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", default: null },
    variantId: { type: Schema.Types.ObjectId, ref: "ProductVariant", default: null },
    productName: { type: String, required: true, trim: true },
    sku: { type: String, trim: true },
    barcode: { type: String, trim: true },
    uom: { type: String, trim: true, default: "pcs" },
    matchStatus: {
      type: String,
      enum: ["matched", "ambiguous", "unmatched", "manual"],
      default: "unmatched",
      index: true,
    },
    matchConfidence: { type: Number, default: 0 },
    matchedVariantName: { type: String, trim: true },

    challanQuantity: { type: Number, required: true, min: 0 },
    supplierSchemeFreeQuantity: { type: Number, default: 0, min: 0 },
    manualFreeQuantity: { type: Number, default: 0, min: 0 },

    receivedQuantity: { type: Number, default: 0, min: 0 },
    shortageQuantity: { type: Number, default: 0, min: 0 },
    excessQuantity: { type: Number, default: 0, min: 0 },
    damagedQuantity: { type: Number, default: 0, min: 0 },
    rejectedQuantity: { type: Number, default: 0, min: 0 },

    batchNumber: { type: String, trim: true },
    manufacturingDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null },

    unitPurchasePrice: { type: Number, default: 0, min: 0 },
    lineDiscount: { type: Number, default: 0, min: 0 },
    lineDiscountType: { type: String, enum: ["fixed", "percentage"], default: "fixed" },
    allocatedInvoiceDiscount: { type: Number, default: 0, min: 0 },
    allocatedFreight: { type: Number, default: 0, min: 0 },
    allocatedHandling: { type: Number, default: 0, min: 0 },
    netLandedUnitCost: { type: Number, default: 0, min: 0 },
    lineTotal: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const GoodsReceiptNoteSchema = new Schema<IGoodsReceiptNote>(
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
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
      index: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },
    principalCompanyId: {
      type: Schema.Types.ObjectId,
      ref: "PrincipalCompany",
      default: null,
      index: true,
    },
    purchaseOrderId: {
      type: Schema.Types.ObjectId,
      ref: "Purchase",
      default: null,
    },

    grnNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    challanNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    challanDate: {
      type: Date,
      required: true,
      index: true,
    },
    invoiceNumber: {
      type: String,
      trim: true,
    },
    invoiceDate: {
      type: Date,
    },

    status: {
      type: String,
      enum: [
        "DRAFT",
        "OCR_PROCESSING",
        "NEEDS_REVIEW",
        "READY_FOR_CONFIRMATION",
        "VERIFIED",
        "FAILED",
        "CANCELLED",
      ],
      default: "DRAFT",
      index: true,
    },
    ocrStatus: {
      type: String,
      enum: ["NOT_RUN", "PROCESSING", "COMPLETED", "FAILED", "NOT_CONFIGURED"],
      default: "NOT_RUN",
      index: true,
    },
    ocrMetadata: {
      provider: { type: String },
      rawText: { type: String },
      extractedAt: { type: Date },
      overallConfidence: { type: Number },
      fieldConfidences: { type: Map, of: Number },
    },

    document: {
      originalName: { type: String },
      mimeType: { type: String },
      size: { type: Number },
      path: { type: String },
      hash: { type: String },
      uploadedAt: { type: Date },
      uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
    },

    items: [GRNItemSchema],

    grossTotal: { type: Number, default: 0, min: 0 },
    totalLineDiscount: { type: Number, default: 0, min: 0 },
    invoiceDiscount: { type: Number, default: 0, min: 0 },
    invoiceDiscountType: { type: String, enum: ["fixed", "percentage"], default: "fixed" },
    cashDiscount: { type: Number, default: 0, min: 0 },
    tradeDiscount: { type: Number, default: 0, min: 0 },
    freightCharge: { type: Number, default: 0, min: 0 },
    handlingCharge: { type: Number, default: 0, min: 0 },
    otherCharges: { type: Number, default: 0, min: 0 },
    taxTotal: { type: Number, default: 0, min: 0 },
    netInvoiceTotal: { type: Number, default: 0, min: 0 },
    discountAllocationPolicy: {
      type: String,
      enum: ["proportional_value", "proportional_quantity"],
      default: "proportional_value",
    },

    idempotencyKey: {
      type: String,
      sparse: true,
      index: true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receivedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    verifiedAt: {
      type: Date,
    },
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    cancelledAt: {
      type: Date,
    },
    cancellationReason: {
      type: String,
      trim: true,
    },
    corrections: [
      {
        field: { type: String, required: true },
        previousValue: { type: Schema.Types.Mixed },
        newValue: { type: Schema.Types.Mixed },
        actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        reason: { type: String, trim: true },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

// Compound duplicate detection index: Same supplier cannot have duplicate challan in business unless CANCELLED
GoodsReceiptNoteSchema.index(
  { businessId: 1, supplierId: 1, challanNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $ne: "CANCELLED" } },
    name: "uniq_grn_business_supplier_challan",
  }
);

// Compound queries for tenancy and status
GoodsReceiptNoteSchema.index({ businessId: 1, dealershipId: 1, status: 1 });
GoodsReceiptNoteSchema.index({ businessId: 1, warehouseId: 1 });

export const GoodsReceiptNote: Model<IGoodsReceiptNote> =
  mongoose.models.GoodsReceiptNote ||
  mongoose.model<IGoodsReceiptNote>("GoodsReceiptNote", GoodsReceiptNoteSchema);
