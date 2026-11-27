"use client";

import React from "react";
import type { OperationalIntelligencePayload } from "@/services/analytics/operational/types";
import { ReportHeader } from "./ReportHeader";
import { CompactReportKpis } from "./CompactReportKpis";

interface Props {
  data: OperationalIntelligencePayload;
  dealershipName?: string;
  startDate?: string;
  endDate?: string;
}

export function GeneralOperationalReport({ data, dealershipName, startDate, endDate }: Props) {
  const {
    deliveryPerformance: del,
    vehicleTripAnalytics: trip,
    warehouseOperations: wh,
    workerIntelligence: wrk,
    operationalCosts: cost,
    bottlenecksAndRecommendations: recs,
  } = data;

  const appliedFilters: string[] = [];
  if (dealershipName) appliedFilters.push(`Dealership: ${dealershipName}`);
  if (startDate && endDate) appliedFilters.push(`Period: ${startDate} to ${endDate}`);

  return (
    <div id="printable-general-report" className="bg-white dark:bg-card p-6 rounded-xl border border-border shadow-xs print:border-none print:p-0 print:shadow-none">
      <ReportHeader
        title="General Operational Intelligence Report"
        subtitle="Consolidated physical logistics, warehouse flow, fleet trips, and verified operational costs."
        dealershipName={dealershipName}
        startDate={startDate || data.filterScope.startDate}
        endDate={endDate || data.filterScope.endDate}
        generatedAt={data.generatedAt}
        filtersApplied={appliedFilters}
      />

      <CompactReportKpis data={data} />

      {/* 1. Delivery Performance Summary */}
      <div className="mb-6 break-inside-avoid">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 border-b border-slate-300 pb-1.5 mb-2.5">
          1. Delivery Performance & Fulfillment Summary
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse border border-slate-200">
            <thead className="bg-slate-100 text-slate-700 uppercase text-[10px]">
              <tr>
                <th className="p-2 border border-slate-200">Staff / Dealership</th>
                <th className="p-2 text-right border border-slate-200">Assigned</th>
                <th className="p-2 text-right border border-slate-200">Eligible</th>
                <th className="p-2 text-right border border-slate-200">Delivered</th>
                <th className="p-2 text-right border border-slate-200">Cancelled</th>
                <th className="p-2 text-right border border-slate-200">Success Rate</th>
                <th className="p-2 text-right border border-slate-200">Avg Trip Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {del.deliverymanPerformance.slice(0, 10).map((dm) => (
                <tr key={dm.deliverymanId}>
                  <td className="p-2 font-medium border border-slate-200">{dm.deliverymanName}</td>
                  <td className="p-2 text-right border border-slate-200">{dm.assignedStops}</td>
                  <td className="p-2 text-right border border-slate-200">{dm.eligibleStops}</td>
                  <td className="p-2 text-right font-medium text-emerald-700 border border-slate-200">{dm.deliveredStops}</td>
                  <td className="p-2 text-right text-slate-500 border border-slate-200">{dm.cancelledStops}</td>
                  <td className="p-2 text-right font-bold border border-slate-200">{dm.successRate}%</td>
                  <td className="p-2 text-right border border-slate-200">{dm.avgCompletionHours !== null ? `${dm.avgCompletionHours}h` : "N/A"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Warehouse Operations & Reconciliation Summary */}
      <div className="mb-6 break-inside-avoid">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 border-b border-slate-300 pb-1.5 mb-2.5">
          2. Warehouse Operations & Day-End Reconciliation Evidence
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-3">
          <div className="p-2 bg-slate-50 border border-slate-200 rounded">
            <span className="text-muted-foreground block text-[10px]">Inbound GRNs:</span>
            <span className="font-bold">{wh.grnReceiving.verifiedGrnsCount} verified of {wh.grnReceiving.totalGrnsReceived}</span>
          </div>
          <div className="p-2 bg-slate-50 border border-slate-200 rounded">
            <span className="text-muted-foreground block text-[10px]">Avg GRN Verification:</span>
            <span className="font-bold">{wh.grnReceiving.averageVerificationHours !== null ? `${wh.grnReceiving.averageVerificationHours}h` : "N/A"}</span>
          </div>
          <div className="p-2 bg-slate-50 border border-slate-200 rounded">
            <span className="text-muted-foreground block text-[10px]">Reconciliation Status:</span>
            <span className="font-bold">{wh.reconciliationStatus}</span>
          </div>
          <div className="p-2 bg-slate-50 border border-slate-200 rounded">
            <span className="text-muted-foreground block text-[10px]">Confirmed Variances:</span>
            <span className="font-bold text-rose-600">{wh.dispatchesWithVarianceCount} Dispatches</span>
          </div>
        </div>
      </div>

      {/* 3. Operational Costs Summary (Masked if Unauthorized) */}
      <div className="mb-6 break-inside-avoid">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 border-b border-slate-300 pb-1.5 mb-2.5">
          3. Operational Logistics Cost Summary
        </h3>
        {cost.totalDeliveryExpenses !== null ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2 bg-slate-50 border border-slate-200 rounded">
              <span className="text-muted-foreground block text-[10px]">Total Delivery Expenses:</span>
              <span className="font-bold">৳{cost.totalDeliveryExpenses.toLocaleString()}</span>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded">
              <span className="text-muted-foreground block text-[10px]">Cost / Fulfilled Order:</span>
              <span className="font-bold">৳{cost.costPerFulfilledOrder?.toLocaleString()}</span>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded">
              <span className="text-muted-foreground block text-[10px]">Worker Handling Compensation:</span>
              <span className="font-bold">৳{cost.workerHandlingCostTotal?.toLocaleString()}</span>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded">
              <span className="text-muted-foreground block text-[10px]">Principal Receivable:</span>
              <span className="font-bold text-blue-700">৳{cost.principalReceivableAmount?.toLocaleString()}</span>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-slate-50 border border-dashed border-slate-300 text-xs text-muted-foreground italic rounded">
            Operational cost data is restricted for the current user role.
          </div>
        )}
      </div>

      {/* 4. Bottlenecks & Recommendations */}
      {recs.length > 0 && (
        <div className="break-inside-avoid">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 border-b border-slate-300 pb-1.5 mb-2.5">
            4. Operational Observations & Recommendations
          </h3>
          <ul className="space-y-1.5 text-xs">
            {recs.map((r) => (
              <li key={r.id} className="p-2 bg-slate-50 border border-slate-200 rounded flex items-start justify-between gap-2">
                <div>
                  <span className="font-semibold text-slate-800">{r.issue}:</span>{" "}
                  <span className="text-slate-600">{r.suggestedAction}</span>
                </div>
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 shrink-0">
                  {r.domain}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
