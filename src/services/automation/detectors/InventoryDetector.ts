import mongoose from "mongoose";
import { InventoryBalance } from "@/models/InventoryBalance";
import { StockBatch } from "@/models/StockBatch";
import { Product } from "@/models/Product";
import type { IAutomationRule } from "@/models/AutomationRule";
import type { DetectorResult, DetectedCondition } from "../types";

export class InventoryDetector {
  static async evaluate(params: {
    rule: IAutomationRule;
    businessId: mongoose.Types.ObjectId;
    dealershipId?: mongoose.Types.ObjectId;
  }): Promise<DetectorResult> {
    const { rule, businessId, dealershipId } = params;
    const ruleKey = rule.ruleKey;
    const config = rule.configuration || {};
    const conditions: DetectedCondition[] = [];
    let evaluatedCount = 0;

    const baseFilter: Record<string, any> = { businessId };
    if (dealershipId) baseFilter.dealershipId = dealershipId;

    if (ruleKey === "LOW_STOCK" || ruleKey === "STOCKOUT") {
      const balances = await InventoryBalance.find(baseFilter).lean();
      evaluatedCount = balances.length;

      // Fetch products to compare with minStock
      const productIds = Array.from(new Set(balances.map((b) => String(b.productId))));
      const products = await Product.find({ _id: { $in: productIds } }).lean();
      const productMap = new Map(products.map((p) => [String(p._id), p]));

      for (const bal of balances) {
        const prod = productMap.get(String(bal.productId));
        const minThreshold = prod?.minStock ?? config.fallbackMinStock ?? 10;
        const avail = bal.availableQuantity ?? 0;
        const prodName = prod?.name || "Product";
        const sku = prod?.sku || "";

        if (ruleKey === "STOCKOUT" && avail === 0) {
          conditions.push({
            ruleKey,
            category: "INVENTORY",
            severity: rule.severity,
            title: `Stockout: ${prodName}`,
            message: `${prodName} (${sku}) is completely out of stock at warehouse. Available units: 0.`,
            sourceEntityType: "InventoryBalance",
            sourceEntityId: String(bal._id),
            dealershipId: bal.dealershipId ? String(bal.dealershipId) : undefined,
            deduplicationKey: `${businessId}:${ruleKey}:${bal.productId}:${bal.warehouseId}`,
            metadata: { productId: String(bal.productId), warehouseId: String(bal.warehouseId), availableQuantity: 0 },
          });
        } else if (ruleKey === "LOW_STOCK" && avail > 0 && avail <= minThreshold) {
          conditions.push({
            ruleKey,
            category: "INVENTORY",
            severity: rule.severity,
            title: `Low Stock: ${prodName}`,
            message: `${prodName} (${sku}) has reached low stock: ${avail} units remaining (min: ${minThreshold}).`,
            sourceEntityType: "InventoryBalance",
            sourceEntityId: String(bal._id),
            dealershipId: bal.dealershipId ? String(bal.dealershipId) : undefined,
            deduplicationKey: `${businessId}:${ruleKey}:${bal.productId}:${bal.warehouseId}`,
            metadata: { productId: String(bal.productId), warehouseId: String(bal.warehouseId), availableQuantity: avail, minStock: minThreshold },
          });
        }
      }
    } else if (ruleKey === "NEAR_EXPIRY" || ruleKey === "EXPIRED_STOCK") {
      const now = new Date();
      const warningDays = config.warningDays ?? 30;
      const warningDate = new Date(now.getTime() + warningDays * 86400000);

      const batchFilter: Record<string, any> = {
        ...baseFilter,
        status: "active",
        remainingQuantity: { $gt: 0 },
        expiryDate: { $ne: null },
      };

      const batches = await StockBatch.find(batchFilter).lean();
      evaluatedCount = batches.length;

      for (const batch of batches) {
        if (!batch.expiryDate) continue;
        const exp = new Date(batch.expiryDate);
        const batchNum = batch.batchNumber || "N/A";

        if (ruleKey === "EXPIRED_STOCK" && exp < now) {
          conditions.push({
            ruleKey,
            category: "INVENTORY",
            severity: rule.severity,
            title: `Expired Stock Batch: ${batchNum}`,
            message: `Batch ${batchNum} expired on ${exp.toISOString().split("T")[0]}. Remaining: ${batch.remainingQuantity} units.`,
            sourceEntityType: "StockBatch",
            sourceEntityId: String(batch._id),
            dealershipId: batch.dealershipId ? String(batch.dealershipId) : undefined,
            deduplicationKey: `${businessId}:${ruleKey}:${batch._id}`,
            metadata: { batchId: String(batch._id), batchNumber: batchNum, expiryDate: exp, remainingQuantity: batch.remainingQuantity },
          });
        } else if (ruleKey === "NEAR_EXPIRY" && exp >= now && exp <= warningDate) {
          const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / 86400000);
          conditions.push({
            ruleKey,
            category: "INVENTORY",
            severity: rule.severity,
            title: `Near Expiry: Batch ${batchNum}`,
            message: `Batch ${batchNum} expires in ${daysLeft} days (${exp.toISOString().split("T")[0]}). Stock: ${batch.remainingQuantity} units.`,
            sourceEntityType: "StockBatch",
            sourceEntityId: String(batch._id),
            dealershipId: batch.dealershipId ? String(batch.dealershipId) : undefined,
            deduplicationKey: `${businessId}:${ruleKey}:${batch._id}`,
            metadata: { batchId: String(batch._id), batchNumber: batchNum, expiryDate: exp, daysLeft, remainingQuantity: batch.remainingQuantity },
          });
        }
      }
    } else if (ruleKey === "DAMAGED_QUARANTINED_STOCK") {
      const qBatches = await StockBatch.find({ ...baseFilter, status: "quarantined", remainingQuantity: { $gt: 0 } }).lean();
      evaluatedCount = qBatches.length;

      for (const b of qBatches) {
        conditions.push({
          ruleKey,
          category: "INVENTORY",
          severity: rule.severity,
          title: `Quarantined Stock: Batch ${b.batchNumber || "N/A"}`,
          message: `Batch ${b.batchNumber || "N/A"} is quarantined with ${b.remainingQuantity} units pending inspection or claim.`,
          sourceEntityType: "StockBatch",
          sourceEntityId: String(b._id),
          dealershipId: b.dealershipId ? String(b.dealershipId) : undefined,
          deduplicationKey: `${businessId}:${ruleKey}:${b._id}`,
          metadata: { batchId: String(b._id), remainingQuantity: b.remainingQuantity },
        });
      }
    } else if (ruleKey === "REORDER_RECOMMENDATION") {
      const balances = await InventoryBalance.find(baseFilter).lean();
      evaluatedCount = balances.length;
      for (const bal of balances) {
        if (bal.availableQuantity === 0) {
          conditions.push({
            ruleKey,
            category: "INVENTORY",
            severity: rule.severity,
            title: `Replenishment Recommended: Product ${bal.productId}`,
            message: `Available stock is depleted (0 units). Reorder recommended to avoid lost sales.`,
            sourceEntityType: "InventoryBalance",
            sourceEntityId: String(bal._id),
            dealershipId: bal.dealershipId ? String(bal.dealershipId) : undefined,
            deduplicationKey: `${businessId}:${ruleKey}:${bal.productId}:${bal.warehouseId}`,
            metadata: { productId: String(bal.productId), warehouseId: String(bal.warehouseId) },
          });
        }
      }
    }

    return {
      ruleKey,
      category: "INVENTORY",
      status: "EVALUATED",
      conditions,
      evaluatedCount,
    };
  }
}
