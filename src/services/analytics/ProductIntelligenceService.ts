import mongoose from "mongoose";
import { Order } from "@/models/Order";
import { SalesReturn } from "@/models/SalesReturn";
import { InventoryBalance } from "@/models/InventoryBalance";
import { Product } from "@/models/Product";
import { roundMoney, addMoney, subtractMoney } from "../AccountingService";
import type { AnalyticsDateFilter, ProductPerformanceItem } from "./types";

export class ProductIntelligenceService {
  static async getProductIntelligence(params: {
    businessId: mongoose.Types.ObjectId;
    dealershipId?: mongoose.Types.ObjectId;
    dateFilter: AnalyticsDateFilter;
    canViewCosts: boolean;
    dealershipMap: Map<string, { name: string; code: string }>;
  }): Promise<{
    products: ProductPerformanceItem[];
    fastMoving: ProductPerformanceItem[];
    slowMoving: ProductPerformanceItem[];
    topReturnRates: ProductPerformanceItem[];
  }> {
    const { businessId, dealershipId, dateFilter, canViewCosts, dealershipMap } = params;

    // 1. Fulfilled Orders in Period
    const orderFilter: Record<string, any> = {
      businessId,
      $or: [
        { orderStatus: { $in: ["FULFILLED", "fulfilled", "DELIVERED", "delivered"] } },
        { fulfillmentStatus: "fulfilled" },
        { status: { $in: ["FULFILLED", "fulfilled", "DELIVERED", "delivered"] } },
      ],
      $and: [
        {
          $or: [
            { fulfilledDate: { $gte: dateFilter.startDate, $lte: dateFilter.endDate } },
            { orderDate: { $gte: dateFilter.startDate, $lte: dateFilter.endDate } },
          ],
        },
      ],
    };
    if (dealershipId) orderFilter.dealershipId = dealershipId;

    const orders = await Order.find(orderFilter).lean();

    // 2. Sales Returns in Period
    const returnFilter: Record<string, any> = {
      businessId,
      status: { $in: ["approved", "settled", "APPROVED", "SETTLED"] },
      createdAt: { $gte: dateFilter.startDate, $lte: dateFilter.endDate },
    };
    if (dealershipId) returnFilter.dealershipId = dealershipId;

    const returns = await SalesReturn.find(returnFilter).lean();
    const returnQtyMap = new Map<string, number>();

    for (const ret of returns) {
      if (Array.isArray(ret.items)) {
        for (const rItem of ret.items) {
          const key = String(rItem.variantId || rItem.productId);
          const q = (rItem as any).quantity || rItem.returnedQuantity || 0;
          returnQtyMap.set(key, addMoney(returnQtyMap.get(key) || 0, q));
        }
      }
    }

    // 3. Current Available Stock from InventoryBalance
    const invBalQuery: Record<string, any> = { businessId };
    if (dealershipId) invBalQuery.dealershipId = dealershipId;
    const invBalances = await InventoryBalance.find(invBalQuery).lean();
    const stockMap = new Map<string, number>();
    for (const ib of invBalances) {
      const key = String(ib.variantId || ib.productId);
      stockMap.set(key, addMoney(stockMap.get(key) || 0, ib.availableQuantity || 0));
    }

    // 4. Product Sales Accumulation
    const productStats = new Map<
      string,
      {
        productId: string;
        variantId: string;
        name: string;
        sku: string;
        qtySold: number;
        grossSales: number;
        netRevenue: number;
        cost: number;
        dealerships: Map<string, { qty: number; rev: number }>;
      }
    >();

    for (const ord of orders) {
      const dIdStr = String(ord.dealershipId);
      if (Array.isArray(ord.items)) {
        for (const it of ord.items) {
          const pKey = String(it.variantId || it.productId);
          const entry = productStats.get(pKey) || {
            productId: String(it.productId),
            variantId: String(it.variantId || it.productId),
            name: it.name || "Product",
            sku: it.sku || "",
            qtySold: 0,
            grossSales: 0,
            netRevenue: 0,
            cost: 0,
            dealerships: new Map(),
          };

          const qty = it.quantity || 1;
          const lineGross = roundMoney((it as any).totalPrice ?? ((it.unitPrice ?? it.customerPriceSnapshot ?? 0) * qty));
          const lineCost = roundMoney(((it as any).costPrice || 0) * qty);

          entry.qtySold += qty;
          entry.grossSales = addMoney(entry.grossSales, lineGross);
          entry.netRevenue = addMoney(entry.netRevenue, lineGross);
          entry.cost = addMoney(entry.cost, lineCost);

          const dSub = entry.dealerships.get(dIdStr) || { qty: 0, rev: 0 };
          dSub.qty += qty;
          dSub.rev = addMoney(dSub.rev, lineGross);
          entry.dealerships.set(dIdStr, dSub);

          productStats.set(pKey, entry);
        }
      }
    }

    // 5. Finalize List
    const allProducts: ProductPerformanceItem[] = Array.from(productStats.values()).map((p) => {
      const returnedQty = returnQtyMap.get(p.variantId) || returnQtyMap.get(p.productId) || 0;
      const returnRate = p.qtySold > 0 ? roundMoney((returnedQty / p.qtySold) * 100) : 0;
      const grossProfit = canViewCosts ? Math.max(0, subtractMoney(p.netRevenue, p.cost)) : 0;
      const margin = canViewCosts && p.netRevenue > 0 ? roundMoney((grossProfit / p.netRevenue) * 100) : 0;

      const dshipBreakdown = Array.from(p.dealerships.entries()).map(([did, val]) => ({
        dealershipId: did,
        dealershipName: dealershipMap.get(did)?.name || "Branch",
        quantitySold: val.qty,
        revenue: val.rev,
      }));

      return {
        productId: p.productId,
        variantId: p.variantId,
        name: p.name,
        sku: p.sku,
        quantitySold: p.qtySold,
        grossSales: p.grossSales,
        netRevenue: p.netRevenue,
        costOfGoodsSold: canViewCosts ? p.cost : 0,
        grossProfit,
        grossMarginPercentage: margin,
        returnedQuantity: returnedQty,
        returnRatePercentage: returnRate,
        currentAvailableStock: stockMap.get(p.variantId) || stockMap.get(p.productId) || 0,
        dealershipBreakdown: dshipBreakdown,
      };
    });

    allProducts.sort((a, b) => b.netRevenue - a.netRevenue);

    // Fast-moving by volume sold
    const fastMoving = [...allProducts].sort((a, b) => b.quantitySold - a.quantitySold).slice(0, 10);

    // Slow-moving: High on-hand stock with lowest sales
    const slowMoving = [...allProducts]
      .filter((p) => p.currentAvailableStock > 0)
      .sort((a, b) => a.quantitySold - b.quantitySold || b.currentAvailableStock - a.currentAvailableStock)
      .slice(0, 10);

    // Highest return rate
    const topReturnRates = [...allProducts]
      .filter((p) => p.returnedQuantity > 0)
      .sort((a, b) => b.returnRatePercentage - a.returnRatePercentage)
      .slice(0, 10);

    return {
      products: allProducts,
      fastMoving,
      slowMoving,
      topReturnRates,
    };
  }
}
