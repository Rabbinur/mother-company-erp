import mongoose from "mongoose";
import { Dealership } from "@/models/Dealership";
import { ProductIntelligenceService } from "./ProductIntelligenceService";
import { CustomerIntelligenceService } from "./CustomerIntelligenceService";
import { SalesmanPerformanceService } from "./SalesmanPerformanceService";
import { SupplierIntelligenceService } from "./SupplierIntelligenceService";
import { DemandIntelligenceService } from "./DemandIntelligenceService";
import { DashboardDateHelper } from "../dashboard/DashboardDateHelper";
import type { AnalyticsDateFilter, OperationalAnalyticsPayload } from "./types";

export class OperationalAnalyticsService {
  /**
   * Orchestrates comprehensive Advanced Business Intelligence analytics across 5 operational domains.
   */
  static async getOperationalAnalytics(params: {
    businessId: string | mongoose.Types.ObjectId;
    dealershipId?: string | mongoose.Types.ObjectId;
    principalCompanyId?: string | mongoose.Types.ObjectId;
    startDate?: string | Date;
    endDate?: string | Date;
    periodPreset?: string;
    canViewCosts?: boolean;
    domain?: "all" | "product" | "customer" | "salesman" | "supplier" | "demand";
  }): Promise<OperationalAnalyticsPayload> {
    const bId = new mongoose.Types.ObjectId(String(params.businessId));
    const dId = params.dealershipId ? new mongoose.Types.ObjectId(String(params.dealershipId)) : undefined;
    const pCompId = params.principalCompanyId
      ? new mongoose.Types.ObjectId(String(params.principalCompanyId))
      : undefined;

    const dateRange = DashboardDateHelper.parseDateRange({
      preset: params.periodPreset || "last_30_days",
      startDate: params.startDate,
      endDate: params.endDate,
    });

    const dateFilter: AnalyticsDateFilter = {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      period: dateRange.preset,
    };

    const canViewCosts = params.canViewCosts !== false;
    const domain = params.domain || "all";

    // Dealership names lookup
    const dealerships = await Dealership.find({
      businessId: bId,
      status: "active",
      ...(dId ? { _id: dId } : {}),
    }).lean();

    const dealershipMap = new Map<string, { name: string; code: string }>();
    dealerships.forEach((d) => {
      dealershipMap.set(String(d._id), { name: d.name, code: d.code });
    });

    // 1. Product Intelligence
    let productIntelligence: OperationalAnalyticsPayload["productIntelligence"] = {
      products: [],
      fastMoving: [],
      slowMoving: [],
      topReturnRates: [],
    };
    if (domain === "all" || domain === "product") {
      productIntelligence = await ProductIntelligenceService.getProductIntelligence({
        businessId: bId,
        dealershipId: dId,
        dateFilter,
        canViewCosts,
        dealershipMap,
      });
    }

    // 2. Customer Intelligence
    let customerIntelligence: OperationalAnalyticsPayload["customerIntelligence"] = {
      customers: [],
      segmentCounts: {},
      inactiveCustomers: [],
      highCreditRisk: [],
    };
    if (domain === "all" || domain === "customer") {
      customerIntelligence = await CustomerIntelligenceService.getCustomerIntelligence({
        businessId: bId,
        dealershipId: dId,
        dateFilter,
        dealershipMap,
      });
    }

    // 3. Salesman Performance
    let salesmanPerformance: OperationalAnalyticsPayload["salesmanPerformance"] = {
      salesmen: [],
      topPerformers: [],
    };
    if (domain === "all" || domain === "salesman") {
      salesmanPerformance = await SalesmanPerformanceService.getSalesmanPerformance({
        businessId: bId,
        dealershipId: dId,
        dateFilter,
        dealershipMap,
      });
    }

    // 4. Supplier Intelligence
    let supplierIntelligence: OperationalAnalyticsPayload["supplierIntelligence"] = {
      suppliers: [],
      principalComparisons: [],
    };
    if (domain === "all" || domain === "supplier") {
      supplierIntelligence = await SupplierIntelligenceService.getSupplierIntelligence({
        businessId: bId,
        dealershipId: dId,
        principalCompanyId: pCompId,
        dateFilter,
        canViewCosts,
      });
    }

    // 5. Demand & Purchase Forecast Intelligence
    let demandIntelligence: OperationalAnalyticsPayload["demandIntelligence"] = {
      forecasts: [],
      reorderAlerts: [],
    };
    if (domain === "all" || domain === "demand") {
      demandIntelligence = await DemandIntelligenceService.getDemandForecasts({
        businessId: bId,
        dealershipId: dId,
        principalCompanyId: pCompId,
        dateFilter,
      });
    }

    return {
      filterScope: {
        businessId: String(bId),
        dealershipId: dId ? String(dId) : undefined,
        principalCompanyId: pCompId ? String(pCompId) : undefined,
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate,
      },
      productIntelligence,
      customerIntelligence,
      salesmanPerformance,
      supplierIntelligence,
      demandIntelligence,
      generatedAt: new Date(),
    };
  }
}
