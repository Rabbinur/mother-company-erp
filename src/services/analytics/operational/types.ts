import mongoose from "mongoose";

export interface OperationalFilterParams {
  businessId: string | mongoose.Types.ObjectId;
  dealershipId?: string | mongoose.Types.ObjectId;
  principalCompanyId?: string | mongoose.Types.ObjectId;
  warehouseId?: string | mongoose.Types.ObjectId;
  vehicleId?: string | mongoose.Types.ObjectId;
  deliverymanId?: string | mongoose.Types.ObjectId;
  workerId?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  periodPreset?: string;
  canViewCosts?: boolean;
}

export interface DeliveryPerformanceData {
  totalOrdersAssigned: number;
  eligibleOrdersAssigned: number;
  cancelledDeliveriesCount: number;
  fulfilledDeliveriesCount: number;
  partiallyFulfilledCount: number;
  pendingDeliveriesCount: number;
  failedDeliveriesCount: number;
  rejectedDeliveriesCount: number;
  deliverySuccessRatePercentage: number;
  averageTripCompletionHours: number | null;
  averageDeliveryCompletionHours: number | null; // Backwards-compatible alias to trip completion
  stopDeliveryDuration: "NOT_CONFIGURED";
  promisedDeadlineCompliance: "NOT_CONFIGURED";
  totalLoadedQuantity: number;
  totalDeliveredQuantity: number;
  totalReturnedQuantity: number;
  totalDamagedQuantity: number;
  totalUndeliveredQuantity: number;
  deliverymanPerformance: Array<{
    deliverymanId: string;
    deliverymanName: string;
    assignedStops: number;
    eligibleStops: number;
    deliveredStops: number;
    failedStops: number;
    rejectedStops: number;
    cancelledStops: number;
    successRate: number;
    avgCompletionHours: number | null;
  }>;
  dealershipPerformance: Array<{
    dealershipId: string;
    dealershipName: string;
    assignedStops: number;
    eligibleStops: number;
    deliveredStops: number;
    returnedQuantity: number;
    successRate: number;
  }>;
}

export interface VehicleTripData {
  totalTrips: number;
  tripStatusDistribution: Record<string, number>;
  averageStopsPerTrip: number;
  averageDeliveredQtyPerTrip: number;
  averageTripDurationMinutes: number | null;
  vehicleActivity: Array<{
    vehicleId: string;
    registrationNumber: string;
    vehicleType: string;
    tripsCount: number;
    stopsDelivered: number;
    quantityDelivered: number;
    totalTripExpenses: number | null;
    capacityUtilization: "NOT_CONFIGURED" | number;
  }>;
}

export interface WarehouseOperationsData {
  grnReceiving: {
    totalGrnsReceived: number;
    verifiedGrnsCount: number;
    pendingVerificationCount: number;
    needsReviewCount: number;
    averageVerificationHours: number | null;
  };
  putAwayActivity: "NOT_CONFIGURED";
  pickingActivity: "NOT_CONFIGURED";
  dispatchReadiness: {
    pendingDispatchCount: number;
    readyForDispatchCount: number;
    loadedCount: number;
    inTransitCount: number;
  };
  warehouseTransfersCount: number;
  totalQuantityTransferred: number;
  stockAdjustmentsCount: number;
  netAdjustmentQuantity: number;
  quarantinedBatchesCount: number;
  quarantinedQuantity: number;
  dayEndReconciliationsCount: number;
  completedReconciliationsCount: number;
  incompleteReconciliationsCount: number;
  dispatchesWithVarianceCount: number;
  reconciliationStatus: "CONFIGURED" | "INCOMPLETE" | "NOT_CONFIGURED";
}

export interface WorkerIntelligenceData {
  totalWorkerAssignments: number;
  totalUniqueCargoHandled: number;
  loadingTasksCount: number;
  unloadingTasksCount: number;
  completedAssignmentsCount: number;
  pendingAssignmentsCount: number;
  recordedWorkDuration: "NOT_CONFIGURED";
  workerOverview: Array<{
    workerName: string;
    assignmentsCount: number;
    loadingCount: number;
    unloadingCount: number;
    totalQuantityHandled: number | "NOT_CONFIGURED";
    totalCompensationEarned: number | null;
  }>;
}

export interface OperationalCostData {
  totalDeliveryExpenses: number | null;
  costPerFulfilledOrder: number | null;
  costPerDeliveredUnit: number | null;
  allocatedDeliveryCostByDealership: Array<{
    dealershipId: string;
    dealershipName: string;
    allocatedAmount: number;
  }>;
  tripExpenseTypeBreakdown: Record<string, number>;
  workerHandlingCostTotal: number | null;
  pendingPrincipalReimbursementClaimsCount: number;
  pendingPrincipalReimbursementAmount: number | null;
  principalReceivableAmount: number | null;
  settledReimbursementAmount: number | null;
}

export interface OperationalRecommendation {
  id: string;
  type: "warning" | "critical" | "info";
  domain: "delivery" | "warehouse" | "cost" | "vehicle" | "claims" | "workers";
  issue: string;
  supportingMetric: string;
  dealershipName?: string;
  suggestedAction: string;
}

export interface OperationalIntelligencePayload {
  filterScope: {
    businessId: string;
    dealershipId?: string;
    principalCompanyId?: string;
    warehouseId?: string;
    vehicleId?: string;
    startDate: Date;
    endDate: Date;
  };
  deliveryPerformance: DeliveryPerformanceData;
  vehicleTripAnalytics: VehicleTripData;
  warehouseOperations: WarehouseOperationsData;
  workerIntelligence: WorkerIntelligenceData;
  operationalCosts: OperationalCostData;
  bottlenecksAndRecommendations: OperationalRecommendation[];
  generatedAt: Date;
}

export interface DeliveryReportStopItem {
  stopSequence: number;
  orderNumber: string;
  customerName: string;
  shopName?: string;
  address?: string;
  status: string;
  deliveredAt?: Date | null;
  failureReason?: string;
  cashCollected: number | null;
}

export interface DeliveryReportTripItem {
  dispatchId: string;
  dispatchNumber: string;
  tripDate: Date;
  status: string;
  vehicleNumber: string;
  deliverymanName: string;
  startedAt: Date | null;
  completedAt: Date | null;
  tripDurationMinutes: number | null;
  dealershipNames: string[];
  totalStops: number;
  fulfilledStops: number;
  partialStops: number;
  failedStops: number;
  rejectedStops: number;
  cancelledStops: number;
  loadedQuantity: number;
  deliveredQuantity: number;
  returnedQuantity: number;
  damagedQuantity: number;
  undeliveredQuantity: number;
  deliveryExpenses: number | null;
  reconciliationDiscrepancy: boolean;
  reconciliationNotes?: string;
  stops: DeliveryReportStopItem[];
}

export interface DeliveryReportPayload {
  reportTitle: string;
  filterScope: {
    businessId: string;
    dealershipId?: string;
    startDate: Date;
    endDate: Date;
  };
  summary: {
    totalTrips: number;
    totalAssignedStops: number;
    eligibleStops: number;
    fulfilledStops: number;
    cancelledStops: number;
    deliverySuccessRate: number;
    totalLoadedQuantity: number;
    totalDeliveredQuantity: number;
    totalReturnedQuantity: number;
    totalUndeliveredQuantity: number;
    totalDeliveryExpenses: number | null;
    totalCashCollected: number | null;
    averageTripDurationMinutes: number | null;
  };
  trips: DeliveryReportTripItem[];
  generatedAt: Date;
}
