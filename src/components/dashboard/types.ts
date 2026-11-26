export type DashboardTab = "overview" | "sales" | "financials" | "inventory";

export type DateRangePreset =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_30_days"
  | "this_month"
  | "previous_month"
  | "custom";

export interface DashboardFilterState {
  preset: DateRangePreset;
  startDate?: string;
  endDate?: string;
  dealershipId?: string;
  principalCompanyId?: string;
}

export interface DealershipOption {
  _id: string;
  name: string;
  code: string;
}

export interface PrincipalCompanyOption {
  _id: string;
  name: string;
  code: string;
}

export interface ExecutiveOverviewKpis {
  totalSales: number;
  netSales: number;
  grossProfit: number;
  netProfit: number | null;
  netProfitMargin: number | null;
  totalReceivables: number;
  totalPayables: number;
  totalCustomerReceivables?: number;
  totalSupplierPayables?: number;
  inventoryValuation: number;
  activeDealerships: number;
  priorPeriodSales: number;
  salesGrowthPercentage: number;
}

export interface SalesTimelinePoint {
  date: string;
  label: string;
  sales: number;
  ordersCount: number;
}

export interface DealershipSalesItem {
  dealershipId: string;
  dealershipName: string;
  dealershipCode: string;
  sales: number;
  ordersCount: number;
  sharePercentage: number;
}

export interface TopProductSalesItem {
  productId: string;
  variantId: string;
  name: string;
  sku: string;
  quantitySold: number;
  revenue: number;
  grossProfit: number;
}

export interface TopCustomerItem {
  customerId: string;
  customerName: string;
  shopName: string;
  phone: string;
  ordersCount: number;
  totalSpent: number;
  outstandingBalance: number;
}

export interface SalesReturnsSummary {
  totalReturnsAmount: number;
  returnsCount: number;
  refundedCash: number;
  creditNotesIssued: number;
}

export interface FinancialAnalyticsData {
  grossRevenue: number;
  salesReturns: number;
  netRevenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  grossMarginPercentage: number;
  totalOperatingExpenses: number;
  operatingExpenses: Array<{ code: string; name: string; amount: number }>;
  netOperatingProfit: number | null;
  dealershipProfitability: Array<{
    dealershipId: string;
    dealershipName: string;
    revenue: number;
    cogs: number;
    grossProfit: number;
    grossMarginPercentage: number;
  }>;
  treasury: {
    sharedTreasuryCash: number;
    sharedTreasuryBank: number;
    sharedTreasuryTotal: number;
    dealershipOperatingTreasuryTotal: number;
    dealershipBreakdown: Array<{
      dealershipId: string;
      dealershipName: string;
      balance: number;
    }>;
    totalLiquidFunds: number;
  };
}

export interface InventoryAnalyticsData {
  totalStockUnits: number;
  totalAvailableUnits: number;
  totalReservedUnits: number;
  totalDamagedUnits: number;
  inventoryValuation: number;
  dealershipComparison: Array<{
    dealershipId: string;
    dealershipName: string;
    stockUnits: number;
    valuation: number;
    lowStockCount: number;
  }>;
  lowStockAlerts: Array<{
    productId: string;
    variantId: string;
    productName: string;
    sku: string;
    availableQuantity: number;
    minStock: number;
    dealershipName?: string;
  }>;
  fastMovingProducts: Array<{
    productId: string;
    variantId: string;
    productName: string;
    sku: string;
    unitsSoldInPeriod: number;
    revenue: number;
  }>;
  slowMovingProducts: Array<{
    productId: string;
    variantId: string;
    productName: string;
    sku: string;
    onHandQuantity: number;
    valuation: number;
  }>;
  expiryAlerts: {
    expiredBatches: Array<{
      batchNumber: string;
      productName: string;
      sku: string;
      remainingQuantity: number;
      expiryDate: string | Date;
      daysExpired: number;
    }>;
    nearExpiryBatches: Array<{
      batchNumber: string;
      productName: string;
      sku: string;
      remainingQuantity: number;
      expiryDate: string | Date;
      daysUntilExpiry: number;
    }>;
  };
}

export interface ExecutiveDashboardData {
  dateRange: {
    preset: string;
    startDate: string | Date;
    endDate: string | Date;
    priorStartDate: string | Date;
    priorEndDate: string | Date;
  };
  filterScope: {
    businessId: string;
    dealershipId?: string;
    principalCompanyId?: string;
    isConsolidated: boolean;
  };
  overview: ExecutiveOverviewKpis;
  sales: {
    timeline: SalesTimelinePoint[];
    dealershipComparison: DealershipSalesItem[];
    topProducts: TopProductSalesItem[];
    topCustomers: TopCustomerItem[];
    returnsSummary: SalesReturnsSummary;
  };
  financials: FinancialAnalyticsData;
  inventory: InventoryAnalyticsData;
  generatedAt: string | Date;
}
