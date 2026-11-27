import mongoose from "mongoose";
import { Dealership } from "@/models/Dealership";
import { ProductIntelligenceService } from "./ProductIntelligenceService";
import { CustomerIntelligenceService } from "./CustomerIntelligenceService";
import { SalesmanPerformanceService } from "./SalesmanPerformanceService";
import { SupplierIntelligenceService } from "./SupplierIntelligenceService";
import { DemandIntelligenceService } from "./DemandIntelligenceService";
import { DashboardDateHelper } from "../dashboard/DashboardDateHelper";
import type { AnalyticsDateFilter, OperationalAnalyticsPayload } from "./types";
import {
  DeliveryPerformanceService,
  VehicleTripService,
  WarehouseOperationsService,
  WorkerIntelligenceService,
  OperationalCostService,
  OperationalBottleneckService,
  DeliveryReportService,
  type OperationalFilterParams,
  type OperationalIntelligencePayload,
  type DeliveryReportPayload,
} from "./operational";

export class OperationalAnalyticsService {
  private static async getDealershipMap(bId: mongoose.Types.ObjectId, dId?: mongoose.Types.ObjectId) {
    const items = await Dealership.find({ businessId: bId, status: "active", ...(dId ? { _id: dId } : {}) }).lean();
    const map = new Map<string, { name: string; code: string }>();
    items.forEach((d) => map.set(String(d._id), { name: d.name, code: d.code }));
    return map;
  }

  static async getOperationalAnalytics(params: {
    businessId: string | mongoose.Types.ObjectId;
    dealershipId?: string | mongoose.Types.ObjectId;
    principalCompanyId?: string | mongoose.Types.ObjectId;
    startDate?: string | Date;
    endDate?: string | Date;
    periodPreset?: string;
    canViewCosts?: boolean;
    domain?: "all" | "product" | "customer" | "salesman" | "supplier" | "demand" | "operations";
  }): Promise<OperationalAnalyticsPayload> {
    const bId = new mongoose.Types.ObjectId(String(params.businessId));
    const dId = params.dealershipId ? new mongoose.Types.ObjectId(String(params.dealershipId)) : undefined;
    const pCompId = params.principalCompanyId ? new mongoose.Types.ObjectId(String(params.principalCompanyId)) : undefined;

    const dateRange = DashboardDateHelper.parseDateRange({
      preset: params.periodPreset || "last_30_days",
      startDate: params.startDate,
      endDate: params.endDate,
    });
    const dateFilter: AnalyticsDateFilter = { startDate: dateRange.startDate, endDate: dateRange.endDate, period: dateRange.preset };
    const canViewCosts = params.canViewCosts !== false;
    const domain = params.domain || "all";
    const dealershipMap = await this.getDealershipMap(bId, dId);

    let productIntelligence: OperationalAnalyticsPayload["productIntelligence"] = { products: [], fastMoving: [], slowMoving: [], topReturnRates: [] };
    if (domain === "all" || domain === "product") {
      productIntelligence = await ProductIntelligenceService.getProductIntelligence({ businessId: bId, dealershipId: dId, dateFilter, canViewCosts, dealershipMap });
    }

    let customerIntelligence: OperationalAnalyticsPayload["customerIntelligence"] = { customers: [], segmentCounts: {}, inactiveCustomers: [], highCreditRisk: [] };
    if (domain === "all" || domain === "customer") {
      customerIntelligence = await CustomerIntelligenceService.getCustomerIntelligence({ businessId: bId, dealershipId: dId, dateFilter, dealershipMap });
    }

    let salesmanPerformance: OperationalAnalyticsPayload["salesmanPerformance"] = { salesmen: [], topPerformers: [] };
    if (domain === "all" || domain === "salesman") {
      salesmanPerformance = await SalesmanPerformanceService.getSalesmanPerformance({ businessId: bId, dealershipId: dId, dateFilter, dealershipMap });
    }

    let supplierIntelligence: OperationalAnalyticsPayload["supplierIntelligence"] = { suppliers: [], principalComparisons: [] };
    if (domain === "all" || domain === "supplier") {
      supplierIntelligence = await SupplierIntelligenceService.getSupplierIntelligence({ businessId: bId, dealershipId: dId, principalCompanyId: pCompId, dateFilter, canViewCosts });
    }

    let demandIntelligence: OperationalAnalyticsPayload["demandIntelligence"] = { forecasts: [], reorderAlerts: [] };
    if (domain === "all" || domain === "demand") {
      demandIntelligence = await DemandIntelligenceService.getDemandForecasts({ businessId: bId, dealershipId: dId, principalCompanyId: pCompId, dateFilter });
    }

    return {
      filterScope: { businessId: String(bId), dealershipId: dId ? String(dId) : undefined, principalCompanyId: pCompId ? String(pCompId) : undefined, startDate: dateFilter.startDate, endDate: dateFilter.endDate },
      productIntelligence,
      customerIntelligence,
      salesmanPerformance,
      supplierIntelligence,
      demandIntelligence,
      generatedAt: new Date(),
    };
  }

  static async getOperationalIntelligence(params: OperationalFilterParams): Promise<OperationalIntelligencePayload> {
    const bId = new mongoose.Types.ObjectId(String(params.businessId));
    const dId = params.dealershipId ? new mongoose.Types.ObjectId(String(params.dealershipId)) : undefined;
    const pCompId = params.principalCompanyId ? new mongoose.Types.ObjectId(String(params.principalCompanyId)) : undefined;
    const wId = params.warehouseId ? new mongoose.Types.ObjectId(String(params.warehouseId)) : undefined;
    const vId = params.vehicleId ? new mongoose.Types.ObjectId(String(params.vehicleId)) : undefined;
    const dmId = params.deliverymanId ? new mongoose.Types.ObjectId(String(params.deliverymanId)) : undefined;

    const dateRange = DashboardDateHelper.parseDateRange({ preset: params.periodPreset || "last_30_days", startDate: params.startDate, endDate: params.endDate });
    const canViewCosts = params.canViewCosts !== false;
    const dealershipMap = await this.getDealershipMap(bId, dId);

    const deliveryPerformance = await DeliveryPerformanceService.getDeliveryPerformance({
      businessId: bId, dealershipId: dId, warehouseId: wId, vehicleId: vId, deliverymanId: dmId, startDate: dateRange.startDate, endDate: dateRange.endDate, dealershipMap,
    });

    const vehicleTripAnalytics = await VehicleTripService.getVehicleTripData({
      businessId: bId, dealershipId: dId, warehouseId: wId, vehicleId: vId, startDate: dateRange.startDate, endDate: dateRange.endDate, canViewCosts,
    });

    const warehouseOperations = await WarehouseOperationsService.getWarehouseOperationsData({
      businessId: bId, dealershipId: dId, warehouseId: wId, startDate: dateRange.startDate, endDate: dateRange.endDate,
    });

    const workerIntelligence = await WorkerIntelligenceService.getWorkerIntelligence({
      businessId: bId, dealershipId: dId, warehouseId: wId, workerId: params.workerId, startDate: dateRange.startDate, endDate: dateRange.endDate, canViewCosts,
    });

    const operationalCosts = await OperationalCostService.getOperationalCostData({
      businessId: bId, dealershipId: dId, warehouseId: wId, principalCompanyId: pCompId, startDate: dateRange.startDate, endDate: dateRange.endDate,
      canViewCosts, dealershipMap, totalFulfilledDeliveries: deliveryPerformance.fulfilledDeliveriesCount, totalDeliveredQuantity: deliveryPerformance.totalDeliveredQuantity,
    });

    const bottlenecksAndRecommendations = OperationalBottleneckService.generateRecommendations({
      delivery: deliveryPerformance, warehouse: warehouseOperations, costs: operationalCosts,
    });

    return {
      filterScope: {
        businessId: String(bId), dealershipId: dId ? String(dId) : undefined, principalCompanyId: pCompId ? String(pCompId) : undefined,
        warehouseId: wId ? String(wId) : undefined, vehicleId: vId ? String(vId) : undefined, startDate: dateRange.startDate, endDate: dateRange.endDate,
      },
      deliveryPerformance,
      vehicleTripAnalytics,
      warehouseOperations,
      workerIntelligence,
      operationalCosts,
      bottlenecksAndRecommendations,
      generatedAt: new Date(),
    };
  }

  static async getDeliveryReport(params: OperationalFilterParams): Promise<DeliveryReportPayload> {
    const bId = new mongoose.Types.ObjectId(String(params.businessId));
    const dId = params.dealershipId ? new mongoose.Types.ObjectId(String(params.dealershipId)) : undefined;
    const wId = params.warehouseId ? new mongoose.Types.ObjectId(String(params.warehouseId)) : undefined;
    const vId = params.vehicleId ? new mongoose.Types.ObjectId(String(params.vehicleId)) : undefined;
    const dmId = params.deliverymanId ? new mongoose.Types.ObjectId(String(params.deliverymanId)) : undefined;

    const dateRange = DashboardDateHelper.parseDateRange({ preset: params.periodPreset || "last_30_days", startDate: params.startDate, endDate: params.endDate });
    const dealershipMap = await this.getDealershipMap(bId, dId);

    return DeliveryReportService.getDeliveryReportData({
      businessId: bId, dealershipId: dId, warehouseId: wId, vehicleId: vId, deliverymanId: dmId,
      startDate: dateRange.startDate, endDate: dateRange.endDate, canViewCosts: params.canViewCosts !== false, dealershipMap,
    });
  }
}
