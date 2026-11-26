"use client";

import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  TrendingUp,
  Package,
  Users,
  RotateCcw,
  Building,
} from "lucide-react";
import {
  SalesTimelinePoint,
  DealershipSalesItem,
  TopProductSalesItem,
  TopCustomerItem,
  SalesReturnsSummary,
} from "./types";
import { formatCurrency } from "@/lib/utils";

interface SalesAnalyticsSectionProps {
  sales: {
    timeline: SalesTimelinePoint[];
    dealershipComparison: DealershipSalesItem[];
    topProducts: TopProductSalesItem[];
    topCustomers: TopCustomerItem[];
    returnsSummary: SalesReturnsSummary;
  };
  canViewCosts: boolean;
}

export function SalesAnalyticsSection({
  sales,
  canViewCosts,
}: SalesAnalyticsSectionProps) {
  const { timeline, dealershipComparison, topProducts, topCustomers, returnsSummary } = sales;

  return (
    <div className="space-y-6">
      {/* Top Row: Sales Timeline Chart + Dealership Share */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Timeline Area Chart */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Sales Trend Timeline</h3>
              <p className="text-xs text-slate-400 mt-0.5">Fulfilled sales revenue over the selected period</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-sky-50 px-2.5 py-1 rounded-md border border-sky-100">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              <span>Fulfilled Revenue</span>
            </div>
          </div>

          <div className="h-64 w-full">
            {timeline && timeline.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeline} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284c7" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(v) => `৳${v / 1000}k`} />
                  <Tooltip
                    formatter={(val: any) => [formatCurrency(Number(val) || 0), "Sales Revenue"]}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                  />
                  <Area type="monotone" dataKey="sales" stroke="#0284c7" strokeWidth={2} fillOpacity={1} fill="url(#salesGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">
                No sales records found for this period
              </div>
            )}
          </div>
        </div>

        {/* Dealership Sales Breakdown */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">Branch Distribution</h3>
            <p className="text-xs text-slate-400 mt-0.5">Sales contribution by dealership</p>
          </div>

          <div className="space-y-3.5 overflow-y-auto max-h-64 pr-1">
            {dealershipComparison && dealershipComparison.length > 0 ? (
              dealershipComparison.map((d) => (
                <div key={d.dealershipId} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{d.dealershipName}</span>
                    <span className="font-bold text-slate-900">{formatCurrency(d.sales)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, Math.max(2, d.sharePercentage))}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-medium text-slate-400 w-10 text-right">
                      {d.sharePercentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-xs text-slate-400">
                No branch distribution data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Second Row: Top Products & Top Customers */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Selling Products */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-slate-900">Top-Selling Products</h3>
            </div>
            <span className="text-[11px] text-slate-400">Top 10 items</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-2 px-2.5">Product</th>
                  <th className="py-2 px-2.5 text-right">Qty Sold</th>
                  <th className="py-2 px-2.5 text-right">Revenue</th>
                  {canViewCosts && <th className="py-2 px-2.5 text-right">Gross Profit</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topProducts && topProducts.length > 0 ? (
                  topProducts.map((p, idx) => (
                    <tr key={`${p.productId}-${p.variantId}-${idx}`} className="hover:bg-slate-50/60">
                      <td className="py-2 px-2.5">
                        <div className="font-semibold text-slate-800">{p.name}</div>
                        <div className="text-[10px] text-slate-400">{p.sku}</div>
                      </td>
                      <td className="py-2 px-2.5 text-right font-medium text-slate-700">
                        {p.quantitySold.toLocaleString()}
                      </td>
                      <td className="py-2 px-2.5 text-right font-bold text-slate-900">
                        {formatCurrency(p.revenue)}
                      </td>
                      {canViewCosts && (
                        <td className="py-2 px-2.5 text-right font-semibold text-emerald-600">
                          {formatCurrency(p.grossProfit)}
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={canViewCosts ? 4 : 3} className="py-8 text-center text-slate-400">
                      No product sales recorded in this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Performing Customers */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Top Performing Retailers</h3>
            </div>
            <span className="text-[11px] text-slate-400">Top 10 customers</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-2 px-2.5">Customer / Shop</th>
                  <th className="py-2 px-2.5 text-center">Orders</th>
                  <th className="py-2 px-2.5 text-right">Total Spent</th>
                  <th className="py-2 px-2.5 text-right">Outstanding (AR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topCustomers && topCustomers.length > 0 ? (
                  topCustomers.map((c) => (
                    <tr key={c.customerId} className="hover:bg-slate-50/60">
                      <td className="py-2 px-2.5">
                        <div className="font-semibold text-slate-800">{c.shopName || c.customerName}</div>
                        <div className="text-[10px] text-slate-400">{c.phone || c.customerName}</div>
                      </td>
                      <td className="py-2 px-2.5 text-center font-medium text-slate-700">
                        {c.ordersCount}
                      </td>
                      <td className="py-2 px-2.5 text-right font-bold text-slate-900">
                        {formatCurrency(c.totalSpent)}
                      </td>
                      <td className="py-2 px-2.5 text-right font-semibold text-amber-600">
                        {formatCurrency(c.outstandingBalance)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      No customer transactions in this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Third Row: Sales Returns & Deductions Summary */}
      {returnsSummary && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-rose-50 p-2 text-rose-600">
                <RotateCcw className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800">Returns & Deductions Summary</h4>
                <p className="text-[11px] text-slate-400">Processed returns and issued customer credits</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Return Count</span>
                <span className="font-bold text-slate-800">{returnsSummary.returnsCount} orders</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Total Returns Amount</span>
                <span className="font-bold text-rose-600">{formatCurrency(returnsSummary.totalReturnsAmount)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Cash Refunded</span>
                <span className="font-semibold text-slate-700">{formatCurrency(returnsSummary.refundedCash)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Credit Notes Issued</span>
                <span className="font-semibold text-slate-700">{formatCurrency(returnsSummary.creditNotesIssued)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
