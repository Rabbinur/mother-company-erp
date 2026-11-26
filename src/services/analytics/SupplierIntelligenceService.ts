import mongoose from "mongoose";
import { GoodsReceiptNote } from "@/models/GoodsReceiptNote";
import { PurchaseReturn } from "@/models/PurchaseReturn";
import { Vendor } from "@/models/Vendor";
import { PrincipalCompany } from "@/models/PrincipalCompany";
import { roundMoney, addMoney } from "../AccountingService";
import type { AnalyticsDateFilter, SupplierIntelligenceItem } from "./types";

export class SupplierIntelligenceService {
  static async getSupplierIntelligence(params: {
    businessId: mongoose.Types.ObjectId;
    dealershipId?: mongoose.Types.ObjectId;
    principalCompanyId?: mongoose.Types.ObjectId;
    dateFilter: AnalyticsDateFilter;
    canViewCosts: boolean;
  }): Promise<{
    suppliers: SupplierIntelligenceItem[];
    principalComparisons: Array<{
      principalCompanyId: string;
      principalCompanyName: string;
      totalValue: number;
      totalQuantity: number;
      shortageRate: number;
    }>;
  }> {
    const { businessId, dealershipId, principalCompanyId, dateFilter, canViewCosts } = params;

    // 1. Fetch GRNs in period
    const grnQuery: Record<string, any> = {
      businessId,
      status: { $nin: ["CANCELLED", "FAILED"] },
      createdAt: { $gte: dateFilter.startDate, $lte: dateFilter.endDate },
    };
    if (dealershipId) grnQuery.dealershipId = dealershipId;
    if (principalCompanyId) grnQuery.principalCompanyId = principalCompanyId;

    const grns = await GoodsReceiptNote.find(grnQuery).lean();

    // 2. Fetch Purchase Returns in period
    const retQuery: Record<string, any> = {
      businessId,
      status: { $nin: ["CANCELLED", "REJECTED"] },
      createdAt: { $gte: dateFilter.startDate, $lte: dateFilter.endDate },
    };
    if (dealershipId) retQuery.dealershipId = dealershipId;

    const purchaseReturns = await PurchaseReturn.find(retQuery).lean();
    const returnMap = new Map<string, { count: number; amount: number }>();
    for (const pr of purchaseReturns) {
      const vKey = String(pr.vendorId);
      const entry = returnMap.get(vKey) || { count: 0, amount: 0 };
      entry.count += 1;
      entry.amount = addMoney(entry.amount, roundMoney(pr.totalDebitAmount || 0));
      returnMap.set(vKey, entry);
    }

    // 3. Aggregate GRN Data by Vendor
    const vendorStats = new Map<
      string,
      {
        vendorId: string;
        principalCompanyId?: string;
        grnCount: number;
        purchasedQty: number;
        purchasedVal: number;
        shortageQty: number;
        challanQty: number;
        priceTrends: Array<{ date: Date; productName: string; sku: string; unitPrice: number; landedUnitCost: number }>;
      }
    >();

    const principalStats = new Map<string, { totalVal: number; totalQty: number; shortageQty: number; challanQty: number }>();

    for (const grn of grns) {
      const vIdStr = String(grn.supplierId || (grn as any).vendorId);
      const pIdStr = grn.principalCompanyId ? String(grn.principalCompanyId) : "independent";

      const vEntry = vendorStats.get(vIdStr) || {
        vendorId: vIdStr,
        principalCompanyId: grn.principalCompanyId ? String(grn.principalCompanyId) : undefined,
        grnCount: 0,
        purchasedQty: 0,
        purchasedVal: 0,
        shortageQty: 0,
        challanQty: 0,
        priceTrends: [],
      };

      vEntry.grnCount += 1;

      if (Array.isArray(grn.items)) {
        for (const item of grn.items) {
          const recQty = item.receivedQuantity || 0;
          const chalQty = item.challanQuantity || recQty;
          const shortQty = item.shortageQuantity || Math.max(0, chalQty - recQty);
          const lineVal = roundMoney(item.lineTotal || (item.unitPurchasePrice || 0) * recQty);

          vEntry.purchasedQty += recQty;
          vEntry.challanQty += chalQty;
          vEntry.shortageQty += shortQty;
          vEntry.purchasedVal = addMoney(vEntry.purchasedVal, lineVal);

          if (vEntry.priceTrends.length < 5) {
            vEntry.priceTrends.push({
              date: new Date(grn.createdAt),
              productName: item.productName || "Product",
              sku: item.sku || "",
              unitPrice: canViewCosts ? item.unitPurchasePrice || 0 : 0,
              landedUnitCost: canViewCosts ? item.netLandedUnitCost || item.unitPurchasePrice || 0 : 0,
            });
          }

          // Principal Company Aggregation
          const pEntry = principalStats.get(pIdStr) || { totalVal: 0, totalQty: 0, shortageQty: 0, challanQty: 0 };
          pEntry.totalVal = addMoney(pEntry.totalVal, lineVal);
          pEntry.totalQty += recQty;
          pEntry.shortageQty += shortQty;
          pEntry.challanQty += chalQty;
          principalStats.set(pIdStr, pEntry);
        }
      }

      vendorStats.set(vIdStr, vEntry);
    }

    // 4. Resolve Vendors & Principals Names
    const vendorIds = Array.from(vendorStats.keys());
    const vendors = await Vendor.find({ _id: { $in: vendorIds } }).lean();
    const vendorNameMap = new Map<string, string>();
    for (const v of vendors) {
      vendorNameMap.set(String(v._id), v.name);
    }

    const principalIds = Array.from(principalStats.keys()).filter((id) => id !== "independent");
    const principals = await PrincipalCompany.find({ _id: { $in: principalIds } }).lean();
    const principalNameMap = new Map<string, string>();
    for (const p of principals) {
      principalNameMap.set(String(p._id), p.name);
    }

    // 5. Build Supplier Intelligence List
    const supplierList: SupplierIntelligenceItem[] = Array.from(vendorStats.values()).map((v) => {
      const retData = returnMap.get(v.vendorId) || { count: 0, amount: 0 };
      // Safely handle zero/missing challan or purchase quantity: Return null to represent N/A
      const shortageRate = v.challanQty > 0 ? roundMoney((v.shortageQty / v.challanQty) * 100) : null;
      const returnRate = v.purchasedVal > 0 ? roundMoney((retData.amount / v.purchasedVal) * 100) : null;

      return {
        vendorId: v.vendorId,
        vendorName: vendorNameMap.get(v.vendorId) || "Supplier",
        principalCompanyId: v.principalCompanyId,
        principalCompanyName: v.principalCompanyId ? principalNameMap.get(v.principalCompanyId) : undefined,
        grnCount: v.grnCount,
        totalPurchasedQuantity: v.purchasedQty,
        totalPurchasedValue: canViewCosts ? v.purchasedVal : 0,
        totalShortageQuantity: v.shortageQty,
        shortageRatePercentage: shortageRate,
        purchaseReturnCount: retData.count,
        purchaseReturnAmount: canViewCosts ? retData.amount : 0,
        purchaseReturnRatePercentage: returnRate,
        historicalPriceTrends: v.priceTrends,
      };
    });

    supplierList.sort((a, b) => b.totalPurchasedValue - a.totalPurchasedValue);

    // Principal comparisons
    const principalComparisons = Array.from(principalStats.entries()).map(([pId, stats]) => ({
      principalCompanyId: pId,
      principalCompanyName: principalNameMap.get(pId) || "Independent Vendors",
      totalValue: canViewCosts ? stats.totalVal : 0,
      totalQuantity: stats.totalQty,
      shortageRate: stats.challanQty > 0 ? roundMoney((stats.shortageQty / stats.challanQty) * 100) : null,
    }));

    return {
      suppliers: supplierList,
      principalComparisons,
    };
  }
}
