"use client";

import React from "react";
import { Truck, AlertTriangle, TrendingUp, Building } from "lucide-react";
import { SupplierIntelligenceItem } from "@/services/analytics/types";
import { formatCurrency, formatShortDate } from "@/lib/utils";

interface SupplierIntelligenceTabProps {
  suppliers: SupplierIntelligenceItem[];
  principalComparisons: Array<{
    principalCompanyId: string;
    principalCompanyName: string;
    totalValue: number;
    totalQuantity: number;
    shortageRate: number;
  }>;
  canViewCosts: boolean;
}

export function SupplierIntelligenceTab({
  suppliers,
  principalComparisons,
  canViewCosts,
}: SupplierIntelligenceTabProps) {
  return (
    <div className="space-y-6">
      {/* Principal Companies Summary Bar */}
      {principalComparisons.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {principalComparisons.map((pc) => (
            <div key={pc.principalCompanyId} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <Building className="h-4 w-4 text-primary" />
                <span>{pc.principalCompanyName}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">Total Purchased</span>
                  <span className="font-bold text-slate-900">{canViewCosts ? formatCurrency(pc.totalValue) : "Confidential"}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Shortage Rate</span>
                  <span className="font-bold text-amber-600">
                    {pc.shortageRate !== null ? `${pc.shortageRate.toFixed(1)}%` : "N/A"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Supplier Performance Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-slate-900">Supplier Delivery Reliability & Returns</h3>
          </div>
          <span className="text-xs text-slate-400">{suppliers.length} vendors evaluated</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-y border-slate-200">
              <tr>
                <th className="py-2 px-2.5">Supplier / Vendor</th>
                <th className="py-2 px-2.5 text-center">GRNs</th>
                <th className="py-2 px-2.5 text-right">Units Received</th>
                <th className="py-2 px-2.5 text-right">{canViewCosts ? "Purchased Value" : ""}</th>
                <th className="py-2 px-2.5 text-right">Shortage Qty</th>
                <th className="py-2 px-2.5 text-center">Shortage %</th>
                <th className="py-2 px-2.5 text-center">Returns</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {suppliers.length > 0 ? (
                suppliers.map((s) => (
                  <tr key={s.vendorId} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-2.5">
                      <div className="font-semibold text-slate-800">{s.vendorName}</div>
                      <div className="text-[10px] text-slate-400">{s.principalCompanyName || "Independent Vendor"}</div>
                    </td>
                    <td className="py-2.5 px-2.5 text-center font-medium text-slate-700">{s.grnCount}</td>
                    <td className="py-2.5 px-2.5 text-right font-medium text-slate-800">{s.totalPurchasedQuantity.toLocaleString()}</td>
                    <td className="py-2.5 px-2.5 text-right font-bold text-slate-900">
                      {canViewCosts ? formatCurrency(s.totalPurchasedValue) : "—"}
                    </td>
                    <td className="py-2.5 px-2.5 text-right text-rose-600 font-medium">{s.totalShortageQuantity}</td>
                    <td className="py-2.5 px-2.5 text-center">
                      {s.shortageRatePercentage !== null ? (
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          s.shortageRatePercentage > 5 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                        }`}>
                          {s.shortageRatePercentage.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">N/A</span>
                      )}
                    </td>
                    <td className="py-2.5 px-2.5 text-center font-medium text-slate-600">
                      {s.purchaseReturnCount} bills
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No supplier receipt records found in this period
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
