"use client";

import React from "react";
import { Award, CheckCircle, XCircle, DollarSign, UserCheck } from "lucide-react";
import { SalesmanPerformanceItem } from "@/services/analytics/types";
import { formatCurrency } from "@/lib/utils";

interface SalesmanPerformanceTabProps {
  salesmen: SalesmanPerformanceItem[];
  topPerformers: SalesmanPerformanceItem[];
}

export function SalesmanPerformanceTab({
  salesmen,
  topPerformers,
}: SalesmanPerformanceTabProps) {
  return (
    <div className="space-y-6">
      {/* Top 3 Performers Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {topPerformers.slice(0, 3).map((sp, idx) => (
          <div key={sp.salesmanId} className="rounded-xl border border-sky-100 bg-sky-50/40 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary">
                <Award className="h-3.5 w-3.5" />
                Rank #{idx + 1}
              </span>
              <span className="text-xs font-semibold text-slate-500">{sp.dealershipName || "Central"}</span>
            </div>
            <h4 className="mt-2 text-sm font-bold text-slate-900">{sp.salesmanName}</h4>
            <p className="text-[11px] text-slate-400">{sp.email}</p>
            <div className="mt-3 flex items-center justify-between border-t border-sky-100 pt-2 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block">Fulfilled Sales</span>
                <span className="font-bold text-slate-900">{formatCurrency(sp.fulfilledSalesAmount)}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">Collections</span>
                <span className="font-bold text-emerald-600">{formatCurrency(sp.collectedAmount)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Full Sales Staff Performance Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-slate-900">Sales Staff Performance & Fulfillment Ratios</h3>
          </div>
          <span className="text-xs text-slate-400">Ranked by composite fulfillment & collection score</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-y border-slate-200">
              <tr>
                <th className="py-2 px-2.5 text-center">Rank</th>
                <th className="py-2 px-2.5">Sales Representative</th>
                <th className="py-2 px-2.5 text-center">Booked</th>
                <th className="py-2 px-2.5 text-center">Fulfilled</th>
                <th className="py-2 px-2.5 text-right">Fulfilled Value</th>
                <th className="py-2 px-2.5 text-center">Cancel %</th>
                <th className="py-2 px-2.5 text-right">Collected Amount</th>
                <th className="py-2 px-2.5 text-right">Efficiency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {salesmen.length > 0 ? (
                salesmen.map((s) => (
                  <tr key={s.salesmanId} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-2.5 text-center font-bold text-primary">#{s.performanceRank}</td>
                    <td className="py-2.5 px-2.5">
                      <div className="font-semibold text-slate-800">{s.salesmanName}</div>
                      <div className="text-[10px] text-slate-400">{s.dealershipName || "Head Office"}</div>
                    </td>
                    <td className="py-2.5 px-2.5 text-center font-medium text-slate-700">{s.bookedOrdersCount}</td>
                    <td className="py-2.5 px-2.5 text-center font-bold text-emerald-600">{s.fulfilledOrdersCount}</td>
                    <td className="py-2.5 px-2.5 text-right font-bold text-slate-900">{formatCurrency(s.fulfilledSalesAmount)}</td>
                    <td className="py-2.5 px-2.5 text-center">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        s.cancellationRatePercentage > 15 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"
                      }`}>
                        {s.cancellationRatePercentage.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-semibold text-emerald-600">{formatCurrency(s.collectedAmount)}</td>
                    <td className="py-2.5 px-2.5 text-right font-bold text-slate-800">{s.collectionEfficiencyPercentage.toFixed(0)}%</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No sales representative records found in this period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
