import mongoose from "mongoose";
import { GoodsReceiptNote } from "@/models/GoodsReceiptNote";
import { SupplierPayable } from "@/models/SupplierPayable";
import { Vendor } from "@/models/Vendor";
import { PrincipalCompany } from "@/models/PrincipalCompany";
import { Dealership } from "@/models/Dealership";
import { Product } from "@/models/Product";

export interface ProcurementHistoryFilter {
  businessId: string | mongoose.Types.ObjectId;
  dealershipId?: string | mongoose.Types.ObjectId;
  supplierId?: string | mongoose.Types.ObjectId;
  principalCompanyId?: string | mongoose.Types.ObjectId;
  productId?: string | mongoose.Types.ObjectId;
  startDate?: string;
  endDate?: string;
  groupBy?: "supplier" | "principalCompany" | "dealership" | "product";
}

export interface ProcurementHistorySummary {
  dimensionId: string;
  dimensionName: string;
  totalChallanQuantity: number;
  totalReceivedQuantity: number;
  totalShortageQuantity: number;
  totalDamagedQuantity: number;
  totalPurchasedValue: number | null;
  totalOutstandingBalance: number | null;
  grnCount: number;
}

export class ProcurementReportService {
  static async getHistoryReport(
    filter: ProcurementHistoryFilter,
    canViewCost: boolean = false
  ): Promise<{
    totals: {
      totalChallanQuantity: number;
      totalReceivedQuantity: number;
      totalShortageQuantity: number;
      totalDamagedQuantity: number;
      totalPurchasedValue: number | null;
      totalOutstandingBalance: number | null;
      grnCount: number;
    };
    breakdown: ProcurementHistorySummary[];
  }> {
    const matchQuery: Record<string, any> = {
      businessId: new mongoose.Types.ObjectId(String(filter.businessId)),
      isCancelled: false,
    };

    if (filter.dealershipId) {
      matchQuery.dealershipId = new mongoose.Types.ObjectId(String(filter.dealershipId));
    }
    if (filter.supplierId) {
      matchQuery.supplierId = new mongoose.Types.ObjectId(String(filter.supplierId));
    }
    if (filter.principalCompanyId) {
      matchQuery.principalCompanyId = new mongoose.Types.ObjectId(String(filter.principalCompanyId));
    }
    if (filter.startDate || filter.endDate) {
      matchQuery.grnDate = {};
      if (filter.startDate) matchQuery.grnDate.$gte = new Date(filter.startDate);
      if (filter.endDate) matchQuery.grnDate.$lte = new Date(filter.endDate);
    }

    const grns = await GoodsReceiptNote.find(matchQuery).lean();

    const groupBy = filter.groupBy || "supplier";
    const groupMap = new Map<string, ProcurementHistorySummary>();

    let overallChallanQty = 0;
    let overallReceivedQty = 0;
    let overallShortageQty = 0;
    let overallDamagedQty = 0;
    let overallPurchasedValue = 0;

    for (const grn of grns) {
      for (const item of grn.items || []) {
        if (filter.productId && String(item.productId) !== String(filter.productId)) {
          continue;
        }

        let dimId = "UNKNOWN";
        if (groupBy === "supplier") {
          dimId = String(grn.supplierId || "UNKNOWN");
        } else if (groupBy === "principalCompany") {
          dimId = String(grn.principalCompanyId || "UNKNOWN");
        } else if (groupBy === "dealership") {
          dimId = String(grn.dealershipId || "UNKNOWN");
        } else if (groupBy === "product") {
          dimId = String(item.productId || item.productName || "UNKNOWN");
        }

        const cQty = item.challanQuantity || 0;
        const rQty = item.receivedQuantity || 0;
        const sQty = item.shortageQuantity || 0;
        const dQty = item.damagedQuantity || 0;
        const lineVal = item.lineTotal || (rQty * (item.unitPurchasePrice || 0));

        overallChallanQty += cQty;
        overallReceivedQty += rQty;
        overallShortageQty += sQty;
        overallDamagedQty += dQty;
        overallPurchasedValue += lineVal;

        if (!groupMap.has(dimId)) {
          groupMap.set(dimId, {
            dimensionId: dimId,
            dimensionName: dimId,
            totalChallanQuantity: 0,
            totalReceivedQuantity: 0,
            totalShortageQuantity: 0,
            totalDamagedQuantity: 0,
            totalPurchasedValue: 0,
            totalOutstandingBalance: 0,
            grnCount: 0,
          });
        }

        const summary = groupMap.get(dimId)!;
        summary.totalChallanQuantity += cQty;
        summary.totalReceivedQuantity += rQty;
        summary.totalShortageQuantity += sQty;
        summary.totalDamagedQuantity += dQty;
        summary.totalPurchasedValue = (summary.totalPurchasedValue || 0) + lineVal;
      }
    }

    // Tally GRN count per dimension
    for (const grn of grns) {
      let dimId = "UNKNOWN";
      if (groupBy === "supplier") dimId = String(grn.supplierId || "UNKNOWN");
      else if (groupBy === "principalCompany") dimId = String(grn.principalCompanyId || "UNKNOWN");
      else if (groupBy === "dealership") dimId = String(grn.dealershipId || "UNKNOWN");

      if (groupMap.has(dimId)) {
        groupMap.get(dimId)!.grnCount += 1;
      }
    }

    // Populate dimension display names
    const dimensionIds = Array.from(groupMap.keys()).filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (dimensionIds.length > 0) {
      const objIds = dimensionIds.map((id) => new mongoose.Types.ObjectId(id));
      if (groupBy === "supplier") {
        const suppliers = await Vendor.find({ _id: { $in: objIds } }, "name companyName code").lean();
        for (const s of suppliers) {
          const entry = groupMap.get(String(s._id));
          if (entry) entry.dimensionName = s.companyName || s.name || entry.dimensionName;
        }
      } else if (groupBy === "principalCompany") {
        const principals = await PrincipalCompany.find({ _id: { $in: objIds } }, "name code").lean();
        for (const p of principals) {
          const entry = groupMap.get(String(p._id));
          if (entry) entry.dimensionName = p.name || entry.dimensionName;
        }
      } else if (groupBy === "dealership") {
        const dealerships = await Dealership.find({ _id: { $in: objIds } }, "name code").lean();
        for (const d of dealerships) {
          const entry = groupMap.get(String(d._id));
          if (entry) entry.dimensionName = d.name || entry.dimensionName;
        }
      } else if (groupBy === "product") {
        const products = await Product.find({ _id: { $in: objIds } }, "name sku").lean();
        for (const pr of products) {
          const entry = groupMap.get(String(pr._id));
          if (entry) entry.dimensionName = pr.name || entry.dimensionName;
        }
      }
    }

    // Fetch outstanding balances from SupplierPayable
    const payableMatch: Record<string, any> = {
      businessId: new mongoose.Types.ObjectId(String(filter.businessId)),
      isCancelled: false,
      status: { $ne: "PAID" },
    };
    if (filter.dealershipId) payableMatch.dealershipId = new mongoose.Types.ObjectId(String(filter.dealershipId));
    if (filter.supplierId) payableMatch.supplierId = new mongoose.Types.ObjectId(String(filter.supplierId));
    if (filter.principalCompanyId) payableMatch.principalCompanyId = new mongoose.Types.ObjectId(String(filter.principalCompanyId));

    const payables = await SupplierPayable.find(payableMatch, "supplierId principalCompanyId dealershipId outstandingBalance").lean();
    let overallOutstanding = 0;

    for (const p of payables) {
      overallOutstanding += p.outstandingBalance || 0;
      let pDimId = "";
      if (groupBy === "supplier") pDimId = String(p.supplierId);
      else if (groupBy === "principalCompany") pDimId = String(p.principalCompanyId);
      else if (groupBy === "dealership") pDimId = String(p.dealershipId);

      if (pDimId && groupMap.has(pDimId)) {
        const item = groupMap.get(pDimId)!;
        item.totalOutstandingBalance = (item.totalOutstandingBalance || 0) + (p.outstandingBalance || 0);
      }
    }

    const breakdown = Array.from(groupMap.values()).map((row) => {
      if (!canViewCost) {
        return {
          ...row,
          totalPurchasedValue: null,
          totalOutstandingBalance: null,
        };
      }
      return row;
    });

    return {
      totals: {
        totalChallanQuantity: overallChallanQty,
        totalReceivedQuantity: overallReceivedQty,
        totalShortageQuantity: overallShortageQty,
        totalDamagedQuantity: overallDamagedQty,
        totalPurchasedValue: canViewCost ? overallPurchasedValue : null,
        totalOutstandingBalance: canViewCost ? overallOutstanding : null,
        grnCount: grns.length,
      },
      breakdown,
    };
  }
}
