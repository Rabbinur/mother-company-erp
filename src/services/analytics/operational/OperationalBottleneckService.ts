import type {
  DeliveryPerformanceData,
  WarehouseOperationsData,
  OperationalCostData,
  OperationalRecommendation,
} from "./types";

export class OperationalBottleneckService {
  static generateRecommendations(params: {
    delivery: DeliveryPerformanceData;
    warehouse: WarehouseOperationsData;
    costs: OperationalCostData;
  }): OperationalRecommendation[] {
    const recommendations: OperationalRecommendation[] = [];
    let recId = 1;

    // 1. Delivery Success Rate Bottleneck
    if (
      params.delivery.totalOrdersAssigned >= 5 &&
      params.delivery.deliverySuccessRatePercentage < 85
    ) {
      recommendations.push({
        id: `rec-del-${recId++}`,
        type: params.delivery.deliverySuccessRatePercentage < 70 ? "critical" : "warning",
        domain: "delivery",
        issue: `Suboptimal delivery fulfillment rate (${params.delivery.deliverySuccessRatePercentage}%)`,
        supportingMetric: `${params.delivery.fulfilledDeliveriesCount} fulfilled of ${params.delivery.eligibleOrdersAssigned} eligible stops`,
        suggestedAction: "Audit frequent delivery failures and route stop sequences to reduce unfulfilled drops.",
      });
    }

    // 2. High Return / Undelivered Volume
    if (params.delivery.totalLoadedQuantity > 0) {
      const uncompletedQty = params.delivery.totalReturnedQuantity + params.delivery.totalUndeliveredQuantity;
      const uncompletedRate = (uncompletedQty / params.delivery.totalLoadedQuantity) * 100;
      if (uncompletedRate >= 5) {
        recommendations.push({
          id: `rec-del-${recId++}`,
          type: "warning",
          domain: "delivery",
          issue: `High return/undelivered quantity (${uncompletedRate.toFixed(1)}% of loaded volume)`,
          supportingMetric: `${uncompletedQty} units returned or undelivered out of ${params.delivery.totalLoadedQuantity} units loaded`,
          suggestedAction: "Investigate return reasons and verify customer availability prior to dispatch dispatching.",
        });
      }
    }

    // 3. Rejected Deliveries Warning
    if (params.delivery.rejectedDeliveriesCount > 0) {
      recommendations.push({
        id: `rec-del-${recId++}`,
        type: "warning",
        domain: "delivery",
        issue: "Customer rejections detected at delivery stops",
        supportingMetric: `${params.delivery.rejectedDeliveriesCount} stops rejected by customers`,
        suggestedAction: "Check invoice discrepancy and item condition before trip departures.",
      });
    }

    // 4. Warehouse GRN Verification Backlog
    const pendingGrns = params.warehouse.grnReceiving.pendingVerificationCount;
    const reviewGrns = params.warehouse.grnReceiving.needsReviewCount;
    if (pendingGrns > 3 || reviewGrns > 0) {
      recommendations.push({
        id: `rec-wh-${recId++}`,
        type: reviewGrns > 0 ? "warning" : "info",
        domain: "warehouse",
        issue: "Pending GRN verification queue requires attention",
        supportingMetric: `${pendingGrns} pending verification, ${reviewGrns} flagged for review`,
        suggestedAction: "Review and verify inbound challans to release stock into active warehouse inventory.",
      });
    }

    // 5. Stock Discrepancy / Reconciliation Variance
    if (params.warehouse.dispatchesWithVarianceCount > 0) {
      recommendations.push({
        id: `rec-wh-${recId++}`,
        type: "critical",
        domain: "warehouse",
        issue: "Day-end dispatch reconciliation variance detected",
        supportingMetric: `${params.warehouse.dispatchesWithVarianceCount} dispatches recorded stock or cash variances`,
        suggestedAction: "Perform immediate physical gate-check audit for affected delivery trips.",
      });
    }

    // 6. Quarantined Batches Notice
    if (params.warehouse.quarantinedBatchesCount > 0) {
      recommendations.push({
        id: `rec-wh-${recId++}`,
        type: "info",
        domain: "warehouse",
        issue: "Quarantined stock batches waiting for disposition",
        supportingMetric: `${params.warehouse.quarantinedBatchesCount} batches (${params.warehouse.quarantinedQuantity} units) quarantined`,
        suggestedAction: "Initiate supplier returns or write-off protocols for damaged or non-conforming items.",
      });
    }

    // 7. Pending Principal Claims Alert
    if (
      params.costs.pendingPrincipalReimbursementClaimsCount >= 2 &&
      params.costs.pendingPrincipalReimbursementAmount &&
      params.costs.pendingPrincipalReimbursementAmount > 0
    ) {
      recommendations.push({
        id: `rec-cost-${recId++}`,
        type: "info",
        domain: "claims",
        issue: "Outstanding principal reimbursement claims awaiting settlement",
        supportingMetric: `${params.costs.pendingPrincipalReimbursementClaimsCount} claims pending totaling ৳${params.costs.pendingPrincipalReimbursementAmount.toLocaleString()}`,
        suggestedAction: "Follow up with principal brand accounts to expedite claim settlement and cash inflow.",
      });
    }

    return recommendations;
  }
}
