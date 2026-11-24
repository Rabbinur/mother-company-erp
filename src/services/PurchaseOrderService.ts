import mongoose from "mongoose";
import { Purchase, type IPurchase, type IPurchaseItem, type PurchaseOrderStatus } from "@/models/Purchase";
import { Vendor } from "@/models/Vendor";
import { Warehouse } from "@/models/Warehouse";
import { Dealership } from "@/models/Dealership";
import { AuditLog } from "@/models/AuditLog";
import { generateReferenceCode } from "@/lib/utils";

export interface CreatePurchaseOrderItemInput {
  productId: string | mongoose.Types.ObjectId;
  variantId?: string | mongoose.Types.ObjectId;
  name?: string;
  sku?: string;
  orderedQuantity?: number;
  quantity?: number;
  expectedPurchaseRate?: number;
  unitPrice?: number;
  estimatedDiscount?: number;
  discount?: number;
  tax?: number;
  supplierSchemeInfo?: string;
}

export interface CreatePurchaseOrderInput {
  businessId: string | mongoose.Types.ObjectId;
  dealershipId?: string | mongoose.Types.ObjectId;
  principalCompanyId?: string | mongoose.Types.ObjectId | null;
  supplierId: string | mongoose.Types.ObjectId;
  warehouseId?: string | mongoose.Types.ObjectId;
  orderDate?: Date | string;
  expectedDeliveryDate?: Date | string;
  items: CreatePurchaseOrderItemInput[];
  status?: "DRAFT" | "SUBMITTED";
  notes?: string;
  actorId?: string | mongoose.Types.ObjectId;
}

export interface UpdatePurchaseOrderInput {
  expectedDeliveryDate?: Date | string;
  items?: CreatePurchaseOrderItemInput[];
  notes?: string;
  actorId?: string | mongoose.Types.ObjectId;
}

export class PurchaseOrderService {
  /**
   * Create a new Purchase Order in DRAFT or SUBMITTED status.
   * INVARIANT: Never increases inventory. Never creates supplier payable.
   */
  static async createPurchaseOrder(input: CreatePurchaseOrderInput): Promise<IPurchase> {
    const bId = new mongoose.Types.ObjectId(String(input.businessId));
    const dId = input.dealershipId
      ? new mongoose.Types.ObjectId(String(input.dealershipId))
      : null;
    const wId = input.warehouseId
      ? new mongoose.Types.ObjectId(String(input.warehouseId))
      : null;
    const sId = new mongoose.Types.ObjectId(String(input.supplierId));
    const pCompId = input.principalCompanyId
      ? new mongoose.Types.ObjectId(String(input.principalCompanyId))
      : null;
    const actId = input.actorId
      ? new mongoose.Types.ObjectId(String(input.actorId))
      : null;

    if (wId) {
      const warehouse = await Warehouse.findById(wId);
      if (!warehouse) throw new Error("Warehouse not found");
    }

    if (!input.items || input.items.length === 0) {
      throw new Error("Purchase Order must contain at least one line item");
    }

    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;

    const items: IPurchaseItem[] = input.items.map((i) => {
      const qty = Math.max(1, Number(i.orderedQuantity !== undefined ? i.orderedQuantity : i.quantity || 1));
      const rate = Math.max(0, Number(i.expectedPurchaseRate !== undefined ? i.expectedPurchaseRate : i.unitPrice || 0));
      const disc = Math.max(0, Number(i.estimatedDiscount !== undefined ? i.estimatedDiscount : i.discount || 0));
      const tx = Math.max(0, Number(i.tax || 0));
      const itemSub = qty * rate - disc + tx;

      subtotal += qty * rate;
      discountTotal += disc;
      taxTotal += tx;

      return {
        productId: new mongoose.Types.ObjectId(String(i.productId)),
        variantId: i.variantId ? new mongoose.Types.ObjectId(String(i.variantId)) : (undefined as any),
        name: i.name?.trim() || "Item",
        sku: i.sku?.trim() || "",
        orderedQuantity: qty,
        quantity: qty,
        receivedQuantity: 0,
        remainingQuantity: qty,
        unitCost: rate,
        unitPrice: rate,
        discount: disc,
        tax: tx,
        subtotal: itemSub,
        lineTotal: itemSub,
        supplierSchemeInfo: i.supplierSchemeInfo?.trim(),
      } as any;
    });

    const grandTotal = Math.max(0, subtotal - discountTotal + taxTotal);
    const purchaseNumber = generateReferenceCode("PO", Math.floor(Math.random() * 9000 + 1000));
    const initialStatus = input.status === "SUBMITTED" ? "SUBMITTED" : "DRAFT";

    const po = await Purchase.create({
      businessId: bId,
      dealershipId: dId,
      principalCompanyId: pCompId,
      vendorId: sId,
      supplierId: sId,
      warehouseId: wId,
      purchaseNumber,
      orderNumber: purchaseNumber,
      status: initialStatus,
      items,
      subtotal,
      discountTotal,
      taxTotal,
      grandTotal,
      totalAmount: grandTotal,
      paidAmount: 0,
      balanceDue: grandTotal,
      orderDate: input.orderDate ? new Date(input.orderDate) : new Date(),
      expectedDate: input.expectedDeliveryDate ? new Date(input.expectedDeliveryDate) : undefined,
      submittedAt: initialStatus === "SUBMITTED" ? new Date() : undefined,
      submittedBy: initialStatus === "SUBMITTED" ? actId : undefined,
      notes: input.notes?.trim(),
      createdBy: actId,
    } as any);

    if (actId) {
      await AuditLog.create({
        actorId: actId,
        action: "PURCHASE_ORDER_CREATED",
        entityType: "purchase_order",
        entityId: String(po._id),
        afterSnapshot: {
          purchaseNumber,
          status: initialStatus,
          grandTotal,
          itemCount: items.length,
        },
      });
    }

    return po;
  }

  /**
   * Submit a Draft Purchase Order
   */
  static async submitPurchaseOrder(
    poId: string | mongoose.Types.ObjectId,
    actorId: string | mongoose.Types.ObjectId
  ): Promise<IPurchase> {
    const po = await Purchase.findById(poId);
    if (!po) throw new Error("Purchase Order not found");

    if (po.status !== "draft" && po.status !== "DRAFT") {
      throw new Error(`Cannot submit Purchase Order in status '${po.status}'`);
    }

    po.status = "SUBMITTED";
    po.submittedAt = new Date();
    po.submittedBy = new mongoose.Types.ObjectId(String(actorId));
    await po.save();

    await AuditLog.create({
      actorId: new mongoose.Types.ObjectId(String(actorId)),
      action: "PURCHASE_ORDER_SUBMITTED",
      entityType: "purchase_order",
      entityId: String(po._id),
    });

    return po;
  }

  /**
   * Cancel an unfulfilled Purchase Order
   */
  static async cancelPurchaseOrder(
    poIdOrParams: string | mongoose.Types.ObjectId | {
      poId: string | mongoose.Types.ObjectId;
      reason?: string;
      actorId?: string | mongoose.Types.ObjectId;
    },
    reasonParam?: string,
    actorIdParam?: string | mongoose.Types.ObjectId
  ): Promise<IPurchase> {
    const poId = typeof poIdOrParams === "object" && "poId" in poIdOrParams ? poIdOrParams.poId : poIdOrParams;
    const reason = typeof poIdOrParams === "object" && "reason" in poIdOrParams ? poIdOrParams.reason : reasonParam || "Cancelled";
    const actorId = typeof poIdOrParams === "object" && "actorId" in poIdOrParams ? poIdOrParams.actorId : actorIdParam;

    const po = await Purchase.findById(poId);
    if (!po) throw new Error("Purchase Order not found");

    const activeStatuses = ["draft", "DRAFT", "submitted", "SUBMITTED", "ordered"];
    if (!activeStatuses.includes(po.status)) {
      throw new Error(`Cannot cancel Purchase Order in status '${po.status}'`);
    }

    po.status = "CANCELLED";
    po.cancelledAt = new Date();
    if (actorId) po.cancelledBy = new mongoose.Types.ObjectId(String(actorId));
    po.cancellationReason = reason?.trim();
    await po.save();

    if (actorId) {
      await AuditLog.create({
        actorId: new mongoose.Types.ObjectId(String(actorId)),
        action: "PURCHASE_ORDER_CANCELLED",
        entityType: "purchase_order",
        entityId: String(po._id),
        afterSnapshot: { reason },
      });
    }

    return po;
  }

  /**
   * Atomically record physical receiving against PO from verified GRN
   */
  static async recordGrnReceipt(params: {
    poId: string | mongoose.Types.ObjectId;
    grnId: string | mongoose.Types.ObjectId;
    receivedItems: Array<{
      productId: string | mongoose.Types.ObjectId;
      variantId: string | mongoose.Types.ObjectId;
      receivedQuantity: number;
    }>;
    session?: mongoose.ClientSession;
  }): Promise<IPurchase> {
    const po = await Purchase.findById(params.poId).session(params.session || null);
    if (!po) throw new Error("Purchase Order not found");

    const validStatuses = ["submitted", "SUBMITTED", "ordered", "partially_received", "PARTIALLY_RECEIVED"];
    if (!validStatuses.includes(po.status)) {
      throw new Error(`Cannot record goods receipt against Purchase Order in status '${po.status}'`);
    }

    for (const rec of params.receivedItems) {
      const vIdStr = rec.variantId ? String(rec.variantId) : null;
      const pIdStr = rec.productId ? String(rec.productId) : null;
      const qty = Math.max(0, Number(rec.receivedQuantity));
      if (qty === 0) continue;

      const item = po.items.find((i) => {
        if (vIdStr && i.variantId) return String(i.variantId) === vIdStr;
        if (pIdStr && i.productId) return String(i.productId) === pIdStr;
        return false;
      });

      if (item) {
        const targetQty = item.orderedQuantity !== undefined ? item.orderedQuantity : ((item as any).quantity || 0);
        item.receivedQuantity = (item.receivedQuantity || 0) + qty;
        item.remainingQuantity = Math.max(0, targetQty - item.receivedQuantity);
        (item as any).quantity = targetQty;
      }
    }

    // Link GRN reference
    const grnOid = new mongoose.Types.ObjectId(String(params.grnId));
    if (!po.grnIds) po.grnIds = [];
    if (!po.grnIds.some((id) => String(id) === String(grnOid))) {
      po.grnIds.push(grnOid);
    }

    // Check if fully received
    const allFulfilled = po.items.every((i) => {
      const targetQty = i.orderedQuantity !== undefined ? i.orderedQuantity : ((i as any).quantity || 0);
      return (i.receivedQuantity || 0) >= targetQty;
    });
    po.status = allFulfilled ? "FULLY_RECEIVED" : "PARTIALLY_RECEIVED";
    po.receivedDate = new Date();

    await po.save({ session: params.session });
    return po;
  }

  /**
   * List Purchase Orders with tenancy scoping and search
   */
  static async listPurchaseOrders(params: {
    businessId: string | mongoose.Types.ObjectId;
    dealershipId?: string | mongoose.Types.ObjectId;
    status?: string;
    supplierId?: string;
    warehouseId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const bId = new mongoose.Types.ObjectId(String(params.businessId));
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      $or: [{ businessId: bId }, { businessId: { $exists: false } }],
    };

    if (params.dealershipId) {
      filter.dealershipId = new mongoose.Types.ObjectId(String(params.dealershipId));
    }
    if (params.status) {
      filter.status = { $regex: new RegExp(`^${params.status}$`, "i") };
    }
    if (params.supplierId) {
      filter.vendorId = new mongoose.Types.ObjectId(params.supplierId);
    }
    if (params.warehouseId) {
      filter.warehouseId = new mongoose.Types.ObjectId(params.warehouseId);
    }
    if (params.search) {
      filter.purchaseNumber = { $regex: params.search.trim(), $options: "i" };
    }

    const [orders, total] = await Promise.all([
      Purchase.find(filter)
        .populate("vendorId", "name companyName phone code")
        .populate("warehouseId", "name code")
        .populate("dealershipId", "name code")
        .populate("principalCompanyId", "name code")
        .populate("createdBy", "name email")
        .sort({ orderDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Purchase.countDocuments(filter),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single Purchase Order with populated linked GRNs
   */
  static async getPurchaseOrderDetails(poId: string | mongoose.Types.ObjectId) {
    const po = await Purchase.findById(poId)
      .populate("vendorId", "name companyName phone code address email taxVatNumber")
      .populate("warehouseId", "name code address")
      .populate("dealershipId", "name code")
      .populate("principalCompanyId", "name code")
      .populate("createdBy", "name email")
      .populate("grnIds", "grnNumber challanNumber challanDate status grossTotal netInvoiceTotal")
      .lean();

    if (!po) throw new Error("Purchase Order not found");
    return po;
  }
}
