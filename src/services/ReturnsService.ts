import mongoose from "mongoose";
import { SalesReturn, type ISalesReturn, type ISalesReturnItem, type InspectionClassification } from "@/models/SalesReturn";
import { PurchaseReturn, type IPurchaseReturn, type IPurchaseReturnItem } from "@/models/PurchaseReturn";
import { Claim, type IClaim, type ClaimCategory } from "@/models/Claim";
import { Order } from "@/models/Order";
import { GoodsReceiptNote } from "@/models/GoodsReceiptNote";
import { SupplierPayable } from "@/models/SupplierPayable";
import { Vendor } from "@/models/Vendor";
import { CustomerDealershipAccount } from "@/models/CustomerDealershipAccount";
import { InventoryBalance } from "@/models/InventoryBalance";
import { StockMovement } from "@/models/StockMovement";
import { Counter } from "@/models/Counter";
import { AuditLog } from "@/models/AuditLog";
import { InventoryService } from "./InventoryService";
import { generateReferenceCode } from "@/lib/utils";

export interface CreateSalesReturnInput {
  businessId: string | mongoose.Types.ObjectId;
  dealershipId: string | mongoose.Types.ObjectId;
  orderId: string | mongoose.Types.ObjectId;
  items: Array<{
    productId: string | mongoose.Types.ObjectId;
    variantId: string | mongoose.Types.ObjectId;
    name?: string;
    sku?: string;
    returnedQuantity: number;
    condition?: "good" | "damaged" | "expired" | "wrong_product";
    reason?: string;
  }>;
  reason: string;
  notes?: string;
  evidenceAttachments?: string[];
  dispatchId?: string | mongoose.Types.ObjectId;
  actorId?: string | mongoose.Types.ObjectId;
}

export interface InspectSalesReturnInput {
  returnId: string | mongoose.Types.ObjectId;
  inspectedItems: Array<{
    variantId: string | mongoose.Types.ObjectId;
    condition: "good" | "damaged" | "expired" | "wrong_product";
    classification: InspectionClassification;
    deductionAmount?: number;
  }>;
  inspectionNotes?: string;
  actorId?: string | mongoose.Types.ObjectId;
}

export interface ApproveSalesReturnInput {
  returnId: string | mongoose.Types.ObjectId;
  decision: "approve" | "reject";
  rejectionReason?: string;
  actorId?: string | mongoose.Types.ObjectId;
  session?: mongoose.ClientSession;
}

export interface ProcessCustomerRefundInput {
  returnId: string | mongoose.Types.ObjectId;
  refundMethod: "credit_note" | "cash" | "bank_transfer" | "adjustment";
  refundAmount?: number;
  reference?: string;
  actorId?: string | mongoose.Types.ObjectId;
  session?: mongoose.ClientSession;
}

export interface CreatePurchaseReturnInput {
  businessId: string | mongoose.Types.ObjectId;
  dealershipId: string | mongoose.Types.ObjectId;
  grnId: string | mongoose.Types.ObjectId;
  items: Array<{
    productId: string | mongoose.Types.ObjectId;
    variantId: string | mongoose.Types.ObjectId;
    batchNumber?: string;
    returnedQuantity: number;
    reason?: string;
  }>;
  reason: string;
  supplierAuthorizationRef?: string;
  notes?: string;
  actorId?: string | mongoose.Types.ObjectId;
}

export interface CreateClaimInput {
  businessId: string | mongoose.Types.ObjectId;
  dealershipId: string | mongoose.Types.ObjectId;
  claimCategory: ClaimCategory;
  referenceType: "grn" | "purchase" | "dispatch" | "sales_return" | "other";
  referenceId?: string;
  referenceDocId?: string | mongoose.Types.ObjectId;
  principalCompanyId?: string | mongoose.Types.ObjectId;
  vendorId?: string | mongoose.Types.ObjectId;
  items?: Array<{
    productId?: string | mongoose.Types.ObjectId;
    variantId?: string | mongoose.Types.ObjectId;
    name?: string;
    sku?: string;
    batchNumber?: string;
    quantity?: number;
    unitCost?: number;
    claimedAmount: number;
    reason?: string;
  }>;
  claimedAmount: number;
  reason: string;
  calculationBasis?: string;
  evidenceAttachments?: string[];
  actorId?: string | mongoose.Types.ObjectId;
}

export class ReturnsService {
  /**
   * Concurrency-safe atomic reference generators
   */
  static async generateSalesReturnNumber(
    businessId: string | mongoose.Types.ObjectId,
    session?: mongoose.ClientSession
  ): Promise<string> {
    const ym = new Date().toISOString().slice(0, 7).replace("-", "");
    const seq = await Counter.getNextSequence(`srt_${String(businessId)}_${ym}`, session);
    return generateReferenceCode("SRT", seq);
  }

  static async generatePurchaseReturnNumber(
    businessId: string | mongoose.Types.ObjectId,
    session?: mongoose.ClientSession
  ): Promise<string> {
    const ym = new Date().toISOString().slice(0, 7).replace("-", "");
    const seq = await Counter.getNextSequence(`prt_${String(businessId)}_${ym}`, session);
    return generateReferenceCode("PRT", seq);
  }

  static async generateClaimNumber(
    businessId: string | mongoose.Types.ObjectId,
    session?: mongoose.ClientSession
  ): Promise<string> {
    const ym = new Date().toISOString().slice(0, 7).replace("-", "");
    const seq = await Counter.getNextSequence(`clm_${String(businessId)}_${ym}`, session);
    return generateReferenceCode("CLM", seq);
  }

  // ==========================================
  // CUSTOMER SALES RETURNS
  // ==========================================

  /**
   * Create a Customer Sales Return Request
   */
  static async createSalesReturnRequest(input: CreateSalesReturnInput): Promise<ISalesReturn> {
    const bId = new mongoose.Types.ObjectId(String(input.businessId));
    const dId = new mongoose.Types.ObjectId(String(input.dealershipId));
    const oId = new mongoose.Types.ObjectId(String(input.orderId));
    const actId = input.actorId ? new mongoose.Types.ObjectId(String(input.actorId)) : undefined;

    const order = await Order.findById(oId);
    if (!order) throw new Error("Original Sales Order not found");

    if (String(order.businessId) !== String(bId) || String(order.dealershipId) !== String(dId)) {
      throw new Error("Order does not belong to specified business or dealership");
    }

    // Must be at least partially fulfilled, fulfilled, or delivered
    const fStatus = String(order.fulfillmentStatus || (order as any).status || (order as any).orderStatus || "").toLowerCase();
    if (fStatus !== "fulfilled" && fStatus !== "partially_fulfilled" && fStatus !== "delivered") {
      throw new Error(`Order ${order.orderNumber} is '${order.fulfillmentStatus || (order as any).status || (order as any).orderStatus}'. Only delivered orders can be returned.`);
    }

    // Retrieve previous non-rejected returns for this order to check eligible quantities
    const previousReturns = await SalesReturn.find({
      orderId: oId,
      status: { $ne: "REJECTED" },
    }).lean();

    const previousReturnMap = new Map<string, number>();
    for (const pr of previousReturns) {
      for (const it of pr.items) {
        const vKey = String(it.variantId || it.productId);
        previousReturnMap.set(vKey, (previousReturnMap.get(vKey) || 0) + (it.returnedQuantity ?? (it as any).quantity));
      }
    }

    let totalRefund = 0;
    const returnItems: ISalesReturnItem[] = [];

    for (const it of input.items) {
      const pId = new mongoose.Types.ObjectId(String(it.productId));
      const requestedQty = Math.max(1, Number(it.returnedQuantity ?? (it as any).quantity));

      const orderLine = order.items.find((oi: any) =>
        it.variantId
          ? String(oi.variantId) === String(it.variantId)
          : String(oi.productId) === String(pId) || String(oi.variantId) === String(pId)
      );
      if (!orderLine) {
        throw new Error(`Product ${pId} does not belong to original Order ${order.orderNumber}`);
      }

      const vId = it.variantId
        ? new mongoose.Types.ObjectId(String(it.variantId))
        : (orderLine.variantId ? new mongoose.Types.ObjectId(String(orderLine.variantId)) : pId);

      const deliveredQty = (orderLine as any).deliveredQuantity ?? orderLine.quantity;
      const key = String(vId || pId);
      const alreadyReturned = previousReturnMap.get(key) || 0;
      const maxEligible = deliveredQty - alreadyReturned;

      if (requestedQty > maxEligible) {
        throw new Error(
          `Return quantity (${requestedQty}) exceeds returnable quantity (${maxEligible}) for product ${orderLine.name || (orderLine as any).productName}`
        );
      }

      const priceSnapshot = orderLine.customerPriceSnapshot || orderLine.unitPrice || 0;
      const refundAmt = Math.round(requestedQty * priceSnapshot * 100) / 100;
      totalRefund += refundAmt;

      returnItems.push({
        productId: pId,
        variantId: vId,
        name: orderLine.name || (orderLine as any).productName || it.name || "Product Item",
        sku: orderLine.sku || it.sku || "SKU-N/A",
        returnedQuantity: requestedQty,
        quantity: requestedQty,
        customerPriceSnapshot: priceSnapshot,
        condition: it.condition || "good",
        restockEligible: it.condition !== "damaged" && it.condition !== "expired",
        refundAmount: refundAmt,
        deductionAmount: 0,
      } as any);
    }

    const returnNumber = await this.generateSalesReturnNumber(bId);

    const salesReturn: any = await SalesReturn.create({
      returnNumber,
      businessId: bId,
      dealershipId: dId,
      dispatchId: input.dispatchId ? new mongoose.Types.ObjectId(String(input.dispatchId)) : undefined,
      orderId: oId,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      customerDealershipAccountId: order.customerDealershipAccountId,
      warehouseId: order.warehouseId,
      items: returnItems,
      totalRefundAmount: totalRefund,
      totalDeductionAmount: 0,
      netRefundAmount: totalRefund,
      reason: input.reason.trim(),
      status: "REQUESTED",
      restocked: false,
      refundStatus: "NONE",
      evidenceAttachments: input.evidenceAttachments,
      notes: input.notes?.trim(),
      createdBy: actId,
    });

    if (actId) {
      await AuditLog.create({
        actorId: actId,
        action: "SALES_RETURN_REQUESTED",
        entityType: "sales_return",
        entityId: String(salesReturn._id),
        afterSnapshot: {
          returnNumber,
          totalRefundAmount: totalRefund,
        },
      });
    }

    return salesReturn;
  }

  /**
   * Inspect a Customer Sales Return
   */
  static async inspectSalesReturn(
    returnIdOrInput: string | InspectSalesReturnInput | any,
    options?: any
  ): Promise<ISalesReturn> {
    const input = typeof returnIdOrInput === "string"
      ? { returnId: returnIdOrInput, ...options }
      : { ...returnIdOrInput, ...options };

    const rId = new mongoose.Types.ObjectId(String(input.returnId));
    const actId = input.actorId ? new mongoose.Types.ObjectId(String(input.actorId)) : undefined;

    const salesReturn = await SalesReturn.findById(rId);
    if (!salesReturn) throw new Error("Sales Return record not found");

    if (salesReturn.status === "APPROVED" || salesReturn.status === "RESTOCKED" || salesReturn.status === "CLOSED") {
      throw new Error(`Cannot re-inspect return in status '${salesReturn.status}'`);
    }

    let totalDeductions = 0;
    const itemsList = input.inspectedItems || input.itemClassifications || [];

    for (const insp of itemsList) {
      let it = insp.variantId
        ? salesReturn.items.find(
            (item) => String(item.variantId) === String(insp.variantId) || String(item.productId) === String(insp.variantId)
          )
        : undefined;

      if (!it && typeof insp.itemIndex === "number") {
        it = salesReturn.items[insp.itemIndex];
      }
      if (!it && salesReturn.items.length === 1) {
        it = salesReturn.items[0];
      }

      if (it) {
        if (insp.condition) it.condition = insp.condition;
        if (insp.classification) {
          it.inspectionClassification = insp.classification;
          it.restockEligible = insp.classification === "GOOD_RESTOCKABLE";
          if (insp.classification === "GOOD_RESTOCKABLE") it.condition = "good";
          else if (insp.classification === "DAMAGED") it.condition = "damaged";
          else if (insp.classification === "EXPIRED") it.condition = "expired";
        }
        if (insp.conditionNotes) (it as any).conditionNotes = insp.conditionNotes;
        const deduction = Math.max(0, Number(insp.deductionAmount || 0));
        it.deductionAmount = deduction;
        totalDeductions += deduction;
      }
    }

    salesReturn.totalDeductionAmount = totalDeductions;
    salesReturn.netRefundAmount = Math.max(0, salesReturn.totalRefundAmount - totalDeductions);
    salesReturn.status = "UNDER_INSPECTION";
    salesReturn.inspectionNotes = input.inspectionNotes?.trim();
    salesReturn.inspectedBy = actId;
    salesReturn.inspectedAt = new Date();

    await salesReturn.save();
    return salesReturn;
  }

  /**
   * Approve or Reject a Customer Sales Return
   */
  static async approveSalesReturn(
    returnIdOrInput: string | ApproveSalesReturnInput | any,
    options?: any
  ): Promise<ISalesReturn> {
    const input = typeof returnIdOrInput === "string"
      ? { returnId: returnIdOrInput, ...options }
      : { ...returnIdOrInput, ...options };

    const rId = new mongoose.Types.ObjectId(String(input.returnId));
    const actId = input.actorId ? new mongoose.Types.ObjectId(String(input.actorId)) : undefined;

    const salesReturn = await SalesReturn.findById(rId).session(input.session || null);
    if (!salesReturn) throw new Error("Sales Return record not found");

    // Idempotent: already approved
    if (salesReturn.status === "APPROVED" || salesReturn.status === "RESTOCKED") {
      return salesReturn;
    }

    const isReject = input.decision === "reject" || input.action === "REJECT";

    if (isReject) {
      salesReturn.status = "REJECTED";
      salesReturn.rejectionReason = input.rejectionReason?.trim() || "Rejected by authorized manager";
      salesReturn.refundStatus = "REJECTED";
      await salesReturn.save({ session: input.session });
      return salesReturn;
    }

    // Process Approved Return: Restock Good goods, Quarantine Damaged goods
    for (const item of salesReturn.items) {
      const bal = await InventoryService.getOrCreateBalance(
        salesReturn.businessId,
        salesReturn.dealershipId,
        salesReturn.warehouseId,
        item.productId,
        item.variantId,
        input.session
      );

      const isGood =
        item.inspectionClassification === "GOOD_RESTOCKABLE" ||
        item.condition === "good" ||
        item.restockEligible;

      if (isGood) {
        // Restock into sellable inventory
        bal.onHandQuantity += item.returnedQuantity;
        bal.availableQuantity += item.returnedQuantity;
        bal.lastUpdated = new Date();
        await bal.save({ session: input.session });

        const moveCode = generateReferenceCode("STK-RET", Math.floor(Math.random() * 9000 + 1000));
        await StockMovement.create(
          [
            {
              movementNumber: moveCode,
              movementType: "sales_return",
              type: "sales_return",
              businessId: salesReturn.businessId,
              dealershipId: salesReturn.dealershipId,
              productId: item.productId,
              variantId: item.variantId,
              warehouseId: salesReturn.warehouseId,
              quantity: item.returnedQuantity,
              previousOnHand: bal.onHandQuantity - item.returnedQuantity,
              newOnHand: bal.onHandQuantity,
              previousReserved: bal.reservedQuantity,
              newReserved: bal.reservedQuantity,
              referenceType: "sales_return",
              referenceId: salesReturn.returnNumber,
              notes: `Approved customer return restocked: ${salesReturn.returnNumber}`,
              createdBy: actId,
            } as any,
          ],
          input.session ? { session: input.session } : {}
        );
      } else {
        // Quarantined as damaged / expired - onHand increases, damagedQuantity increases, availableQuantity untouched
        bal.onHandQuantity += item.returnedQuantity;
        bal.damagedQuantity = (bal.damagedQuantity || 0) + item.returnedQuantity;
        bal.lastUpdated = new Date();
        await bal.save({ session: input.session });

        const moveCode = generateReferenceCode("STK-DMG", Math.floor(Math.random() * 9000 + 1000));
        await StockMovement.create(
          [
            {
              movementNumber: moveCode,
              movementType: "sales_return_damage",
              type: "damage",
              businessId: salesReturn.businessId,
              dealershipId: salesReturn.dealershipId,
              productId: item.productId,
              variantId: item.variantId,
              warehouseId: salesReturn.warehouseId,
              quantity: item.returnedQuantity,
              previousOnHand: bal.onHandQuantity - item.returnedQuantity,
              newOnHand: bal.onHandQuantity,
              previousReserved: bal.reservedQuantity,
              newReserved: bal.reservedQuantity,
              referenceType: "sales_return_damage",
              referenceId: salesReturn.returnNumber,
              notes: `Damaged return quarantined: ${salesReturn.returnNumber}`,
              createdBy: actId,
            } as any,
          ],
          input.session ? { session: input.session } : {}
        );
      }
    }

    salesReturn.status = "RESTOCKED";
    salesReturn.restocked = true;
    salesReturn.restockedAt = new Date();
    salesReturn.refundStatus = "PENDING";
    salesReturn.approvedBy = actId;
    salesReturn.approvedAt = new Date();

    await salesReturn.save({ session: input.session });

    if (actId) {
      await AuditLog.create({
        actorId: actId,
        action: "SALES_RETURN_APPROVED",
        entityType: "sales_return",
        entityId: String(salesReturn._id),
      });
    }

    return salesReturn;
  }

  /**
   * Process Customer Credit Note or Cash Refund
   */
  static async processCustomerRefund(
    returnIdOrInput: string | ProcessCustomerRefundInput | any,
    options?: any
  ): Promise<ISalesReturn> {
    const input = typeof returnIdOrInput === "string"
      ? { returnId: returnIdOrInput, ...options }
      : { ...returnIdOrInput, ...options };

    const rId = new mongoose.Types.ObjectId(String(input.returnId));
    const actId = input.actorId ? new mongoose.Types.ObjectId(String(input.actorId)) : undefined;

    const salesReturn = await SalesReturn.findById(rId).session(input.session || null);
    if (!salesReturn) throw new Error("Sales Return record not found");

    // Idempotency: Prevent duplicate refund execution
    if (salesReturn.refundStatus === "REFUNDED" || salesReturn.refundStatus === "CREDIT_NOTE_ISSUED" || salesReturn.status === "CLOSED") {
      return salesReturn;
    }

    if (salesReturn.status !== "APPROVED" && salesReturn.status !== "RESTOCKED") {
      throw new Error(`Cannot process refund for return in status '${salesReturn.status}'. Must be APPROVED.`);
    }

    const approvedMax = salesReturn.netRefundAmount || salesReturn.totalRefundAmount;
    const requestedRefund = input.refundAmount !== undefined ? Number(input.refundAmount) : approvedMax;

    if (requestedRefund > approvedMax) {
      throw new Error(
        `Refund amount exceeds approved return amount (max: ৳${approvedMax.toFixed(2)})`
      );
    }

    // Dealership Customer Account Financial Adjustment
    const account = await CustomerDealershipAccount.findOne({
      dealershipId: salesReturn.dealershipId,
      customerId: salesReturn.customerId,
      isDeleted: false,
    }).session(input.session || null);

    const isCreditNote = input.refundMethod === "credit_note" || input.refundMethod === "adjustment";

    if (account) {
      if (isCreditNote) {
        account.currentBalance = Math.max(0, (account.currentBalance || 0) - requestedRefund);
        account.totalReturned = (account.totalReturned || 0) + requestedRefund;
        await account.save({ session: input.session });
        salesReturn.refundStatus = "CREDIT_NOTE_ISSUED";
      } else {
        // Cash or Bank Transfer payout
        account.totalReturned = (account.totalReturned || 0) + requestedRefund;
        await account.save({ session: input.session });
        salesReturn.refundStatus = "REFUNDED";
      }
    } else {
      salesReturn.refundStatus = isCreditNote ? "CREDIT_NOTE_ISSUED" : "REFUNDED";
    }

    salesReturn.refundMethod = input.refundMethod;
    salesReturn.refundedAmount = requestedRefund;
    salesReturn.refundReference = input.reference?.trim() || input.refundReference?.trim() || "REFUND-SETTLED";
    salesReturn.refundedAt = new Date();
    salesReturn.status = "CLOSED";

    await salesReturn.save({ session: input.session });

    if (actId) {
      await AuditLog.create({
        actorId: actId,
        action: "SALES_RETURN_REFUNDED",
        entityType: "sales_return",
        entityId: String(salesReturn._id),
        afterSnapshot: {
          refundMethod: input.refundMethod,
          refundedAmount: requestedRefund,
        },
      });
    }

    return salesReturn;
  }

  // ==========================================
  // SUPPLIER PURCHASE RETURNS
  // ==========================================

  /**
   * Create a Supplier Purchase Return
   */
  static async createPurchaseReturn(input: CreatePurchaseReturnInput): Promise<IPurchaseReturn> {
    const bId = new mongoose.Types.ObjectId(String(input.businessId));
    const dId = new mongoose.Types.ObjectId(String(input.dealershipId));
    const gId = new mongoose.Types.ObjectId(String(input.grnId));
    const actId = input.actorId ? new mongoose.Types.ObjectId(String(input.actorId)) : undefined;

    const grn = await GoodsReceiptNote.findById(gId);
    if (!grn) throw new Error("Referenced Goods Receipt Note (GRN) not found");

    if (grn.status !== "VERIFIED") {
      throw new Error(`Cannot create purchase return against GRN in status '${grn.status}'. Must be VERIFIED.`);
    }

    // Calculate previously returned quantities for this GRN
    const existingReturns = await PurchaseReturn.find({
      grnId: gId,
      status: { $nin: ["REJECTED", "CANCELLED"] },
    }).lean();

    const previousReturnMap = new Map<string, number>();
    for (const er of existingReturns) {
      for (const it of er.items) {
        const vKey = String(it.variantId || it.productId);
        previousReturnMap.set(vKey, (previousReturnMap.get(vKey) || 0) + (it.returnedQuantity ?? (it as any).quantity));
      }
    }

    let totalDebit = 0;
    const returnItems: IPurchaseReturnItem[] = [];

    for (const it of input.items) {
      const pId = new mongoose.Types.ObjectId(String(it.productId));
      const requestedQty = Math.max(1, Number(it.returnedQuantity ?? (it as any).quantity));

      const grnLine = grn.items.find((gi: any) =>
        it.variantId
          ? String(gi.variantId) === String(it.variantId)
          : String(gi.productId) === String(pId) || String(gi.variantId) === String(pId)
      );
      if (!grnLine) {
        throw new Error(`Product ${pId} does not belong to GRN ${grn.grnNumber}`);
      }

      const vId = it.variantId
        ? new mongoose.Types.ObjectId(String(it.variantId))
        : (grnLine.variantId ? new mongoose.Types.ObjectId(String(grnLine.variantId)) : pId);

      const receivedQty = grnLine.receivedQuantity;
      const key = String(vId || pId);
      const alreadyReturned = previousReturnMap.get(key) || 0;
      const maxEligible = receivedQty - alreadyReturned;

      if (requestedQty > maxEligible) {
        throw new Error(
          `Purchase return quantity (${requestedQty}) exceeds available received quantity (${maxEligible}) for GRN line`
        );
      }

      const unitCost = grnLine.netLandedUnitCost || grnLine.unitPurchasePrice || 0;
      const debitAmt = Math.round(requestedQty * unitCost * 100) / 100;
      totalDebit += debitAmt;

      returnItems.push({
        productId: pId,
        variantId: vId,
        batchNumber: it.batchNumber || grnLine.batchNumber,
        name: grnLine.productName || (it as any).name || "Product Item",
        sku: grnLine.sku || (it as any).sku || "SKU-N/A",
        returnedQuantity: requestedQty,
        unitCostSnapshot: unitCost,
        debitAmount: debitAmt,
        reason: it.reason,
      });
    }

    const returnNumber = await this.generatePurchaseReturnNumber(bId);

    // Link Supplier Payable if exists
    const payable = await SupplierPayable.findOne({ grnId: gId, isCancelled: false });

    const purchaseReturn = await PurchaseReturn.create({
      returnNumber,
      businessId: bId,
      dealershipId: dId,
      grnId: gId,
      grnNumber: grn.grnNumber,
      purchaseId: grn.purchaseOrderId || undefined,
      purchaseNumber: grn.invoiceNumber || grn.challanNumber,
      vendorId: grn.supplierId,
      warehouseId: grn.warehouseId,
      supplierPayableId: payable?._id,
      items: returnItems,
      totalDebitAmount: totalDebit,
      settledAmount: 0,
      reason: input.reason.trim(),
      status: "SUBMITTED",
      supplierAuthorizationRef: input.supplierAuthorizationRef?.trim(),
      notes: input.notes?.trim(),
      createdBy: actId,
    });

    if (actId) {
      await AuditLog.create({
        actorId: actId,
        action: "PURCHASE_RETURN_CREATED",
        entityType: "purchase_return",
        entityId: String(purchaseReturn._id),
      });
    }

    return purchaseReturn;
  }

  /**
   * Dispatch Purchase Return to Supplier: Atomically removes available stock
   */
  static async dispatchPurchaseReturn(
    returnIdOrParams: string | mongoose.Types.ObjectId | {
      returnId: string | mongoose.Types.ObjectId;
      actorId?: string | mongoose.Types.ObjectId;
      session?: mongoose.ClientSession;
    },
    options?: { actorId?: string | mongoose.Types.ObjectId; session?: mongoose.ClientSession }
  ): Promise<IPurchaseReturn> {
    const params = typeof returnIdOrParams === "string" || returnIdOrParams instanceof mongoose.Types.ObjectId
      ? { returnId: returnIdOrParams, ...options }
      : { ...returnIdOrParams, ...options };

    const rId = new mongoose.Types.ObjectId(String(params.returnId));
    const actId = params.actorId ? new mongoose.Types.ObjectId(String(params.actorId)) : undefined;

    const pr = await PurchaseReturn.findById(rId).session(params.session || null);
    if (!pr) throw new Error("Purchase Return record not found");

    if (pr.status === "DISPATCHED" || pr.status === "SETTLED") {
      return pr;
    }

    // Invariant: Verify available inventory; never clamp or create negative stock
    for (const item of pr.items) {
      const bal = await InventoryService.getOrCreateBalance(
        pr.businessId,
        pr.dealershipId,
        pr.warehouseId,
        item.productId,
        item.variantId,
        params.session
      );

      if (bal.availableQuantity < item.returnedQuantity) {
        throw new Error(
          `Insufficient available stock to dispatch return for variant ${item.name}. Available: ${bal.availableQuantity}, Returning: ${item.returnedQuantity}`
        );
      }

      bal.onHandQuantity -= item.returnedQuantity;
      bal.availableQuantity -= item.returnedQuantity;
      bal.lastUpdated = new Date();
      await bal.save({ session: params.session });

      const moveCode = generateReferenceCode("STK-PRT", Math.floor(Math.random() * 9000 + 1000));
      await StockMovement.create(
        [
          {
            movementNumber: moveCode,
            movementType: "purchase_return",
            type: "purchase_return",
            businessId: pr.businessId,
            dealershipId: pr.dealershipId,
            productId: item.productId,
            variantId: item.variantId,
            warehouseId: pr.warehouseId,
            quantity: item.returnedQuantity,
            unitCost: item.unitCostSnapshot,
            totalCost: item.debitAmount,
            previousOnHand: bal.onHandQuantity + item.returnedQuantity,
            newOnHand: bal.onHandQuantity,
            previousReserved: bal.reservedQuantity,
            newReserved: bal.reservedQuantity,
            referenceType: "purchase_return",
            referenceId: pr.returnNumber,
            notes: `Dispatched return to supplier ${pr.vendorId}`,
            createdBy: actId,
          } as any,
        ],
        params.session ? { session: params.session } : {}
      );
    }

    pr.status = "DISPATCHED";
    pr.dispatchedAt = new Date();
    pr.dispatchedBy = actId;
    await pr.save({ session: params.session });

    return pr;
  }

  /**
   * Settle Purchase Return with Supplier: Adjusts SupplierPayable and Vendor liability
   */
  static async settlePurchaseReturn(
    returnIdOrParams: string | mongoose.Types.ObjectId | {
      returnId: string | mongoose.Types.ObjectId;
      settlementType?: "payable_deduction" | "supplier_refund" | "replacement";
      creditNoteNumber?: string;
      settledAmount?: number;
      actorId?: string | mongoose.Types.ObjectId;
      session?: mongoose.ClientSession;
    },
    options?: any
  ): Promise<IPurchaseReturn> {
    const params = typeof returnIdOrParams === "string" || returnIdOrParams instanceof mongoose.Types.ObjectId
      ? { returnId: returnIdOrParams, ...options }
      : { ...returnIdOrParams, ...options };

    const rId = new mongoose.Types.ObjectId(String(params.returnId));
    const pr = await PurchaseReturn.findById(rId).session(params.session || null);
    if (!pr) throw new Error("Purchase Return not found");

    if (pr.status === "SETTLED") {
      return pr;
    }

    const type = params.settlementType || "payable_deduction";
    const amount = params.settledAmount !== undefined ? Number(params.settledAmount) : pr.totalDebitAmount;

    if (type === "payable_deduction") {
      if (pr.supplierPayableId) {
        const payable = await SupplierPayable.findById(pr.supplierPayableId).session(params.session || null);
        if (payable) {
          if (payable.outstandingBalance !== undefined) {
            payable.outstandingBalance = Math.max(0, payable.outstandingBalance - amount);
          }
          if ((payable as any).remainingAmount !== undefined) {
            (payable as any).remainingAmount = Math.max(0, (payable as any).remainingAmount - amount);
          }
          payable.paidAmount = (payable.paidAmount || 0) + amount;
          if (payable.outstandingBalance === 0 || (payable as any).remainingAmount === 0) {
            payable.status = "PAID";
          }
          await payable.save({ session: params.session });
        }
      }

      const vendor = await Vendor.findById(pr.vendorId).session(params.session || null);
      if (vendor) {
        vendor.currentPayable = Math.max(0, (vendor.currentPayable || 0) - amount);
        await vendor.save({ session: params.session });
      } else {
        await Vendor.findByIdAndUpdate(
          pr.vendorId,
          { $inc: { currentPayable: -amount } },
          { session: params.session || null }
        );
      }
    }

    pr.status = "SETTLED";
    pr.settlementType = type;
    pr.settledAmount = amount;
    pr.creditNoteNumber = params.creditNoteNumber?.trim();
    pr.settledAt = new Date();
    await pr.save({ session: params.session });

    return pr;
  }

  // ==========================================
  // CLAIMS MANAGEMENT (DAMAGE, SHORTAGE, PRINCIPAL)
  // ==========================================

  /**
   * Create an Operational, Transit Damage, or Principal Reimbursement Claim
   */
  static async createClaim(input: CreateClaimInput | any): Promise<IClaim> {
    const bId = new mongoose.Types.ObjectId(String(input.businessId));
    const dId = new mongoose.Types.ObjectId(String(input.dealershipId));
    const actId = input.actorId ? new mongoose.Types.ObjectId(String(input.actorId)) : undefined;

    const claimNumber = await this.generateClaimNumber(bId);

    const claim: any = await Claim.create({
      claimNumber,
      businessId: bId,
      dealershipId: dId,
      principalCompanyId: input.principalCompanyId
        ? new mongoose.Types.ObjectId(String(input.principalCompanyId))
        : undefined,
      vendorId: input.vendorId ? new mongoose.Types.ObjectId(String(input.vendorId)) : undefined,
      claimCategory: input.category || input.claimCategory || "operational_claim",
      title: input.title || input.reason || "Loss / Damage Claim",
      claimedAgainstType: input.claimedAgainstType || "internal",
      referenceType: input.referenceType,
      referenceId: input.referenceId?.trim(),
      referenceDocId: input.referenceDocId
        ? new mongoose.Types.ObjectId(String(input.referenceDocId))
        : undefined,
      items: (input.items || []).map((it: any) => ({
        productId: it.productId ? new mongoose.Types.ObjectId(String(it.productId)) : undefined,
        variantId: it.variantId ? new mongoose.Types.ObjectId(String(it.variantId)) : undefined,
        name: it.name,
        sku: it.sku,
        batchNumber: it.batchNumber,
        quantity: it.quantity,
        unitCost: it.unitCost,
        claimedAmount: it.claimedAmount,
        reason: it.reason,
      })),
      claimedAmount: Number(input.claimedAmount),
      status: "SUBMITTED",
      reason: input.reason?.trim() || input.title?.trim() || "Loss Claim",
      calculationBasis: input.calculationBasis?.trim(),
      evidenceAttachments: input.evidenceAttachments,
      submittedBy: actId,
      submittedDate: new Date(),
    });

    if (actId) {
      await AuditLog.create({
        actorId: actId,
        action: "CLAIM_SUBMITTED",
        entityType: "claim",
        entityId: String(claim._id),
        afterSnapshot: {
          claimNumber,
          category: input.claimCategory || input.category,
          amount: input.claimedAmount,
        },
      });
    }

    return claim;
  }

  /**
   * Approve or Review Claim
   */
  static async approveClaim(
    claimIdOrParams: string | mongoose.Types.ObjectId | {
      claimId: string | mongoose.Types.ObjectId;
      approvedAmount?: number;
      notes?: string;
      actorId?: string | mongoose.Types.ObjectId;
    },
    options?: { approvedAmount?: number; notes?: string; actorId?: string | mongoose.Types.ObjectId }
  ): Promise<IClaim> {
    const params = typeof claimIdOrParams === "string" || claimIdOrParams instanceof mongoose.Types.ObjectId
      ? { claimId: claimIdOrParams, ...options }
      : { ...claimIdOrParams, ...options };

    const cId = new mongoose.Types.ObjectId(String(params.claimId));
    const actId = params.actorId ? new mongoose.Types.ObjectId(String(params.actorId)) : undefined;

    const claim = await Claim.findById(cId);
    if (!claim) throw new Error("Claim record not found");

    if (claim.status === "SETTLED") {
      return claim;
    }

    const appAmt = params.approvedAmount !== undefined ? Number(params.approvedAmount) : claim.claimedAmount;

    claim.status = "APPROVED";
    claim.approvedAmount = appAmt;
    claim.reviewedBy = actId;
    claim.reviewedAt = new Date();
    if (params.notes) claim.notes = params.notes;

    await claim.save();
    return claim;
  }

  /**
   * Settle Claim (Receives Reimbursement or Resolves Liability)
   */
  static async settleClaim(
    claimIdOrParams: string | mongoose.Types.ObjectId | {
      claimId: string | mongoose.Types.ObjectId;
      settlementRef?: string;
      settledAmount?: number;
      notes?: string;
      actorId?: string | mongoose.Types.ObjectId;
    },
    options?: { settlementRef?: string; settledAmount?: number; notes?: string; actorId?: string | mongoose.Types.ObjectId }
  ): Promise<IClaim> {
    const params = typeof claimIdOrParams === "string" || claimIdOrParams instanceof mongoose.Types.ObjectId
      ? { claimId: claimIdOrParams, ...options }
      : { ...claimIdOrParams, ...options };

    const cId = new mongoose.Types.ObjectId(String(params.claimId));

    const claim = await Claim.findById(cId);
    if (!claim) throw new Error("Claim record not found");

    if (claim.status === "SETTLED") {
      return claim;
    }

    const setAmt = params.settledAmount !== undefined ? Number(params.settledAmount) : claim.approvedAmount || claim.claimedAmount;

    claim.status = "SETTLED";
    claim.settledAmount = setAmt;
    claim.settlementRef = params.settlementRef?.trim() || "SETTLED";
    claim.settlementDate = new Date();
    if (params.notes) claim.settlementNotes = params.notes;

    await claim.save();
    return claim;
  }

  /**
   * Reject Claim
   */
  static async rejectClaim(
    claimIdOrParams: string | mongoose.Types.ObjectId | {
      claimId: string | mongoose.Types.ObjectId;
      rejectionReason?: string;
      actorId?: string | mongoose.Types.ObjectId;
    },
    options?: { rejectionReason?: string; actorId?: string | mongoose.Types.ObjectId }
  ): Promise<IClaim> {
    const params = typeof claimIdOrParams === "string" || claimIdOrParams instanceof mongoose.Types.ObjectId
      ? { claimId: claimIdOrParams, ...options }
      : { ...claimIdOrParams, ...options };

    const cId = new mongoose.Types.ObjectId(String(params.claimId));
    const actId = params.actorId ? new mongoose.Types.ObjectId(String(params.actorId)) : undefined;

    const claim = await Claim.findById(cId);
    if (!claim) throw new Error("Claim record not found");

    claim.status = "REJECTED";
    claim.rejectionReason = params.rejectionReason?.trim() || "Claim rejected";
    claim.reviewedBy = actId;
    claim.reviewedAt = new Date();

    await claim.save();
    return claim;
  }

  // ==========================================
  // QUERY & ACCESS HELPERS
  // ==========================================

  static async getSalesReturnDetails(
    returnId: string | mongoose.Types.ObjectId,
    userContextOrDealershipId?: string | mongoose.Types.ObjectId | { role?: string; dealershipId?: string | mongoose.Types.ObjectId }
  ): Promise<ISalesReturn | null> {
    const rId = new mongoose.Types.ObjectId(String(returnId));
    const ret = await SalesReturn.findById(rId)
      .populate("orderId", "orderNumber orderDate grandTotal fulfillmentStatus")
      .populate("customerId", "name shopName phone address")
      .populate("warehouseId", "name code")
      .populate("dealershipId", "name code")
      .lean();

    if (!ret) return null;

    const targetDealershipId =
      typeof userContextOrDealershipId === "string" || userContextOrDealershipId instanceof mongoose.Types.ObjectId
        ? String(userContextOrDealershipId)
        : userContextOrDealershipId?.dealershipId
        ? String(userContextOrDealershipId.dealershipId)
        : undefined;

    const role =
      typeof userContextOrDealershipId === "object" && !(userContextOrDealershipId instanceof mongoose.Types.ObjectId)
        ? userContextOrDealershipId.role
        : undefined;

    if (targetDealershipId && role !== "owner" && role !== "admin" && role !== "super_admin") {
      const returnDealershipId = String((ret.dealershipId as any)?._id || ret.dealershipId);
      if (returnDealershipId !== targetDealershipId) {
        throw new Error("Unauthorized access to return in another dealership (403 Forbidden)");
      }
    }

    return ret as any;
  }

  static async listSalesReturns(params: {
    businessId: string | mongoose.Types.ObjectId;
    dealershipId?: string | mongoose.Types.ObjectId;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const query: Record<string, any> = {
      businessId: new mongoose.Types.ObjectId(String(params.businessId)),
    };
    if (params.dealershipId) {
      query.dealershipId = new mongoose.Types.ObjectId(String(params.dealershipId));
    }
    if (params.status) {
      query.status = params.status;
    }

    const page = Math.max(1, Number(params.page || 1));
    const limit = Math.min(100, Math.max(1, Number(params.limit || 20)));
    const skip = (page - 1) * limit;

    const [returns, total] = await Promise.all([
      SalesReturn.find(query)
        .populate("customerId", "name shopName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SalesReturn.countDocuments(query),
    ]);

    return { returns, pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 } };
  }

  static async listPurchaseReturns(params: {
    businessId: string | mongoose.Types.ObjectId;
    dealershipId?: string | mongoose.Types.ObjectId;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const query: Record<string, any> = {
      businessId: new mongoose.Types.ObjectId(String(params.businessId)),
    };
    if (params.dealershipId) {
      query.dealershipId = new mongoose.Types.ObjectId(String(params.dealershipId));
    }
    if (params.status) {
      query.status = params.status;
    }

    const page = Math.max(1, Number(params.page || 1));
    const limit = Math.min(100, Math.max(1, Number(params.limit || 20)));
    const skip = (page - 1) * limit;

    const [returns, total] = await Promise.all([
      PurchaseReturn.find(query)
        .populate("vendorId", "name companyName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PurchaseReturn.countDocuments(query),
    ]);

    return { returns, pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 } };
  }

  static async listClaims(params: {
    businessId: string | mongoose.Types.ObjectId;
    dealershipId?: string | mongoose.Types.ObjectId;
    status?: string;
    claimCategory?: string;
    page?: number;
    limit?: number;
  }) {
    const query: Record<string, any> = {
      businessId: new mongoose.Types.ObjectId(String(params.businessId)),
    };
    if (params.dealershipId) {
      query.dealershipId = new mongoose.Types.ObjectId(String(params.dealershipId));
    }
    if (params.status) {
      query.status = params.status;
    }
    if (params.claimCategory) {
      query.claimCategory = params.claimCategory;
    }

    const page = Math.max(1, Number(params.page || 1));
    const limit = Math.min(100, Math.max(1, Number(params.limit || 20)));
    const skip = (page - 1) * limit;

    const [claims, total] = await Promise.all([
      Claim.find(query)
        .populate("principalCompanyId", "name")
        .populate("vendorId", "name")
        .sort({ submittedDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Claim.countDocuments(query),
    ]);

    return { claims, pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 } };
  }
}
