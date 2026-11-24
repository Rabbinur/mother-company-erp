import mongoose, { Schema, Document, Model } from "mongoose";

export type DispatchStatus =
  | "PENDING_DISPATCH"
  | "READY_FOR_DISPATCH"
  | "LOADED"
  | "IN_TRANSIT"
  | "PARTIALLY_DELIVERED"
  | "DELIVERED"
  | "DELIVERY_FAILED"
  | "RETURNED"
  | "CANCELLED";

export interface IDispatchOrderItem {
  orderId: mongoose.Types.ObjectId;
  dealershipId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  variantId: mongoose.Types.ObjectId;
  name: string;
  sku: string;
  orderQuantity: number;
  schemeFreeQuantity?: number;
  manualFreeQuantity?: number;
  loadedQuantity: number;
  deliveredQuantity: number;
  returnedQuantity: number;
  damagedQuantity: number;
  undeliveredQuantity: number;
  unitPrice: number;
  returnReason?: string;
  condition?: "good" | "damaged";
}

export interface IDispatchOrderStop {
  orderId: mongoose.Types.ObjectId;
  orderNumber: string;
  dealershipId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  customerName: string;
  shopName?: string;
  address?: string;
  phone?: string;
  stopSequence: number;
  status: "pending" | "delivered" | "partially_delivered" | "failed" | "rejected";
  deliveredAt?: Date;
  failureReason?: string;
  notes?: string;
  cashCollected: number;
  digitalPaymentCollected: number;
  deliveryProof?: string;
}

export interface IDispatchExpense {
  expenseType: "fuel" | "toll" | "parking" | "transport" | "labor" | "other";
  amount: number;
  payer: "business" | "principal";
  principalCompanyId?: mongoose.Types.ObjectId;
  reimbursementStatus: "not_applicable" | "pending_claim" | "claimed" | "reimbursed";
  claimAmount: number;
  reimbursementReceived?: number;
  notes?: string;
  allocationMethod: "equal" | "delivered_qty" | "fixed_per_order" | "manual";
  dealershipAllocations: Array<{
    dealershipId: mongoose.Types.ObjectId;
    amount: number;
    percentage: number;
  }>;
}

export interface IDispatchWorker {
  workerName: string;
  workerPhone?: string;
  activity: "loading" | "unloading" | "both";
  quantity: number;
  rate: number;
  totalAmount: number;
  payer: "business" | "principal";
  dealershipAllocations: Array<{
    dealershipId: mongoose.Types.ObjectId;
    amount: number;
  }>;
  paymentStatus: "pending" | "paid" | "claimed";
}

export interface IDispatchReconciliation {
  totalLoadedQuantity: number;
  totalDeliveredQuantity: number;
  totalReturnedQuantity: number;
  totalDamagedQuantity: number;
  totalUndeliveredQuantity: number;
  isStockBalanced: boolean;
  stockVariance: number;
  totalCashCollected: number;
  cashDeposited: number;
  cashDifference: number;
  reconciledBy?: mongoose.Types.ObjectId;
  reconciledAt?: Date;
  notes?: string;
}

export interface IDispatch extends Document {
  dispatchNumber: string;
  businessId: mongoose.Types.ObjectId;
  warehouseId: mongoose.Types.ObjectId;
  dealershipIds: mongoose.Types.ObjectId[];
  status: DispatchStatus;
  tripDate: Date;
  vehicleId?: mongoose.Types.ObjectId;
  vehicleNumber?: string;
  deliverymanId?: mongoose.Types.ObjectId;
  deliverymanName?: string;
  deliverymanPhone?: string;
  orders: IDispatchOrderStop[];
  items: IDispatchOrderItem[];
  expenses: IDispatchExpense[];
  workers: IDispatchWorker[];
  reconciliation?: IDispatchReconciliation;
  startedAt?: Date;
  completedAt?: Date;
  cancellationReason?: string;
  cancelledBy?: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DispatchOrderItemSchema = new Schema<IDispatchOrderItem>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    dealershipId: { type: Schema.Types.ObjectId, ref: "Dealership", required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: Schema.Types.ObjectId, ref: "ProductVariant", required: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    orderQuantity: { type: Number, required: true, min: 0 },
    schemeFreeQuantity: { type: Number, default: 0, min: 0 },
    manualFreeQuantity: { type: Number, default: 0, min: 0 },
    loadedQuantity: { type: Number, default: 0, min: 0 },
    deliveredQuantity: { type: Number, default: 0, min: 0 },
    returnedQuantity: { type: Number, default: 0, min: 0 },
    damagedQuantity: { type: Number, default: 0, min: 0 },
    undeliveredQuantity: { type: Number, default: 0, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    returnReason: { type: String, trim: true },
    condition: { type: String, enum: ["good", "damaged"] },
  },
  { _id: false }
);

const DispatchOrderStopSchema = new Schema<IDispatchOrderStop>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    orderNumber: { type: String, required: true },
    dealershipId: { type: Schema.Types.ObjectId, ref: "Dealership", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    customerName: { type: String, required: true },
    shopName: { type: String },
    address: { type: String },
    phone: { type: String },
    stopSequence: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ["pending", "delivered", "partially_delivered", "failed", "rejected"],
      default: "pending",
    },
    deliveredAt: { type: Date },
    failureReason: { type: String, trim: true },
    notes: { type: String, trim: true },
    cashCollected: { type: Number, default: 0, min: 0 },
    digitalPaymentCollected: { type: Number, default: 0, min: 0 },
    deliveryProof: { type: String, trim: true },
  },
  { _id: false }
);

const DispatchExpenseSchema = new Schema<IDispatchExpense>(
  {
    expenseType: {
      type: String,
      enum: ["fuel", "toll", "parking", "transport", "labor", "other"],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    payer: {
      type: String,
      enum: ["business", "principal"],
      default: "business",
    },
    principalCompanyId: { type: Schema.Types.ObjectId, ref: "PrincipalCompany" },
    reimbursementStatus: {
      type: String,
      enum: ["not_applicable", "pending_claim", "claimed", "reimbursed"],
      default: "not_applicable",
    },
    claimAmount: { type: Number, default: 0, min: 0 },
    reimbursementReceived: { type: Number, default: 0, min: 0 },
    notes: { type: String, trim: true },
    allocationMethod: {
      type: String,
      enum: ["equal", "delivered_qty", "fixed_per_order", "manual"],
      default: "delivered_qty",
    },
    dealershipAllocations: [
      {
        dealershipId: { type: Schema.Types.ObjectId, ref: "Dealership", required: true },
        amount: { type: Number, required: true, min: 0 },
        percentage: { type: Number, required: true, min: 0 },
      },
    ],
  },
  { _id: false }
);

const DispatchWorkerSchema = new Schema<IDispatchWorker>(
  {
    workerName: { type: String, required: true, trim: true },
    workerPhone: { type: String, trim: true },
    activity: {
      type: String,
      enum: ["loading", "unloading", "both"],
      default: "both",
    },
    quantity: { type: Number, default: 0, min: 0 },
    rate: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    payer: {
      type: String,
      enum: ["business", "principal"],
      default: "business",
    },
    dealershipAllocations: [
      {
        dealershipId: { type: Schema.Types.ObjectId, ref: "Dealership", required: true },
        amount: { type: Number, required: true, min: 0 },
      },
    ],
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "claimed"],
      default: "pending",
    },
  },
  { _id: false }
);

const DispatchReconciliationSchema = new Schema<IDispatchReconciliation>(
  {
    totalLoadedQuantity: { type: Number, default: 0 },
    totalDeliveredQuantity: { type: Number, default: 0 },
    totalReturnedQuantity: { type: Number, default: 0 },
    totalDamagedQuantity: { type: Number, default: 0 },
    totalUndeliveredQuantity: { type: Number, default: 0 },
    isStockBalanced: { type: Boolean, default: false },
    stockVariance: { type: Number, default: 0 },
    totalCashCollected: { type: Number, default: 0 },
    cashDeposited: { type: Number, default: 0 },
    cashDifference: { type: Number, default: 0 },
    reconciledBy: { type: Schema.Types.ObjectId, ref: "User" },
    reconciledAt: { type: Date },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const DispatchSchema = new Schema<IDispatch>(
  {
    dispatchNumber: {
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
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
      index: true,
    },
    dealershipIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Dealership",
        index: true,
      },
    ],
    status: {
      type: String,
      enum: [
        "PENDING_DISPATCH",
        "READY_FOR_DISPATCH",
        "LOADED",
        "IN_TRANSIT",
        "PARTIALLY_DELIVERED",
        "DELIVERED",
        "DELIVERY_FAILED",
        "RETURNED",
        "CANCELLED",
      ],
      default: "PENDING_DISPATCH",
      index: true,
    },
    tripDate: { type: Date, default: Date.now, index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle" },
    vehicleNumber: { type: String, trim: true },
    deliverymanId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    deliverymanName: { type: String, trim: true },
    deliverymanPhone: { type: String, trim: true },
    orders: [DispatchOrderStopSchema],
    items: [DispatchOrderItemSchema],
    expenses: [DispatchExpenseSchema],
    workers: [DispatchWorkerSchema],
    reconciliation: DispatchReconciliationSchema,
    startedAt: { type: Date },
    completedAt: { type: Date },
    cancellationReason: { type: String, trim: true },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

DispatchSchema.index({ businessId: 1, status: 1, tripDate: -1 });
DispatchSchema.index({ businessId: 1, dealershipIds: 1, status: 1 });
DispatchSchema.index({ businessId: 1, deliverymanId: 1, status: 1 });
DispatchSchema.index({ "orders.orderId": 1 });

export const Dispatch: Model<IDispatch> =
  mongoose.models.Dispatch || mongoose.model<IDispatch>("Dispatch", DispatchSchema);

export { Dispatch as DeliveryTrip };
