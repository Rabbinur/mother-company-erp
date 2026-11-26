import mongoose from "mongoose";
import { StockBatch } from "@/models/StockBatch";
import { InventoryBalance } from "@/models/InventoryBalance";
import { Product } from "@/models/Product";
import { roundMoney, addMoney } from "../AccountingService";
import type { InventoryAnalyticsData } from "./types";

export interface InventoryAggregationResult {
  inventory: InventoryAnalyticsData;
  inventoryValuation: number;
  dealershipInventoryComparison: Array<{
    dealershipId: string;
    dealershipName: string;
    stockUnits: number;
    valuation: number;
    lowStockCount: number;
  }>;
}

export class InventoryAnalyticsAggregator {
  static async aggregateInventory(params: {
    businessId: mongoose.Types.ObjectId;
    dealershipId?: mongoose.Types.ObjectId;
    principalCompanyId?: mongoose.Types.ObjectId;
    dealerships: any[];
    dealershipMap: Map<string, { name: string; code: string }>;
    productSalesMap: Map<string, { product: any; variant: any; name: string; sku: string; qty: number; revenue: number; cost: number }>;
  }): Promise<InventoryAggregationResult> {
    const { businessId, dealershipId, principalCompanyId, dealerships, dealershipMap, productSalesMap } = params;

    // 1. StockBatches for FIFO Landed Cost Valuation & Expiry Radar
    const batchQuery: Record<string, any> = {
      businessId,
      status: "active",
      remainingQuantity: { $gt: 0 },
    };
    if (dealershipId) batchQuery.dealershipId = dealershipId;
    if (principalCompanyId) batchQuery.principalCompanyId = principalCompanyId;

    const batches = await StockBatch.find(batchQuery)
      .populate("productId", "name minStock")
      .populate("variantId", "sku variantName")
      .lean();

    let inventoryValuation = 0;
    const dshipBatchValuationMap = new Map<string, number>();
    const nowTime = new Date().getTime();
    const expiredBatches: any[] = [];
    const nearExpiryBatches: any[] = [];

    for (const b of batches) {
      const rem = b.remainingQuantity || 0;
      const unitCost = b.netLandedUnitCost || 0;
      const val = roundMoney(rem * unitCost);
      inventoryValuation = addMoney(inventoryValuation, val);

      const did = String(b.dealershipId);
      dshipBatchValuationMap.set(did, addMoney(dshipBatchValuationMap.get(did) || 0, val));

      if (b.expiryDate) {
        const expDate = new Date(b.expiryDate);
        const diffDays = Math.floor((expDate.getTime() - nowTime) / (1000 * 60 * 60 * 24));
        const pName = (b.productId as any)?.name || (b as any).productName || "Product";
        const sku = (b.variantId as any)?.sku || (b.productId as any)?.sku || (b as any).sku || "";

        if (diffDays < 0) {
          expiredBatches.push({
            batchNumber: b.batchNumber || "BATCH",
            productName: pName,
            sku,
            remainingQuantity: rem,
            expiryDate: expDate,
            daysExpired: Math.abs(diffDays),
          });
        } else if (diffDays <= 60) {
          nearExpiryBatches.push({
            batchNumber: b.batchNumber || "BATCH",
            productName: pName,
            sku,
            remainingQuantity: rem,
            expiryDate: expDate,
            daysUntilExpiry: diffDays,
          });
        }
      }
    }

    // 2. Physical Inventory Counts from InventoryBalance
    const invBalQuery: Record<string, any> = {
      businessId,
    };
    if (dealershipId) invBalQuery.dealershipId = dealershipId;

    const invBalances = await InventoryBalance.find(invBalQuery)
      .populate("productId", "name minStock sku")
      .populate("variantId", "sku variantName")
      .lean();

    // Resolve unpopulated products if needed
    const unpopulatedProdIds = invBalances
      .filter((ib) => typeof ib.productId !== "object" || !(ib.productId as any)?.name)
      .map((ib) => String(ib.productId));

    let dbProdMap = new Map<string, any>();
    if (unpopulatedProdIds.length > 0) {
      const dbProds = await Product.find({ _id: { $in: unpopulatedProdIds } }).lean();
      for (const p of dbProds) {
        dbProdMap.set(String(p._id), p);
      }
    }

    let totalStockUnits = 0;
    let totalAvailableUnits = 0;
    let totalReservedUnits = 0;
    let totalDamagedUnits = 0;
    const dshipUnitMap = new Map<string, { units: number; lowStock: number }>();
    const lowStockAlerts: any[] = [];

    for (const ib of invBalances) {
      const onHand = ib.onHandQuantity || 0;
      const avail = ib.availableQuantity || 0;
      const res = ib.reservedQuantity || 0;
      const dmg = ib.damagedQuantity || 0;

      totalStockUnits += onHand;
      totalAvailableUnits += avail;
      totalReservedUnits += res;
      totalDamagedUnits += dmg;

      const did = String(ib.dealershipId);
      const dEntry = dshipUnitMap.get(did) || { units: 0, lowStock: 0 };
      dEntry.units += onHand;

      const pIdStr = String((ib.productId as any)?._id || ib.productId);
      const isPopulated = Boolean(ib.productId && typeof ib.productId === "object" && (ib.productId as any).name);
      const resolvedProd = isPopulated ? ib.productId : dbProdMap.get(pIdStr);

      const minStock = (resolvedProd as any)?.minStock || (ib as any).minStock || 10;
      if (avail <= minStock) {
        dEntry.lowStock += 1;
        lowStockAlerts.push({
          productId: pIdStr,
          variantId: String((ib.variantId as any)?._id || ib.variantId || ""),
          productName: (resolvedProd as any)?.name || (ib as any).productName || "Product",
          sku: (ib.variantId as any)?.sku || (resolvedProd as any)?.sku || (ib as any).sku || "",
          availableQuantity: avail,
          minStock,
          dealershipName: dealershipMap.get(did)?.name,
        });
      }
      dshipUnitMap.set(did, dEntry);
    }

    // Dealership-wise inventory comparison
    const dealershipInventoryComparison = dealerships.map((d) => {
      const did = String(d._id);
      const units = dshipUnitMap.get(did)?.units || 0;
      const val = dshipBatchValuationMap.get(did) || 0;
      const lowStockCount = dshipUnitMap.get(did)?.lowStock || 0;
      return {
        dealershipId: did,
        dealershipName: d.name,
        stockUnits: units,
        valuation: val,
        lowStockCount,
      };
    });

    // Fast-moving products (top sold by volume)
    const fastMovingProducts = Array.from(productSalesMap.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10)
      .map((p) => ({
        productId: String(p.product?._id || p.product),
        variantId: String(p.variant?._id || p.variant),
        productName: p.name,
        sku: p.sku,
        unitsSoldInPeriod: p.qty,
        revenue: p.revenue,
      }));

    return {
      inventory: {
        totalStockUnits,
        totalAvailableUnits,
        totalReservedUnits,
        totalDamagedUnits,
        inventoryValuation,
        dealershipComparison: dealershipInventoryComparison,
        lowStockAlerts: lowStockAlerts.slice(0, 15),
        fastMovingProducts,
        slowMovingProducts: [],
        expiryAlerts: {
          expiredBatches,
          nearExpiryBatches,
        },
      },
      inventoryValuation,
      dealershipInventoryComparison,
    };
  }
}
