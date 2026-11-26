import mongoose from "mongoose";
import { Order } from "@/models/Order";
import { InventoryBalance } from "@/models/InventoryBalance";
import { Product } from "@/models/Product";
import { roundMoney } from "../AccountingService";
import type { AnalyticsDateFilter, DemandForecastItem } from "./types";

export class DemandIntelligenceService {
  static async getDemandForecasts(params: {
    businessId: mongoose.Types.ObjectId;
    dealershipId?: mongoose.Types.ObjectId;
    principalCompanyId?: mongoose.Types.ObjectId;
    dateFilter: AnalyticsDateFilter;
  }): Promise<{
    forecasts: DemandForecastItem[];
    reorderAlerts: DemandForecastItem[];
  }> {
    const { businessId, dealershipId, principalCompanyId, dateFilter } = params;

    // Calculate duration in days
    const durationMs = dateFilter.endDate.getTime() - dateFilter.startDate.getTime();
    const periodDays = Math.max(1, Math.round(durationMs / (1000 * 60 * 60 * 24)));

    // 1. Fulfilled orders in historical period
    const orderQuery: Record<string, any> = {
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
    if (dealershipId) orderQuery.dealershipId = dealershipId;
    if (principalCompanyId) orderQuery.principalCompanyId = principalCompanyId;

    const orders = await Order.find(orderQuery).lean();

    // Map units sold per product
    const salesVolumeMap = new Map<string, { productId: string; variantId?: string; name: string; sku: string; units: number }>();

    for (const ord of orders) {
      if (Array.isArray(ord.items)) {
        for (const it of ord.items) {
          const key = String(it.productId);
          const entry = salesVolumeMap.get(key) || {
            productId: key,
            variantId: it.variantId ? String(it.variantId) : undefined,
            name: it.name || "Product",
            sku: it.sku || "",
            units: 0,
          };
          entry.units += it.quantity || 1;
          salesVolumeMap.set(key, entry);
        }
      }
    }

    // 2. Available stock from InventoryBalance
    const invQuery: Record<string, any> = { businessId };
    if (dealershipId) invQuery.dealershipId = dealershipId;
    const invBalances = await InventoryBalance.find(invQuery).lean();
    const availableStockMap = new Map<string, number>();

    for (const ib of invBalances) {
      const pKey = String(ib.productId);
      availableStockMap.set(pKey, (availableStockMap.get(pKey) || 0) + (ib.availableQuantity || 0));
    }

    // 3. Products catalog to get safety minStock
    const prodQuery: Record<string, any> = { businessId, status: "active" };
    if (principalCompanyId) prodQuery.principalCompanyId = principalCompanyId;
    const products = await Product.find(prodQuery).lean();

    const forecastList: DemandForecastItem[] = [];

    for (const prod of products) {
      const pIdStr = String(prod._id);
      const salesData = salesVolumeMap.get(pIdStr);

      const soldUnits = salesData?.units || 0;
      const dailyRunRate = roundMoney(soldUnits / periodDays);
      const projected30Day = roundMoney(dailyRunRate * 30);
      const currentStock = availableStockMap.get(pIdStr) || 0;

      const daysOfSupply = dailyRunRate > 0 ? Math.round(currentStock / dailyRunRate) : 999;
      
      // Reorder Point & Safety Stock Policy:
      // Safety stock buffer is provided by catalog `minStock` (buffer against demand volatility).
      // Lead time replenishment demand = (dailyRunRate * leadTimeDays).
      // Reorder Point = Lead Time Demand + minStock (Safety Stock).
      // This strictly avoids counting the safety buffer twice.
      const leadTimeDays = 7; // Preserved assumed supplier replenishment lead time
      const minStock = prod.minStock || 10;
      const leadTimeDemand = roundMoney(dailyRunRate * leadTimeDays);
      const reorderPoint = Math.round(leadTimeDemand + minStock);
      const suggestedReorder = Math.max(0, reorderPoint - currentStock);

      let stockStatus: "CRITICAL" | "LOW" | "ADEQUATE" | "OVERSTOCKED";
      if (currentStock <= 0 || (dailyRunRate > 0 && daysOfSupply <= 3)) {
        stockStatus = "CRITICAL";
      } else if (currentStock <= minStock || daysOfSupply <= 7) {
        stockStatus = "LOW";
      } else if (daysOfSupply > 45) {
        stockStatus = "OVERSTOCKED";
      } else {
        stockStatus = "ADEQUATE";
      }

      forecastList.push({
        productId: pIdStr,
        variantId: salesData?.variantId,
        productName: prod.name,
        sku: prod.sku,
        historicalUnitsSold: soldUnits,
        periodDays,
        dailyRunRate,
        leadTimeDays,
        projected30DayDemand: projected30Day,
        currentAvailableStock: currentStock,
        daysOfSupply,
        minStockThreshold: minStock,
        reorderPoint,
        suggestedReorderQuantity: suggestedReorder,
        stockStatus,
        isStatisticalEstimate: true,
      });
    }

    // Sort by most urgent reorder needed
    forecastList.sort((a, b) => b.suggestedReorderQuantity - a.suggestedReorderQuantity);

    const reorderAlerts = forecastList.filter((f) => f.suggestedReorderQuantity > 0 || f.stockStatus === "CRITICAL");

    return {
      forecasts: forecastList,
      reorderAlerts,
    };
  }
}
