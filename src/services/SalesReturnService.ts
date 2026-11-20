import mongoose from "mongoose";
import { SalesReturn, ISalesReturn, ISalesReturnItem } from "@/models/SalesReturn";
import { Order } from "@/models/Order";
import { Customer } from "@/models/Customer";
import { InventoryService } from "./InventoryService";
import { AccountingService } from "./AccountingService";
import { AuditService } from "./AuditService";
import { generateReferenceCode } from "@/lib/utils";

export interface CreateSalesReturnInput {
  orderId: string | mongoose.Types.ObjectId;
  items: Array<{
    variantId: string | mongoose.Types.ObjectId;
    returnedQuantity: number;
    condition: "good" | "damaged";
    restockEligible: boolean;
  }>;
  reason: string;
  notes?: string;
  actorId?: string | mongoose.Types.ObjectId;
}

export class SalesReturnService {
  static async processReturn(input: CreateSalesReturnInput): Promise<ISalesReturn> {
    const oId = new mongoose.Types.ObjectId(String(input.orderId));
    const actId = input.actorId ? new mongoose.Types.ObjectId(String(input.actorId)) : undefined;

    const order = await Order.findById(oId);
    if (!order) {
      throw new Error("Original order not found");
    }

    if (order.orderStatus !== "fulfilled" && order.orderStatus !== "delivered") {
      throw new Error("Returns can only be processed for fulfilled or delivered orders");
    }

    // Check past returns for this order to prevent returning more than sold
    const pastReturns = await SalesReturn.find({ orderId: oId, status: "completed" }).lean();
    const previouslyReturnedQty: Record<string, number> = {};
    for (const pr of pastReturns) {
      for (const item of pr.items) {
        const vKey = String(item.variantId);
        previouslyReturnedQty[vKey] = (previouslyReturnedQty[vKey] || 0) + item.returnedQuantity;
      }
    }

    let totalRefundAmount = 0;
    const returnItems: ISalesReturnItem[] = [];
    const stockToRestock: Array<{
      productId: mongoose.Types.ObjectId;
      variantId: mongoose.Types.ObjectId;
      quantity: number;
    }> = [];

    for (const itemInput of input.items) {
      const vKey = String(itemInput.variantId);
      const retQty = Number(itemInput.returnedQuantity);

      if (retQty <= 0) continue;

      const orderItem = order.items.find((i) => String(i.variantId) === vKey);
      if (!orderItem) {
        throw new Error(`Variant ${vKey} was not part of original order ${order.orderNumber}`);
      }

      const prevRet = previouslyReturnedQty[vKey] || 0;
      const maxReturnable = orderItem.quantity - prevRet;

      if (retQty > maxReturnable) {
        throw new Error(
          `Cannot return ${retQty} units of ${orderItem.name}. Maximum returnable: ${maxReturnable} (Sold: ${orderItem.quantity}, Previously Returned: ${prevRet})`
        );
      }

      const itemRefund = retQty * orderItem.customerPriceSnapshot;
      totalRefundAmount += itemRefund;

      returnItems.push({
        productId: orderItem.productId,
        variantId: orderItem.variantId,
        name: orderItem.name,
        sku: orderItem.sku,
        returnedQuantity: retQty,
        customerPriceSnapshot: orderItem.customerPriceSnapshot,
        condition: itemInput.condition,
        restockEligible: itemInput.restockEligible && itemInput.condition === "good",
        refundAmount: itemRefund,
      });

      // Damaged goods MUST NOT automatically become available stock!
      if (itemInput.restockEligible && itemInput.condition === "good") {
        stockToRestock.push({
          productId: orderItem.productId,
          variantId: orderItem.variantId,
          quantity: retQty,
        });
      }
    }

    if (returnItems.length === 0) {
      throw new Error("No valid return items provided");
    }

    const returnNumber = generateReferenceCode(
      "RET-SLS",
      Math.floor(Math.random() * 9000 + 1000)
    );

    // 1. Restock eligible good items to inventory
    if (stockToRestock.length > 0) {
      await InventoryService.receiveStock(
        order.warehouseId,
        stockToRestock,
        returnNumber,
        "sales_return",
        actId
      );
    }

    // 2. Adjust Customer Receivable
    await Customer.findByIdAndUpdate(order.customerId, {
      $inc: { currentReceivable: -totalRefundAmount },
    });

    // 3. Create Sales Return record
    const salesReturn = await SalesReturn.create({
      returnNumber,
      orderId: oId,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      warehouseId: order.warehouseId,
      items: returnItems,
      totalRefundAmount,
      reason: input.reason,
      status: "completed",
      restocked: stockToRestock.length > 0,
      notes: input.notes,
      createdBy: actId,
    });

    // 4. Double-Entry Accounting
    try {
      const arAccount = await AccountingService.getAccountBySubType("accounts_receivable");
      const revAccount = await AccountingService.getAccountBySubType("sales_revenue");

      await AccountingService.postJournalEntry({
        referenceType: "sales_return",
        referenceId: returnNumber,
        narration: `Sales return refund on ${order.orderNumber}`,
        lines: [
          {
            accountId: revAccount._id as mongoose.Types.ObjectId,
            debit: totalRefundAmount,
            credit: 0,
            description: `Revenue reversal for Return ${returnNumber}`,
          },
          {
            accountId: arAccount._id as mongoose.Types.ObjectId,
            debit: 0,
            credit: totalRefundAmount,
            description: `Receivable reduction for Return ${returnNumber}`,
          },
        ],
        postedBy: actId,
      });
    } catch (accErr) {
      console.error("[SalesReturnService] Accounting entry warning:", accErr);
    }

    await AuditService.log({
      actorId: actId,
      action: "SALES_RETURN_PROCESSED",
      entityType: "sales_return",
      entityId: String(salesReturn._id),
      afterSnapshot: {
        returnNumber,
        totalRefundAmount,
        orderNumber: order.orderNumber,
      },
    });

    return salesReturn;
  }
}
