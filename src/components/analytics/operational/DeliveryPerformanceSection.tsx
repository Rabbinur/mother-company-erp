"use client";

import React from "react";
import { CheckCircle2, Clock, AlertTriangle, XCircle, Info, Truck } from "lucide-react";
import type { DeliveryPerformanceData } from "@/services/analytics/operational/types";

interface Props {
  data: DeliveryPerformanceData;
}

export function DeliveryPerformanceSection({ data }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Truck className="w-4 h-4 text-primary" /> Delivery Performance Intelligence
          </h3>
          <p className="text-xs text-muted-foreground">
            Fulfillment outcomes, stop success rates, and delivery team productivity based on verified records.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-full bg-muted border border-border font-medium text-muted-foreground flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            Promised Deadline: <span className="font-semibold text-foreground">{data.promisedDeadlineCompliance}</span>
          </span>
        </div>
      </div>

      {/* Outcome Breakdown & Volume Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Fulfilled Stops
          </div>
          <div className="text-lg font-bold text-foreground mt-1">{data.fulfilledDeliveriesCount}</div>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Partially Fulfilled
          </div>
          <div className="text-lg font-bold text-foreground mt-1">{data.partiallyFulfilledCount}</div>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-blue-500" /> Pending Stops
          </div>
          <div className="text-lg font-bold text-foreground mt-1">{data.pendingDeliveriesCount}</div>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5 text-rose-500" /> Failed Stops
          </div>
          <div className="text-lg font-bold text-foreground mt-1">{data.failedDeliveriesCount}</div>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5 text-purple-500" /> Customer Rejections
          </div>
          <div className="text-lg font-bold text-foreground mt-1">{data.rejectedDeliveriesCount}</div>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-indigo-500" /> Avg Trip Duration
          </div>
          <div className="text-lg font-bold text-foreground mt-1">
            {data.averageDeliveryCompletionHours !== null ? `${data.averageDeliveryCompletionHours}h` : "N/A"}
          </div>
        </div>
      </div>

      {/* Cargo Quantities */}
      <div className="p-4 rounded-xl border border-border bg-card">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Physical Cargo Volume Distribution (Units)
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
          <div>
            <div className="text-xl font-bold text-foreground">{data.totalLoadedQuantity.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Loaded</div>
          </div>
          <div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{data.totalDeliveredQuantity.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Delivered</div>
          </div>
          <div>
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{data.totalReturnedQuantity.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Returned</div>
          </div>
          <div>
            <div className="text-xl font-bold text-rose-600 dark:text-rose-400">{data.totalDamagedQuantity.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Damaged</div>
          </div>
          <div>
            <div className="text-xl font-bold text-slate-600 dark:text-slate-400">{data.totalUndeliveredQuantity.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Undelivered</div>
          </div>
        </div>
      </div>

      {/* Tables: Deliveryman and Dealership */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Deliveryman Performance */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-3 border-b border-border bg-muted/40 font-semibold text-xs text-foreground">
            Delivery Staff Performance
          </div>
          <div className="overflow-x-auto max-h-64">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/20 text-muted-foreground uppercase text-[10px]">
                <tr>
                  <th className="p-2.5">Staff</th>
                  <th className="p-2.5 text-right">Assigned</th>
                  <th className="p-2.5 text-right">Delivered</th>
                  <th className="p-2.5 text-right">Success</th>
                  <th className="p-2.5 text-right">Avg Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.deliverymanPerformance.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-muted-foreground">No delivery records found</td>
                  </tr>
                ) : (
                  data.deliverymanPerformance.map((dm) => (
                    <tr key={dm.deliverymanId} className="hover:bg-muted/30">
                      <td className="p-2.5 font-medium text-foreground">{dm.deliverymanName}</td>
                      <td className="p-2.5 text-right">{dm.assignedStops}</td>
                      <td className="p-2.5 text-right text-emerald-600 font-medium">{dm.deliveredStops}</td>
                      <td className="p-2.5 text-right">
                        <span className={`px-1.5 py-0.5 rounded font-semibold ${dm.successRate >= 85 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"}`}>
                          {dm.successRate}%
                        </span>
                      </td>
                      <td className="p-2.5 text-right text-muted-foreground">
                        {dm.avgCompletionHours !== null ? `${dm.avgCompletionHours}h` : "N/A"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dealership Delivery Performance */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-3 border-b border-border bg-muted/40 font-semibold text-xs text-foreground">
            Dealership-wise Delivery Performance
          </div>
          <div className="overflow-x-auto max-h-64">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/20 text-muted-foreground uppercase text-[10px]">
                <tr>
                  <th className="p-2.5">Dealership</th>
                  <th className="p-2.5 text-right">Stops</th>
                  <th className="p-2.5 text-right">Delivered</th>
                  <th className="p-2.5 text-right">Returned Qty</th>
                  <th className="p-2.5 text-right">Success Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.dealershipPerformance.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-muted-foreground">No dealership records found</td>
                  </tr>
                ) : (
                  data.dealershipPerformance.map((dp) => (
                    <tr key={dp.dealershipId} className="hover:bg-muted/30">
                      <td className="p-2.5 font-medium text-foreground">{dp.dealershipName}</td>
                      <td className="p-2.5 text-right">{dp.assignedStops}</td>
                      <td className="p-2.5 text-right text-emerald-600 font-medium">{dp.deliveredStops}</td>
                      <td className="p-2.5 text-right text-amber-600">{dp.returnedQuantity}</td>
                      <td className="p-2.5 text-right">
                        <span className={`px-1.5 py-0.5 rounded font-semibold ${dp.successRate >= 85 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"}`}>
                          {dp.successRate}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
