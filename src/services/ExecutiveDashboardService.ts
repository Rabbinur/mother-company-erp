import mongoose from "mongoose";
import { Dealership } from "@/models/Dealership";
import type {
  DashboardDateRange,
  ExecutiveOverviewKpis,
  SalesTimelinePoint,
  DealershipSalesItem,
  TopProductSalesItem,
  TopCustomerItem,
  SalesReturnsSummary,
  FinancialAnalyticsData,
  InventoryAnalyticsData,
  ExecutiveDashboardData,
} from "./dashboard/types";
import {
  DashboardDateHelper,
  SalesAnalyticsAggregator,
  FinancialAnalyticsAggregator,
  InventoryAnalyticsAggregator,
} from "./dashboard/index";

export type * from "./dashboard/types";

export class ExecutiveDashboardService {
  /**
   * Parses time intervals into current and equivalent prior comparison date intervals.
   */
  static parseDateRange(
    paramsOrPreset?:
      | string
      | {
          preset?: string;
          startDate?: string | Date;
          endDate?: string | Date;
        },
    customStart?: string | Date,
    customEnd?: string | Date
  ): DashboardDateRange {
    return DashboardDateHelper.parseDateRange(paramsOrPreset, customStart, customEnd);
  }

  /**
   * Generates the comprehensive Executive Dashboard analytics payload.
   * Modular orchestrator coordinating sales, financials, and inventory sub-services.
   */
  static async getExecutiveDashboard(params: {
    businessId: string | mongoose.Types.ObjectId;
    dealershipId?: string | mongoose.Types.ObjectId;
    principalCompanyId?: string | mongoose.Types.ObjectId;
    periodPreset?: string;
    startDate?: string | Date;
    endDate?: string | Date;
    canViewCosts?: boolean;
  }): Promise<ExecutiveDashboardData> {
    const bId = new mongoose.Types.ObjectId(String(params.businessId));
    const dId = params.dealershipId ? new mongoose.Types.ObjectId(String(params.dealershipId)) : undefined;
    const pCompId = params.principalCompanyId
      ? new mongoose.Types.ObjectId(String(params.principalCompanyId))
      : undefined;

    const dateRange = this.parseDateRange({
      preset: params.periodPreset,
      startDate: params.startDate,
      endDate: params.endDate,
    });

    const isConsolidated = !dId;

    // Fetch active dealerships under business context
    const dealerships = await Dealership.find({
      businessId: bId,
      status: "active",
      ...(dId ? { _id: dId } : {}),
    }).lean();

    const dealershipMap = new Map<string, { name: string; code: string }>();
    dealerships.forEach((d) => {
      dealershipMap.set(String(d._id), { name: d.name, code: d.code });
    });

    // 1. First-pass receivables to obtain retailer balances for top customer reporting
    const custBalanceMap = new Map<string, number>();

    // 2. Sales Analytics Aggregation
    const salesResult = await SalesAnalyticsAggregator.aggregateSales({
      businessId: bId,
      dealershipId: dId,
      principalCompanyId: pCompId,
      dateRange,
      dealerships,
      dealershipMap,
      custBalanceMap,
    });

    // 3. Financial Analytics Aggregation
    const finResult = await FinancialAnalyticsAggregator.aggregateFinancials({
      businessId: bId,
      dealershipId: dId,
      principalCompanyId: pCompId,
      dealerships,
      dealershipMap,
      dealershipSalesMap: salesResult.dealershipSalesMap,
      currentPeriodGrossSales: salesResult.currentPeriodGrossSales,
      currentPeriodCost: salesResult.currentPeriodCost,
      totalReturnsAmount: salesResult.totalReturnsAmount,
      netSales: salesResult.netSales,
      grossProfit: salesResult.grossProfit,
    });

    // Populate top customer outstanding balances from financial ledger
    salesResult.sales.topCustomers.forEach((c) => {
      c.outstandingBalance = finResult.custBalanceMap.get(c.customerId) || 0;
    });

    // 4. Inventory Analytics Aggregation
    const invResult = await InventoryAnalyticsAggregator.aggregateInventory({
      businessId: bId,
      dealershipId: dId,
      principalCompanyId: pCompId,
      dealerships,
      dealershipMap,
      productSalesMap: salesResult.productSalesMap,
    });

    let grossProfit = salesResult.grossProfit;
    let netProfit = finResult.netProfit;
    let netProfitMargin = finResult.netProfitMargin;
    let grossMarginPercentage = finResult.grossMarginPercentage;
    let inventoryValuation = invResult.inventoryValuation;
    let costOfGoodsSold = salesResult.currentPeriodCost;
    let dealershipProfitability = finResult.financials.dealershipProfitability;
    const topProducts = salesResult.sales.topProducts;

    // Mask confidential purchase costs and margins if unauthorized
    if (params.canViewCosts === false) {
      grossProfit = 0;
      costOfGoodsSold = 0;
      inventoryValuation = 0;
      netProfit = null;
      netProfitMargin = null;
      grossMarginPercentage = 0;
      topProducts.forEach((p) => (p.grossProfit = 0));
      dealershipProfitability = [];
      invResult.inventory.inventoryValuation = 0;
      invResult.dealershipInventoryComparison.forEach((d) => (d.valuation = 0));
    }

    return {
      dateRange: {
        preset: dateRange.preset,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        priorStartDate: dateRange.priorStartDate,
        priorEndDate: dateRange.priorEndDate,
      },
      filterScope: {
        businessId: String(bId),
        dealershipId: dId ? String(dId) : undefined,
        principalCompanyId: pCompId ? String(pCompId) : undefined,
        isConsolidated,
      },
      overview: {
        totalSales: salesResult.currentPeriodGrossSales,
        netSales: salesResult.netSales,
        grossProfit,
        netProfit,
        netProfitMargin,
        totalReceivables: finResult.totalReceivables,
        totalPayables: finResult.totalPayables,
        totalCustomerReceivables: finResult.totalReceivables,
        totalSupplierPayables: finResult.totalPayables,
        inventoryValuation,
        activeDealerships: dealerships.length,
        priorPeriodSales: salesResult.priorPeriodSales,
        salesGrowthPercentage: salesResult.salesGrowthPercentage,
      },
      sales: {
        ...salesResult.sales,
        topProducts,
      },
      financials: {
        ...finResult.financials,
        costOfGoodsSold,
        grossProfit,
        grossMarginPercentage,
        netOperatingProfit: netProfit,
        dealershipProfitability,
      },
      inventory: {
        ...invResult.inventory,
        inventoryValuation,
      },
      generatedAt: new Date(),
    };
  }
}
