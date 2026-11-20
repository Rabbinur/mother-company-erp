import mongoose from "mongoose";
import { PurchaseReturn, IPurchaseReturn, IPurchaseReturnItem } from "@/models/PurchaseReturn";
import { Purchase } from "@/models/Purchase";
import { Vendor } from "@/models/Vendor";
import { InventoryBalance } from "@/models/InventoryBalance";
import { StockMovement } from "@/models/StockMovement";
import { AccountingService } from "./AccountingService";
import { AuditService } from "./AuditService";
import { generateReferenceCode } from "@/lib/utils";

export interface CreatePurchaseReturnInput {
  purchaseId: string | mongoose.Types.ObjectId;
  items: Array<{
    variantId: string | mongoose.Types.ObjectId;
    returnedQuantity: number;
  }>;
  reason: string;
  notes?: string;
  actorId?: string | mongoose.Types.ObjectId;
}

export class PurchaseReturnService {
  static async processReturn(input: CreatePurchaseReturnInput): Promise<IPurchaseReturn> {
    const pId = new mongoose.Types.ObjectId(String(input.purchaseId));
    const actId = input.actorId ? new mongoose.Types.ObjectId(String(input.actorId)) : undefined;

    const purchase = await Purchase.findById(pId);
    if (!purchase) {
      throw new Error("Purchase order not found");
    }

    if (purchase.status !== "received" && purchase.status !== "partially_received") {
      throw new Error("Can only return goods for received or partially received purchases");
    }

    // Check past purchase returns
    const pastReturns = await PurchaseReturn.find({ purchaseId: pId, status: "completed" }).lean();
    const previouslyReturnedQty: Record<string, number> = {};
    for (const pr of pastReturns) {
      for (const item of pr.items) {
        const vKey = String(item.variantId);
        previouslyReturnedQty[vKey] = (previouslyReturnedQty[vKey] || 0) + item.returnedQuantity;
      }
    }

    let totalDebitAmount = 0;
    const returnItems: IPurchaseReturnItem[] = [];

    for (const itemInput of input.items) {
      const vKey = String(itemInput.variantId);
      const retQty = Number(itemInput.returnedQuantity);

      if (retQty <= 0) continue;

      const purchaseItem = purchase.items.find((i) => String(i.variantId) === vKey);
      if (!purchaseItem) {
        throw new Error(`Variant ${vKey} not found in purchase ${purchase.purchaseNumber}`);
      }

      const prevRet = previouslyReturnedQty[vKey] || 0;
      const maxReturnable = purchaseItem.receivedQuantity - prevRet;

      if (retQty > maxReturnable) {
        throw new Error(
          `Cannot return ${retQty} units. Maximum returnable: ${maxReturnable} (Received: ${purchaseItem.receivedQuantity}, Returned: ${prevRet})`
        );
      }

      // Check current available stock in warehouse
      const balance = await InventoryBalance.findOne({
        warehouseId: purchase.warehouseId,
        productId: purchaseItem.productId,
        variantId: purchaseItem.variantId,
      });

      if (!balance || balance.availableQuantity < retQty) {
        throw new Error(
          `Insufficient available stock in warehouse to return ${retQty} units of ${purchaseItem.name}. Available: ${balance?.availableQuantity || 0}`
        );
      }

      const debitAmount = retQty * purchaseItem.unitCost;
      totalDebitAmount += debitAmount;

      returnItems.push({
        productId: purchaseItem.productId,
        variantId: purchaseItem.variantId,
        name: purchaseItem.name,
        sku: purchaseItem.sku,
        returnedQuantity: retQty,
        unitCostSnapshot: purchaseItem.unitCost,
        debitAmount,
      });

      // 1. Deduct stock from warehouse
      const prevOnHand = balance.onHandQuantity;
      const prevReserved = balance.reservedQuantity;
      const newOnHand = prevOnHand - retQty;

      balance.onHandQuantity = newOnHand;
      balance.availableQuantity = newOnHand - prevReserved;
      balance.lastUpdated = new Date();
      await balance.save();

      const moveCode = generateReferenceCode("STK-RET-PUR", Math.floor(Math.random() * 9000 + 1000));
      await StockMovement.create({
        movementNumber: moveCode,
        type: "purchase_return",
        productId: purchaseItem.productId,
        variantId: purchaseItem.variantId,
        warehouseId: purchase.warehouseId,
        quantity: -retQty,
        unitCost: purchaseItem.unitCost,
        previousOnHand: prevOnHand,
        newOnHand,
        previousReserved: prevReserved,
        newReserved: prevReserved,
        referenceType: "purchase_return",
        referenceId: purchase.purchaseNumber,
        notes: `Returned to vendor: ${input.reason}`,
        createdBy: actId,
      });
    }

    if (returnItems.length === 0) {
      throw new Error("No items selected for return");
    }

    const returnNumber = generateReferenceCode(
      "RET-PUR",
      Math.floor(Math.random() * 9000 + 1000)
    );

    // 2. Adjust Vendor Payable
    await Vendor.findByIdAndUpdate(purchase.vendorId, {
      $inc: { currentPayable: -totalDebitAmount },
    });

    const purchaseReturn = await PurchaseReturn.create({
      returnNumber,
      purchaseId: pId,
      purchaseNumber: purchase.purchaseNumber,
      vendorId: purchase.vendorId,
      warehouseId: purchase.warehouseId,
      items: returnItems,
      totalDebitAmount,
      reason: input.reason,
      status: "completed",
      notes: input.notes,
      createdBy: actId,
    });

    // 3. Double-Entry Accounting: Debit AP, Credit Inventory Asset
    try {
      const apAccount = await AccountingService.getAccountBySubType("accounts_payable");
      const invAccount = await AccountingService.getAccountBySubType("inventory_asset");

      await AccountingService.postJournalEntry({
        referenceType: "purchase_return",
        referenceId: returnNumber,
        narration: `Purchase return to vendor on ${purchase.purchaseNumber}`,
        lines: [
          {
            accountId: apAccount._id as mongoose.Types.ObjectId,
            debit: totalDebitAmount,
            credit: 0,
            description: `Payable reduction for Purchase Return ${returnNumber}`,
          },
          {
            accountId: invAccount._id as mongoose.Types.ObjectId,
            debit: 0,
            credit: totalDebitAmount,
            description: `Inventory reduction for Purchase Return ${returnNumber}`,
          },
        ],
        postedBy: actId,
      });
    } catch (accErr) {
      console.error("[PurchaseReturnService] Accounting entry warning:", accErr);
    }

    await AuditService.log({
      actorId: actId,
      action: "PURCHASE_RETURN_PROCESSED",
      entityType: "purchase_return",
      entityId: String(purchaseReturn._id),
      afterSnapshot: {
        returnNumber,
        totalDebitAmount,
        purchaseNumber: purchase.purchaseNumber,
      },
    });

    return purchaseReturn;
  }
}
