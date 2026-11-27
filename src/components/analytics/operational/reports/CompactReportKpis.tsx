"use client";

import React from "react";
import type { OperationalIntelligencePayload } from "@/services/analytics/operational/types";

interface Props {
  data: OperationalIntelligencePayload;
}

export function CompactReportKpis({ data }: Props) {
  const {
    deliveryPerformance: del,
    vehicleTripAnalytics: trip,
    warehouseOperations: wh,
    operationalCosts: cost,
  } = data;

  const kpis = [
    { label: "Assigned Stops", value: del.totalOrdersAssigned.toString(), sub: `${del.eligibleOrdersAssigned} eligible, ${del.cancelledDeliveriesCount} cancelled` },
    { label: "Fulfilled Deliveries", value: del.fulfilledDeliveriesCount.toString(), sub: `${del.partiallyFulfilledCount} partial, ${del.pendingDeliveriesCount} pending` },
    { label: "Delivery Success Rate", value: `${del.deliverySuccessRatePercentage}%`, sub: `Against eligible assigned stops` },
    { label: "Rejections / Failed", value: `${del.rejectedDeliveriesCount} / ${del.failedDeliveriesCount}`, sub: "Customer rejected / drop failed" },
    { label: "Active Fleet Trips", value: trip.totalTrips.toString(), sub: `Avg ${trip.averageStopsPerTrip} stops / trip` },
    { label: "Delivered Quantity", value: `${del.totalDeliveredQuantity.toLocaleString()} u`, sub: `Of ${del.totalLoadedQuantity.toLocaleString()} loaded` },
    { label: "Returned / Undelivered", value: `${(del.totalReturnedQuantity + del.totalUndeliveredQuantity).toLocaleString()} u`, sub: `${del.totalReturnedQuantity} returned, ${del.totalUndeliveredQuantity} undelivered` },
    { label: "Inbound Verified GRNs", value: `${wh.grnReceiving.verifiedGrnsCount} / ${wh.grnReceiving.totalGrnsReceived}`, sub: `${wh.grnReceiving.pendingVerificationCount} pending, ${wh.grnReceiving.needsReviewCount} review` },
    { label: "Stock / Recon Variance", value: wh.dispatchesWithVarianceCount.toString(), sub: `Status: ${wh.reconciliationStatus}` },
    {
      label: "Operational Expenses",
      value: cost.totalDeliveryExpenses !== null ? `৳${cost.totalDeliveryExpenses.toLocaleString()}` : "Restricted",
      sub: cost.totalDeliveryExpenses !== null ? "Verified delivery expenses" : "Cost data masked",
    },
    {
      label: "Cost / Fulfilled Order",
      value: cost.costPerFulfilledOrder !== null ? `৳${cost.costPerFulfilledOrder.toLocaleString()}` : "Restricted",
      sub: cost.costPerFulfilledOrder !== null ? `৳${cost.costPerDeliveredUnit || 0} / delivered unit` : "Cost access masked",
    },
    {
      label: "Pending Principal Claims",
      value: cost.pendingPrincipalReimbursementAmount !== null ? `৳${cost.pendingPrincipalReimbursementAmount.toLocaleString()}` : `${cost.pendingPrincipalReimbursementClaimsCount} Claims`,
      sub: `${cost.pendingPrincipalReimbursementClaimsCount} pending claims`,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-6 break-inside-avoid print:grid-cols-4">
      {kpis.map((k, i) => (
        <div
          key={i}
          className="p-2.5 rounded-lg border border-slate-300 dark:border-border bg-card shadow-2xs break-inside-avoid print:border-slate-400 print:bg-white"
        >
          <div className="text-[11px] font-medium text-muted-foreground truncate">{k.label}</div>
          <div className="text-base font-bold text-foreground mt-0.5 tracking-tight truncate">{k.value}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{k.sub}</div>
        </div>
      ))}
    </div>
  );
}
