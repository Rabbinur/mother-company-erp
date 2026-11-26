"use client";

import React from "react";
import { Users, AlertTriangle, ShieldCheck, Clock } from "lucide-react";
import { CustomerSegmentItem } from "@/services/analytics/types";
import { formatCurrency, formatShortDate } from "@/lib/utils";

interface CustomerIntelligenceTabProps {
  customers: CustomerSegmentItem[];
  segmentCounts: Record<string, number>;
  inactiveCustomers: CustomerSegmentItem[];
  highCreditRisk: CustomerSegmentItem[];
}

export function CustomerIntelligenceTab({
  customers,
  segmentCounts,
  inactiveCustomers,
  highCreditRisk,
}: CustomerIntelligenceTabProps) {
  const getBadgeClass = (segment: string) => {
    switch (segment) {
      case "VIP":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "REGULAR":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "OCCASIONAL":
        return "bg-sky-100 text-sky-700 border-sky-200";
      case "AT_RISK":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "INACTIVE":
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Segment Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-purple-700 uppercase">VIP Retailers</span>
          <p className="mt-1 text-xl font-bold text-purple-900">{segmentCounts.VIP || 0}</p>
          <span className="text-[10px] text-purple-600">Top volume buyers</span>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-emerald-700 uppercase">Regular</span>
          <p className="mt-1 text-xl font-bold text-emerald-900">{segmentCounts.REGULAR || 0}</p>
          <span className="text-[10px] text-emerald-600">Repeat active buyers</span>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-sky-700 uppercase">Occasional</span>
          <p className="mt-1 text-xl font-bold text-sky-900">{segmentCounts.OCCASIONAL || 0}</p>
          <span className="text-[10px] text-sky-600">1-2 orders in period</span>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-amber-700 uppercase">At Risk</span>
          <p className="mt-1 text-xl font-bold text-amber-900">{segmentCounts.AT_RISK || 0}</p>
          <span className="text-[10px] text-amber-600">45+ days without order</span>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-rose-700 uppercase">Inactive</span>
          <p className="mt-1 text-xl font-bold text-rose-900">{segmentCounts.INACTIVE || 0}</p>
          <span className="text-[10px] text-rose-600">60+ days dormant</span>
        </div>
      </div>

      {/* Customer Segmentation & Risk Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">Customer RFM & Credit Utilization</h3>
          </div>
          <span className="text-xs text-slate-400">{customers.length} retailers evaluated</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-y border-slate-200">
              <tr>
                <th className="py-2 px-2.5">Retailer / Shop</th>
                <th className="py-2 px-2.5 text-center">Segment</th>
                <th className="py-2 px-2.5 text-center">Orders</th>
                <th className="py-2 px-2.5 text-right">Total Net Spent</th>
                <th className="py-2 px-2.5 text-right">Avg Order</th>
                <th className="py-2 px-2.5 text-center">Recency</th>
                <th className="py-2 px-2.5 text-right">Outstanding (AR)</th>
                <th className="py-2 px-2.5 text-right">Credit Util %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.length > 0 ? (
                customers.map((c) => (
                  <tr key={c.customerId} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-2.5">
                      <div className="font-semibold text-slate-800">{c.shopName}</div>
                      <div className="text-[10px] text-slate-400">{c.customerName} • {c.phone}</div>
                    </td>
                    <td className="py-2.5 px-2.5 text-center">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold border ${getBadgeClass(c.segment)}`}>
                        {c.segment}
                      </span>
                    </td>
                    <td className="py-2.5 px-2.5 text-center font-medium text-slate-800">{c.ordersCount}</td>
                    <td className="py-2.5 px-2.5 text-right font-bold text-slate-900">{formatCurrency(c.totalSpent)}</td>
                    <td className="py-2.5 px-2.5 text-right font-medium text-slate-700">{formatCurrency(c.averageOrderValue)}</td>
                    <td className="py-2.5 px-2.5 text-center text-slate-600">
                      {c.daysSinceLastOrder < 999 ? `${c.daysSinceLastOrder}d ago` : "Never"}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-semibold text-amber-600">
                      {formatCurrency(c.outstandingBalance)}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-bold">
                      {c.creditUtilizationPercentage !== null ? (
                        <span className={c.creditUtilizationPercentage > 90 ? "text-rose-600" : "text-slate-700"}>
                          {c.creditUtilizationPercentage.toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">N/A</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No customer behavioral records found
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
