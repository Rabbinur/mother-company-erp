"use client";

import React from "react";
import { AlertCircle, ShoppingCart, Info, TrendingUp } from "lucide-react";
import { DemandForecastItem } from "@/services/analytics/types";

interface DemandForecastTabProps {
  forecasts: DemandForecastItem[];
  reorderAlerts: DemandForecastItem[];
}

export function DemandForecastTab({
  forecasts,
  reorderAlerts,
}: DemandForecastTabProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "CRITICAL":
        return "bg-rose-100 text-rose-700 border-rose-200";
      case "LOW":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "OVERSTOCKED":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "ADEQUATE":
      default:
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Statistical Estimate Notice Banner */}
      <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4 shadow-2xs">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-xs text-slate-700 space-y-1">
            <p className="font-bold text-slate-900">
              Statistical Run-Rate Estimation Policy
            </p>
            <p>
              Reorder recommendations are statistical estimates based on historical daily velocity and lead times.
              In accordance with safety and procurement governance, automatic purchase orders are strictly prohibited.
              Procurement officers must review and confirm before generating purchase requisitions.
            </p>
          </div>
        </div>
      </div>

      {/* Reorder Alerts & Demand Trends Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-slate-900">Demand Run-Rate & Reorder Radar</h3>
          </div>
          <span className="text-xs font-semibold text-rose-600">
            {reorderAlerts.length} items require replenishment
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-y border-slate-200">
              <tr>
                <th className="py-2 px-2.5">Product & SKU</th>
                <th className="py-2 px-2.5 text-center">Period Sold</th>
                <th className="py-2 px-2.5 text-center">Daily Velocity</th>
                <th className="py-2 px-2.5 text-center">30d Projected</th>
                <th className="py-2 px-2.5 text-center">Available Stock</th>
                <th className="py-2 px-2.5 text-center">Days of Supply</th>
                <th className="py-2 px-2.5 text-center">Stock Health</th>
                <th className="py-2 px-2.5 text-right font-bold text-primary">Suggested Reorder</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {forecasts.length > 0 ? (
                forecasts.map((f) => (
                  <tr key={f.productId} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-2.5">
                      <div className="font-semibold text-slate-800">{f.productName}</div>
                      <div className="text-[10px] text-slate-400">{f.sku}</div>
                    </td>
                    <td className="py-2.5 px-2.5 text-center font-medium text-slate-700">{f.historicalUnitsSold}</td>
                    <td className="py-2.5 px-2.5 text-center font-semibold text-slate-800">{f.dailyRunRate.toFixed(2)} /d</td>
                    <td className="py-2.5 px-2.5 text-center text-slate-600">{f.projected30DayDemand}</td>
                    <td className="py-2.5 px-2.5 text-center font-bold text-slate-900">{f.currentAvailableStock}</td>
                    <td className="py-2.5 px-2.5 text-center">
                      <span className={`font-semibold ${f.daysOfSupply <= 7 ? "text-rose-600" : "text-slate-700"}`}>
                        {f.daysOfSupply < 999 ? `${f.daysOfSupply} days` : "∞"}
                      </span>
                    </td>
                    <td className="py-2.5 px-2.5 text-center">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold border ${getStatusBadge(f.stockStatus)}`}>
                        {f.stockStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-bold">
                      {f.suggestedReorderQuantity > 0 ? (
                        <span className="text-rose-600 font-extrabold text-sm">
                          +{f.suggestedReorderQuantity} units
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-medium">Adequate</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No forecast data available for active products
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
