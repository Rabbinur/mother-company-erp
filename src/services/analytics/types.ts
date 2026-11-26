import mongoose from "mongoose";

export interface AnalyticsDateFilter {
  startDate: Date;
  endDate: Date;
  period?: string;
}

export interface ProductPerformanceItem {
  productId: string;
  variantId?: string;
  name: string;
  sku: string;
  category?: string;
  quantitySold: number;
  grossSales: number;
  netRevenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  grossMarginPercentage: number;
  returnedQuantity: number;
  returnRatePercentage: number;
  currentAvailableStock: number;
  dealershipBreakdown?: Array<{
    dealershipId: string;
    dealershipName: string;
    quantitySold: number;
    revenue: number;
  }>;
}

export interface CustomerSegmentItem {
  customerId: string;
  customerName: string;
  shopName: string;
  phone: string;
  segment: "VIP" | "REGULAR" | "OCCASIONAL" | "AT_RISK" | "INACTIVE";
  ordersCount: number;
  totalSpent: number;
  netRevenue: number;
  averageOrderValue: number;
  lastOrderDate: Date | null;
  daysSinceLastOrder: number;
  creditLimit: number;
  outstandingBalance: number;
  creditUtilizationPercentage: number | null;
  collectionRatePercentage: number;
  dealershipId?: string;
  dealershipName?: string;
}

export interface SalesmanPerformanceItem {
  salesmanId: string;
  salesmanName: string;
  email: string;
  dealershipId?: string;
  dealershipName?: string;
  bookedOrdersCount: number;
  bookedSalesAmount: number;
  fulfilledOrdersCount: number;
  fulfilledSalesAmount: number;
  fulfillmentRatePercentage: number;
  cancelledOrdersCount: number;
  cancellationRatePercentage: number;
  returnedOrdersCount: number;
  returnsAmount: number;
  collectedAmount: number;
  collectionEfficiencyPercentage: number;
  compositeScore: number;
  performanceRank: number;
}

export interface SupplierIntelligenceItem {
  vendorId: string;
  vendorName: string;
  principalCompanyId?: string;
  principalCompanyName?: string;
  grnCount: number;
  totalPurchasedQuantity: number;
  totalPurchasedValue: number;
  totalShortageQuantity: number;
  shortageRatePercentage: number | null;
  purchaseReturnCount: number;
  purchaseReturnAmount: number;
  purchaseReturnRatePercentage: number | null;
  historicalPriceTrends: Array<{
    date: Date;
    productName: string;
    sku: string;
    unitPrice: number;
    landedUnitCost: number;
  }>;
}

export interface DemandForecastItem {
  productId: string;
  variantId?: string;
  productName: string;
  sku: string;
  historicalUnitsSold: number;
  periodDays: number;
  dailyRunRate: number;
  leadTimeDays: number;
  projected30DayDemand: number;
  currentAvailableStock: number;
  daysOfSupply: number;
  minStockThreshold: number;
  reorderPoint: number;
  suggestedReorderQuantity: number;
  stockStatus: "CRITICAL" | "LOW" | "ADEQUATE" | "OVERSTOCKED";
  isStatisticalEstimate: true;
}

export interface OperationalAnalyticsPayload {
  filterScope: {
    businessId: string;
    dealershipId?: string;
    principalCompanyId?: string;
    startDate: Date;
    endDate: Date;
  };
  productIntelligence: {
    products: ProductPerformanceItem[];
    fastMoving: ProductPerformanceItem[];
    slowMoving: ProductPerformanceItem[];
    topReturnRates: ProductPerformanceItem[];
  };
  customerIntelligence: {
    customers: CustomerSegmentItem[];
    segmentCounts: Record<string, number>;
    inactiveCustomers: CustomerSegmentItem[];
    highCreditRisk: CustomerSegmentItem[];
  };
  salesmanPerformance: {
    salesmen: SalesmanPerformanceItem[];
    topPerformers: SalesmanPerformanceItem[];
  };
  supplierIntelligence: {
    suppliers: SupplierIntelligenceItem[];
    principalComparisons: Array<{
      principalCompanyId: string;
      principalCompanyName: string;
      totalValue: number;
      totalQuantity: number;
      shortageRate: number | null;
    }>;
  };
  demandIntelligence: {
    forecasts: DemandForecastItem[];
    reorderAlerts: DemandForecastItem[];
  };
  generatedAt: Date;
}
