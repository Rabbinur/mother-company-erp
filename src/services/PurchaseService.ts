import mongoose from "mongoose";
import { Purchase, IPurchase, IPurchaseItem } from "@/models/Purchase";
import { Vendor } from "@/models/Vendor";
import { InventoryService } from "./InventoryService";
import { AccountingService } from "./AccountingService";
import { AuditService } from "./AuditService";
import { generateReferenceCode } from "@/lib/utils";

export interface CreatePurchaseInput {
  vendorId: string | mongoose.Types.ObjectId;
  warehouseId: string | mongoose.Types.ObjectId;
  items: Array<{
    productId: string | mongoose.Types.ObjectId;
    variantId: string | mongoose.Types.ObjectId;
    name: string;
    sku: string;
    orderedQuantity: number;
    unitCost: number;
    discount?: number;
    tax?: number;
  }>;
  orderDate?: Date;
  expectedDate?: Date;
  notes?: string;
  createdBy?: string | mongoose.Types.ObjectId;
}

export class PurchaseService {
  /**
   * Create Purchase Order in 'ordered' or 'draft' status.
   * Crucial rule: Physical stock DOES NOT increase upon purchase creation!
   */
  static async createPurchase(input: CreatePurchaseInput): Promise<IPurchase> {
    const vId = new mongoose.Types.ObjectId(String(input.vendorId));
    const wId = new mongoose.Types.ObjectId(String(input.warehouseId));
    const uId = input.createdBy ? new mongoose.Types.ObjectId(String(input.createdBy)) : undefined;

    const vendor = await Vendor.findById(vId);
    if (!vendor) {
      throw new Error("Vendor not found");
    }

    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;

    const items: IPurchaseItem[] = input.items.map((i) => {
      const qty = Number(i.orderedQuantity);
      const cost = Number(i.unitCost);
      const disc = Number(i.discount || 0);
      const tx = Number(i.tax || 0);
      const itemSub = qty * cost - disc + tx;

      subtotal += qty * cost;
      discountTotal += disc;
      taxTotal += tx;

      return {
        productId: new mongoose.Types.ObjectId(String(i.productId)),
        variantId: new mongoose.Types.ObjectId(String(i.variantId)),
        name: i.name,
        sku: i.sku,
        orderedQuantity: qty,
        receivedQuantity: 0,
        unitCost: cost,
        discount: disc,
        tax: tx,
        subtotal: itemSub,
      };
    });

    const grandTotal = subtotal - discountTotal + taxTotal;
    const purchaseNumber = generateReferenceCode(
      "PUR",
      Math.floor(Math.random() * 9000 + 1000)
    );

    const purchase = await Purchase.create({
      purchaseNumber,
      vendorId: vId,
      warehouseId: wId,
      status: "ordered",
      items,
      subtotal,
      discountTotal,
      taxTotal,
      grandTotal,
      paidAmount: 0,
      balanceDue: grandTotal,
      orderDate: input.orderDate || new Date(),
      expectedDate: input.expectedDate,
      notes: input.notes,
      createdBy: uId,
    });

    await AuditService.log({
      actorId: uId,
      action: "PURCHASE_CREATED",
      entityType: "purchase",
      entityId: String(purchase._id),
      afterSnapshot: { purchaseNumber, grandTotal, itemsCount: items.length },
    });

    return purchase;
  }

  /**
   * Receive Goods: Physical stock increases ONLY upon receiving!
   * Handles partial receiving as well as full receiving.
   * Updates Vendor payable and posts Double-Entry Journal Entry.
   */
  static async receiveGoods(params: {
    purchaseId: string | mongoose.Types.ObjectId;
    receivedItems: Array<{
      variantId: string | mongoose.Types.ObjectId;
      quantityReceived: number;
    }>;
    actorId?: string | mongoose.Types.ObjectId;
    session?: mongoose.ClientSession;
  }): Promise<IPurchase> {
    const pId = new mongoose.Types.ObjectId(String(params.purchaseId));
    const actId = params.actorId ? new mongoose.Types.ObjectId(String(params.actorId)) : undefined;

    const purchase = await Purchase.findById(pId).session(params.session || null);
    if (!purchase) {
      throw new Error("Purchase order not found");
    }

    if (purchase.status === "received" || purchase.status === "cancelled") {
      throw new Error(`Cannot receive goods for purchase in status '${purchase.status}'`);
    }

    let newlyReceivedValue = 0;
    const stockItemsToReceive: Array<{
      productId: mongoose.Types.ObjectId;
      variantId: mongoose.Types.ObjectId;
      quantity: number;
      unitCost: number;
    }> = [];

    for (const rec of params.receivedItems) {
      const vIdStr = String(rec.variantId);
      const qty = Number(rec.quantityReceived);

      if (qty <= 0) continue;

      const item = purchase.items.find((i) => String(i.variantId) === vIdStr);
      if (!item) {
        throw new Error(`Item variant ${vIdStr} is not part of this purchase order`);
      }

      const remainingToReceive = item.orderedQuantity - item.receivedQuantity;
      if (qty > remainingToReceive) {
        throw new Error(
          `Received quantity (${qty}) exceeds remaining ordered quantity (${remainingToReceive}) for ${item.name}`
        );
      }

      item.receivedQuantity += qty;
      newlyReceivedValue += qty * item.unitCost;

      stockItemsToReceive.push({
        productId: item.productId,
        variantId: item.variantId,
        quantity: qty,
        unitCost: item.unitCost,
      });
    }

    if (stockItemsToReceive.length === 0) {
      throw new Error("No valid received quantities provided");
    }

    // 1. Physically receive stock into Central Warehouse inventory
    await InventoryService.receiveStock(
      purchase.warehouseId,
      stockItemsToReceive,
      purchase.purchaseNumber,
      "purchase_receive",
      actId,
      params.session
    );

    // 2. Determine new status: fully received or partially received
    const allReceived = purchase.items.every(
      (i) => i.receivedQuantity >= i.orderedQuantity
    );
    purchase.status = allReceived ? "received" : "partially_received";
    purchase.receivedDate = new Date();
    await purchase.save({ session: params.session });

    // 3. Update Vendor Payable
    await Vendor.findByIdAndUpdate(
      purchase.vendorId,
      { $inc: { currentPayable: newlyReceivedValue } },
      { session: params.session }
    );

    // 4. Double-Entry Accounting: Debit Inventory Asset, Credit Accounts Payable
    try {
      const invAssetAccount = await AccountingService.getAccountBySubType("inventory_asset");
      const apAccount = await AccountingService.getAccountBySubType("accounts_payable");

      await AccountingService.postJournalEntry({
        referenceType: "purchase_receive",
        referenceId: purchase.purchaseNumber,
        narration: `Stock received for Purchase ${purchase.purchaseNumber}`,
        lines: [
          {
            accountId: invAssetAccount._id as mongoose.Types.ObjectId,
            debit: newlyReceivedValue,
            credit: 0,
            description: `Inventory received on ${purchase.purchaseNumber}`,
          },
          {
            accountId: apAccount._id as mongoose.Types.ObjectId,
            debit: 0,
            credit: newlyReceivedValue,
            description: `Payable to vendor on ${purchase.purchaseNumber}`,
          },
        ],
        postedBy: actId,
        session: params.session,
      });
    } catch (accErr) {
      console.error("[PurchaseService.receiveGoods] Accounting entry warning:", accErr);
    }

    await AuditService.log({
      actorId: actId,
      action: "PURCHASE_GOODS_RECEIVED",
      entityType: "purchase",
      entityId: String(purchase._id),
      afterSnapshot: {
        purchaseNumber: purchase.purchaseNumber,
        status: purchase.status,
        newlyReceivedValue,
      },
    });

    return purchase;
  }
}
