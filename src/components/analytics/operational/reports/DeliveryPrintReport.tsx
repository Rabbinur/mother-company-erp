"use client";

import React from "react";
import type { DeliveryReportPayload } from "@/services/analytics/operational/types";
import { ReportHeader } from "./ReportHeader";

interface Props {
  data: DeliveryReportPayload;
  dealershipName?: string;
  startDate?: string;
  endDate?: string;
}

export function DeliveryPrintReport({ data, dealershipName, startDate, endDate }: Props) {
  const { summary, trips } = data;

  const appliedFilters: string[] = [];
  if (dealershipName) appliedFilters.push(`Dealership: ${dealershipName}`);
  if (startDate && endDate) appliedFilters.push(`Period: ${startDate} to ${endDate}`);

  return (
    <div id="printable-delivery-report" className="bg-white dark:bg-card p-6 rounded-xl border border-border shadow-xs print:border-none print:p-0 print:shadow-none">
      <ReportHeader
        title={data.reportTitle}
        subtitle="Detailed log of delivery dispatches, stop outcomes, cargo quantities, and route completion times."
        dealershipName={dealershipName}
        startDate={startDate || data.filterScope.startDate}
        endDate={endDate || data.filterScope.endDate}
        generatedAt={data.generatedAt}
        filtersApplied={appliedFilters}
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 mb-6 break-inside-avoid print:grid-cols-4">
        <div className="p-2.5 rounded-lg border border-slate-300 bg-card print:bg-white">
          <div className="text-[11px] text-muted-foreground">Total Trips / Dispatches</div>
          <div className="text-base font-bold text-foreground mt-0.5">{summary.totalTrips}</div>
          <div className="text-[10px] text-muted-foreground">{summary.averageTripDurationMinutes !== null ? `Avg ${summary.averageTripDurationMinutes}m / trip` : "Duration N/A"}</div>
        </div>

        <div className="p-2.5 rounded-lg border border-slate-300 bg-card print:bg-white">
          <div className="text-[11px] text-muted-foreground">Assigned Stops</div>
          <div className="text-base font-bold text-foreground mt-0.5">{summary.totalAssignedStops}</div>
          <div className="text-[10px] text-muted-foreground">{summary.eligibleStops} eligible, {summary.cancelledStops} cancelled</div>
        </div>

        <div className="p-2.5 rounded-lg border border-slate-300 bg-card print:bg-white">
          <div className="text-[11px] text-muted-foreground">Delivery Success Rate</div>
          <div className="text-base font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">{summary.deliverySuccessRate}%</div>
          <div className="text-[10px] text-muted-foreground">{summary.fulfilledStops} fulfilled of {summary.eligibleStops} eligible</div>
        </div>

        <div className="p-2.5 rounded-lg border border-slate-300 bg-card print:bg-white">
          <div className="text-[11px] text-muted-foreground">Cargo Delivered</div>
          <div className="text-base font-bold text-foreground mt-0.5">{summary.totalDeliveredQuantity.toLocaleString()} u</div>
          <div className="text-[10px] text-muted-foreground">Of {summary.totalLoadedQuantity.toLocaleString()} u loaded</div>
        </div>

        <div className="p-2.5 rounded-lg border border-slate-300 bg-card print:bg-white">
          <div className="text-[11px] text-muted-foreground">Cargo Undelivered / Ret</div>
          <div className="text-base font-bold text-amber-700 dark:text-amber-400 mt-0.5">{(summary.totalReturnedQuantity + summary.totalUndeliveredQuantity).toLocaleString()} u</div>
          <div className="text-[10px] text-muted-foreground">{summary.totalReturnedQuantity} returned, {summary.totalUndeliveredQuantity} undelivered</div>
        </div>

        <div className="p-2.5 rounded-lg border border-slate-300 bg-card print:bg-white">
          <div className="text-[11px] text-muted-foreground">Delivery Expenses</div>
          <div className="text-base font-bold text-foreground mt-0.5">
            {summary.totalDeliveryExpenses !== null ? `৳${summary.totalDeliveryExpenses.toLocaleString()}` : "Restricted"}
          </div>
          <div className="text-[10px] text-muted-foreground">{summary.totalDeliveryExpenses !== null ? "Verified delivery expenses" : "Cost access masked"}</div>
        </div>
      </div>

      {/* Dispatches & Stop Log Table */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 border-b border-slate-300 pb-1.5">
          Dispatches & Stop-Level Delivery Outcomes ({trips.length} Dispatches)
        </h3>

        {trips.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-slate-300 rounded-lg">
            No delivery dispatch records found for the selected date range and filter criteria.
          </div>
        ) : (
          trips.map((t) => (
            <div key={t.dispatchId} className="border border-slate-200 rounded-lg p-3 break-inside-avoid space-y-2 bg-slate-50/50 print:bg-white">
              {/* Trip Metadata Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{t.dispatchNumber}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-800 uppercase">
                    {t.status}
                  </span>
                  {t.reconciliationDiscrepancy && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
                      Reconciliation Discrepancy
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-muted-foreground text-[11px]">
                  <span>Vehicle: <strong className="text-foreground">{t.vehicleNumber}</strong></span>
                  <span>Driver: <strong className="text-foreground">{t.deliverymanName}</strong></span>
                  <span>Duration: <strong className="text-foreground">{t.tripDurationMinutes !== null ? `${t.tripDurationMinutes} mins` : "N/A"}</strong></span>
                  {t.deliveryExpenses !== null && (
                    <span>Expense: <strong className="text-foreground">৳{t.deliveryExpenses.toLocaleString()}</strong></span>
                  )}
                </div>
              </div>

              {/* Cargo Quantities Row */}
              <div className="grid grid-cols-5 gap-2 text-center text-[11px] bg-white dark:bg-card p-1.5 rounded border border-slate-200">
                <div>Loaded: <strong className="text-foreground">{t.loadedQuantity}</strong></div>
                <div>Delivered: <strong className="text-emerald-700">{t.deliveredQuantity}</strong></div>
                <div>Returned: <strong className="text-amber-700">{t.returnedQuantity}</strong></div>
                <div>Damaged: <strong className="text-rose-700">{t.damagedQuantity}</strong></div>
                <div>Undelivered: <strong className="text-slate-700">{t.undeliveredQuantity}</strong></div>
              </div>

              {/* Stops Table */}
              {t.stops.length > 0 && (
                <div className="overflow-x-auto mt-2">
                  <table className="w-full text-[11px] text-left border-collapse border border-slate-200">
                    <thead className="bg-slate-100 text-slate-700 uppercase text-[9px]">
                      <tr>
                        <th className="p-1.5 border border-slate-200">Seq</th>
                        <th className="p-1.5 border border-slate-200">Order #</th>
                        <th className="p-1.5 border border-slate-200">Customer / Shop</th>
                        <th className="p-1.5 border border-slate-200">Destination</th>
                        <th className="p-1.5 border border-slate-200">Outcome</th>
                        <th className="p-1.5 text-right border border-slate-200">Cash Collected</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {t.stops.map((st, sIdx) => (
                        <tr key={sIdx}>
                          <td className="p-1.5 border border-slate-200 text-center font-medium">{st.stopSequence}</td>
                          <td className="p-1.5 border border-slate-200 font-mono">{st.orderNumber}</td>
                          <td className="p-1.5 border border-slate-200">
                            <span className="font-medium">{st.customerName}</span>
                            {st.shopName && <span className="text-muted-foreground block text-[10px]">{st.shopName}</span>}
                          </td>
                          <td className="p-1.5 border border-slate-200 text-muted-foreground truncate max-w-[200px]">{st.address || "N/A"}</td>
                          <td className="p-1.5 border border-slate-200">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${st.status === "delivered" ? "bg-emerald-50 text-emerald-800" : st.status === "cancelled" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-800"}`}>
                              {st.status}
                            </span>
                          </td>
                          <td className="p-1.5 text-right border border-slate-200 font-medium">
                            {st.cashCollected !== null ? `৳${st.cashCollected.toLocaleString()}` : <span className="text-muted-foreground italic">Masked</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
