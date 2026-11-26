"use client";

import React from "react";
import { Truck, Navigation, Warehouse, Users, DollarSign, AlertCircle } from "lucide-react";
import type { OperationalIntelligencePayload } from "@/services/analytics/operational/types";

interface Props {
  data: OperationalIntelligencePayload;
}

export function OperationalOverviewCards({ data }: Props) {
  const {
    deliveryPerformance: del,
    vehicleTripAnalytics: trip,
    warehouseOperations: wh,
    workerIntelligence: wrk,
    operationalCosts: cost,
  } = data;

  const cards = [
    {
      title: "Delivery Success Rate",
      value: `${del.deliverySuccessRatePercentage}%`,
      sub: `${del.fulfilledDeliveriesCount} of ${del.totalOrdersAssigned} assigned stops`,
      icon: Truck,
      color: del.deliverySuccessRatePercentage >= 85 ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" : "text-amber-600 bg-amber-50 dark:bg-amber-950/40",
    },
    {
      title: "Active Fleet Trips",
      value: trip.totalTrips.toString(),
      sub: `Avg ${trip.averageStopsPerTrip} stops / ${trip.averageDeliveredQtyPerTrip} units per trip`,
      icon: Navigation,
      color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40",
    },
    {
      title: "Inbound GRN Verification",
      value: `${wh.grnReceiving.verifiedGrnsCount} / ${wh.grnReceiving.totalGrnsReceived}`,
      sub: `${wh.grnReceiving.pendingVerificationCount} pending, ${wh.grnReceiving.needsReviewCount} review needed`,
      icon: Warehouse,
      color: wh.grnReceiving.needsReviewCount > 0 ? "text-amber-600 bg-amber-50 dark:bg-amber-950/40" : "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40",
    },
    {
      title: "Worker Operations",
      value: wrk.totalWorkerAssignments.toString(),
      sub: `${wrk.loadingTasksCount} loading, ${wrk.unloadingTasksCount} unloading`,
      icon: Users,
      color: "text-purple-600 bg-purple-50 dark:bg-purple-950/40",
    },
    {
      title: "Delivery Cost / Fulfillment",
      value: cost.costPerFulfilledOrder !== null ? `৳${cost.costPerFulfilledOrder.toLocaleString()}` : "Restricted",
      sub: cost.totalDeliveryExpenses !== null ? `Total ৳${cost.totalDeliveryExpenses.toLocaleString()}` : "Cost access masked",
      icon: DollarSign,
      color: "text-teal-600 bg-teal-50 dark:bg-teal-950/40",
    },
    {
      title: "Operational Discrepancies",
      value: (wh.dispatchesWithVarianceCount + del.rejectedDeliveriesCount).toString(),
      sub: `${wh.dispatchesWithVarianceCount} recon variance, ${del.rejectedDeliveriesCount} rejections`,
      icon: AlertCircle,
      color: (wh.dispatchesWithVarianceCount + del.rejectedDeliveriesCount) > 0 ? "text-rose-600 bg-rose-50 dark:bg-rose-950/40" : "text-slate-600 bg-slate-50 dark:bg-slate-900/40",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div
            key={i}
            className="p-4 rounded-xl border border-border bg-card shadow-xs flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{c.title}</span>
              <div className={`p-2 rounded-lg ${c.color}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold tracking-tight text-foreground">{c.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{c.sub}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
