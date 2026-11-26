import mongoose from "mongoose";
import { SupplierPayable } from "@/models/SupplierPayable";
import { Purchase } from "@/models/Purchase";
import { GoodsReceiptNote } from "@/models/GoodsReceiptNote";
import { Vendor } from "@/models/Vendor";
import { Product } from "@/models/Product";
import type { IAutomationRule } from "@/models/AutomationRule";
import type { DetectorResult, DetectedCondition } from "../types";

export class SupplierDetector {
  static async evaluate(params: {
    rule: IAutomationRule;
    businessId: mongoose.Types.ObjectId;
    dealershipId?: mongoose.Types.ObjectId;
  }): Promise<DetectorResult> {
    const { rule, businessId, dealershipId } = params;
    const ruleKey = rule.ruleKey;
    const config = rule.configuration || {};
    const conditions: DetectedCondition[] = [];
    const now = new Date();

    const baseFilter: Record<string, any> = { businessId };
    if (dealershipId) baseFilter.dealershipId = dealershipId;

    let evaluatedCount = 0;

    if (ruleKey === "SUPPLIER_PAYMENT_DUE") {
      const advDays = config.advanceWarningDays ?? 2;
      const targetDate = new Date(now.getTime() + advDays * 86400000);

      const payables = await SupplierPayable.find({
        ...baseFilter,
        isCancelled: false,
        status: { $in: ["UNPAID", "PARTIALLY_PAID"] },
        dueDate: { $exists: true, $ne: null, $lte: targetDate },
      }).lean();
      evaluatedCount = payables.length;

      for (const p of payables) {
        const isPastDue = p.dueDate ? new Date(p.dueDate) < now : false;
        const dueStr = p.dueDate ? new Date(p.dueDate).toISOString().split("T")[0] : "N/A";
        conditions.push({
          ruleKey,
          category: "SUPPLIER",
          severity: isPastDue ? "CRITICAL" : rule.severity,
          title: `Supplier Payment ${isPastDue ? "Overdue" : "Due Soon"}: ${p.payableNumber}`,
          message: `Payable ${p.payableNumber} of BDT ${(p.outstandingBalance || 0).toLocaleString()} is ${isPastDue ? "overdue" : "due on " + dueStr}.`,
          sourceEntityType: "SupplierPayable",
          sourceEntityId: String(p._id),
          dealershipId: p.dealershipId ? String(p.dealershipId) : undefined,
          deduplicationKey: `${businessId}:${ruleKey}:${p._id}`,
          metadata: { payableId: String(p._id), payableNumber: p.payableNumber, dueDate: p.dueDate, outstandingBalance: p.outstandingBalance },
        });
      }
    } else if (ruleKey === "PURCHASE_ORDER_PENDING") {
      const pendDays = config.pendingDays ?? 3;
      const cutoff = new Date(now.getTime() - pendDays * 86400000);

      const pos = await Purchase.find({
        ...baseFilter,
        status: { $in: ["ordered", "submitted", "SUBMITTED"] },
        orderDate: { $lte: cutoff },
      }).lean();
      evaluatedCount = pos.length;

      for (const po of pos) {
        const days = Math.floor((now.getTime() - new Date(po.orderDate).getTime()) / 86400000);
        conditions.push({
          ruleKey,
          category: "SUPPLIER",
          severity: rule.severity,
          title: `Pending Purchase Order: ${po.purchaseNumber}`,
          message: `PO ${po.purchaseNumber} has remained pending fulfillment for ${days} days.`,
          sourceEntityType: "Purchase",
          sourceEntityId: String(po._id),
          dealershipId: po.dealershipId ? String(po.dealershipId) : undefined,
          deduplicationKey: `${businessId}:${ruleKey}:${po._id}`,
          metadata: { purchaseId: String(po._id), purchaseNumber: po.purchaseNumber, daysPending: days },
        });
      }
    } else if (ruleKey === "PARTIAL_GRN_SHORTAGE") {
      const grns = await GoodsReceiptNote.find({
        ...baseFilter,
        status: { $nin: ["CANCELLED", "FAILED"] },
        "items.shortageQuantity": { $gt: 0 },
      }).lean();
      evaluatedCount = grns.length;

      for (const grn of grns) {
        const totalShortage = (grn.items || []).reduce((acc: number, it: any) => acc + (it.shortageQuantity || 0), 0);
        if (totalShortage > 0) {
          conditions.push({
            ruleKey,
            category: "SUPPLIER",
            severity: rule.severity,
            title: `GRN Delivery Shortage: Challan ${grn.challanNumber || grn._id}`,
            message: `Challan ${grn.challanNumber || "N/A"} documented a shortage of ${totalShortage} units. Claim verification required.`,
            sourceEntityType: "GoodsReceiptNote",
            sourceEntityId: String(grn._id),
            dealershipId: grn.dealershipId ? String(grn.dealershipId) : undefined,
            deduplicationKey: `${businessId}:${ruleKey}:${grn._id}`,
            metadata: { grnId: String(grn._id), challanNumber: grn.challanNumber, totalShortage },
          });
        }
      }
    } else if (ruleKey === "SUPPLIER_SHORTAGE_RATE_EXCEEDED") {
      const threshold = config.maxShortageRate ?? 5;
      const grns = await GoodsReceiptNote.find({ ...baseFilter, status: { $nin: ["CANCELLED", "FAILED"] } }).lean();
      evaluatedCount = grns.length;

      const vendorShortages = new Map<string, { challanQty: number; shortageQty: number }>();
      for (const grn of grns) {
        const vId = String(grn.supplierId || (grn as any).vendorId);
        const entry = vendorShortages.get(vId) || { challanQty: 0, shortageQty: 0 };
        for (const it of grn.items || []) {
          const chal = typeof it.challanQuantity === "number" ? it.challanQuantity : 0;
          const short = typeof it.shortageQuantity === "number" ? it.shortageQuantity : 0;
          entry.challanQty += chal;
          entry.shortageQty += short;
        }
        vendorShortages.set(vId, entry);
      }

      for (const [vId, stats] of vendorShortages.entries()) {
        if (stats.challanQty > 0) {
          const rate = (stats.shortageQty / stats.challanQty) * 100;
          if (rate > threshold) {
            const vendor = await Vendor.findOne({ _id: vId, businessId }).lean();
            const vName = vendor?.name || "Supplier";
            conditions.push({
              ruleKey,
              category: "SUPPLIER",
              severity: rule.severity,
              title: `High Vendor Shortage Rate: ${vName}`,
              message: `${vName} exhibits a ${rate.toFixed(1)}% shortage rate (${stats.shortageQty} of ${stats.challanQty} units) exceeding ${threshold}%.`,
              sourceEntityType: "Vendor",
              sourceEntityId: vId,
              deduplicationKey: `${businessId}:${ruleKey}:${vId}`,
              metadata: { vendorId: vId, shortageRate: rate, threshold },
            });
          }
        }
      }
    } else if (ruleKey === "SUPPLIER_PRICE_VARIATION") {
      // Flag recent GRNs with unit price variance > threshold based on comparable historical GRNs
      const varianceThreshold = config.maxPriceVariancePercentage ?? 10;
      const recentGRNs = await GoodsReceiptNote.find(baseFilter).sort({ createdAt: -1 }).limit(20).lean();
      evaluatedCount = recentGRNs.length;

      for (const grn of recentGRNs) {
        for (const item of grn.items || []) {
          if (item.unitPurchasePrice && item.unitPurchasePrice > 0 && item.productId) {
            // Find comparable historical GRNs for same product
            const prevGRNs = await GoodsReceiptNote.find({
              businessId,
              _id: { $ne: grn._id },
              "items.productId": item.productId,
            }).limit(5).lean();

            let histSum = 0;
            let histCount = 0;
            for (const pGrn of prevGRNs) {
              for (const pItem of pGrn.items || []) {
                if (String(pItem.productId) === String(item.productId) && pItem.unitPurchasePrice) {
                  histSum += pItem.unitPurchasePrice;
                  histCount += 1;
                }
              }
            }

            if (histCount > 0) {
              const histAvg = histSum / histCount;
              const variance = Math.abs((item.unitPurchasePrice - histAvg) / histAvg) * 100;
              if (variance >= varianceThreshold) {
                const prodName = item.productName || "Product";
                conditions.push({
                  ruleKey,
                  category: "SUPPLIER",
                  severity: rule.severity,
                  title: `Procurement Price Variance: ${prodName}`,
                  message: `Challan price BDT ${item.unitPurchasePrice} deviates ${variance.toFixed(1)}% from comparable historical average BDT ${histAvg.toFixed(2)}.`,
                  sourceEntityType: "GoodsReceiptNote",
                  sourceEntityId: String(grn._id),
                  dealershipId: grn.dealershipId ? String(grn.dealershipId) : undefined,
                  deduplicationKey: `${businessId}:${ruleKey}:${grn._id}:${item.productId}`,
                  metadata: { grnId: String(grn._id), productId: String(item.productId), unitPrice: item.unitPurchasePrice, historicalAverage: histAvg, variance },
                });
              }
            }
          }
        }
      }
    }

    return {
      ruleKey,
      category: "SUPPLIER",
      status: "EVALUATED",
      conditions,
      evaluatedCount,
    };
  }
}
