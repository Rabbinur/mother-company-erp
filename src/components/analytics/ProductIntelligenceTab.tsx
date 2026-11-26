"use client";

import React from "react";
import { Package, TrendingUp, TrendingDown, RotateCcw } from "lucide-react";
import { ProductPerformanceItem } from "@/services/analytics/types";
import { formatCurrency } from "@/lib/utils";

interface ProductIntelligenceTabProps {
  products: ProductPerformanceItem[];
  fastMoving: ProductPerformanceItem[];
  slowMoving: ProductPerformanceItem[];
  topReturnRates: ProductPerformanceItem[];
  canViewCosts: boolean;
}

export function ProductIntelligenceTab({
  products,
  fastMoving,
  slowMoving,
  topReturnRates,
  canViewCosts,
}: ProductIntelligenceTabProps) {
  return (
    <div className="space-y-6">
      {/* Top Velocity Cards: Fast Movers vs Slow Movers */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Fast Moving */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">Fast-Moving Velocity</h3>
            </div>
            <span className="text-[11px] text-slate-400">Highest units sold in period</span>
          </div>

          <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
            {fastMoving.length > 0 ? (
              fastMoving.map((p) => (
                <div key={p.productId} className="flex items-center justify-between py-2 text-xs">
                  <div>
                    <span className="font-semibold text-slate-800">{p.name}</span>
                    <span className="text-[10px] text-slate-400 block">{p.sku}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-emerald-600 block">{p.quantitySold.toLocaleString()} units</span>
                    <span className="text-[10px] text-slate-500">{formatCurrency(p.netRevenue)}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-xs text-slate-400">No fast-moving items recorded</p>
            )}
          </div>
        </div>

        {/* Slow Moving */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900">Slow-Moving & Stagnant Stock</h3>
            </div>
            <span className="text-[11px] text-slate-400">High stock with low turnover</span>
          </div>

          <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
            {slowMoving.length > 0 ? (
              slowMoving.map((p) => (
                <div key={p.productId} className="flex items-center justify-between py-2 text-xs">
                  <div>
                    <span className="font-semibold text-slate-800">{p.name}</span>
                    <span className="text-[10px] text-slate-400 block">{p.sku}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-amber-700 block">{p.currentAvailableStock} in stock</span>
                    <span className="text-[10px] text-slate-400">{p.quantitySold} sold in period</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-xs text-slate-400">No stagnant inventory identified</p>
            )}
          </div>
        </div>
      </div>

      {/* Product Performance Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-slate-900">Product Profitability & Return Rates</h3>
          </div>
          <span className="text-xs text-slate-400">{products.length} products tracked</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-y border-slate-200">
              <tr>
                <th className="py-2 px-2.5">Product & SKU</th>
                <th className="py-2 px-2.5 text-right">Units Sold</th>
                <th className="py-2 px-2.5 text-right">Net Revenue</th>
                <th className="py-2 px-2.5 text-right">{canViewCosts ? "Gross Profit" : ""}</th>
                <th className="py-2 px-2.5 text-right">{canViewCosts ? "Margin %" : ""}</th>
                <th className="py-2 px-2.5 text-right">Returns</th>
                <th className="py-2 px-2.5 text-right">Return Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.length > 0 ? (
                products.map((p) => (
                  <tr key={p.productId} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-2.5">
                      <div className="font-semibold text-slate-800">{p.name}</div>
                      <div className="text-[10px] text-slate-400">{p.sku}</div>
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-medium text-slate-800">
                      {p.quantitySold.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-bold text-slate-900">
                      {formatCurrency(p.netRevenue)}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-semibold text-emerald-600">
                      {canViewCosts ? formatCurrency(p.grossProfit) : "—"}
                    </td>
                    <td className="py-2.5 px-2.5 text-right text-slate-700">
                      {canViewCosts ? `${p.grossMarginPercentage.toFixed(1)}%` : "—"}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-medium text-slate-700">
                      {p.returnedQuantity} units
                    </td>
                    <td className="py-2.5 px-2.5 text-right">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          p.returnRatePercentage > 10
                            ? "bg-rose-100 text-rose-700"
                            : p.returnRatePercentage > 0
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {p.returnRatePercentage.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No product transactions found in this period
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
