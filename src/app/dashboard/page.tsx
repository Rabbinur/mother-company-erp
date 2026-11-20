"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Package,
  Users,
  Building2,
  ShoppingCart,
  DollarSign,
  Wallet,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  PlusCircle,
  Truck,
  CreditCard,
  BarChart2,
} from "lucide-react";
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
import { formatCurrency } from "@/lib/utils";

interface DashboardData {
  totalProducts: number;
  activeProducts: number;
  totalCustomers: number;
  totalVendors: number;
  totalSalesOrders: number;
  totalSalesAmount: number;
  totalPurchasesAmount: number;
  grossProfit: number;
  netProfit: number;
  totalInventoryValuation: number;
  totalReceivables: number;
  totalPayables: number;
  pendingOrdersCount: number;
  unpaidOrdersAmount: number;
}

export default function DashboardPage() {
  const [kpis, setKpis] = useState<DashboardData | null>(null);
  const [trends, setTrends] = useState<Array<{ month: string; sales: number; purchases: number; profit: number }>>([]);
  const [topProducts, setTopProducts] = useState<Array<{ name: string; sku: string; quantitySold: number; revenue: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [kpiRes, trendRes] = await Promise.all([
        fetch("/api/v1/reports/kpis"),
        fetch("/api/v1/reports/trends"),
      ]);

      const kpiJson = await kpiRes.json();
      const trendJson = await trendRes.json();

      if (kpiJson.success) setKpis(kpiJson.data);
      if (trendJson.success) {
        setTrends(trendJson.data?.monthlyTrends || []);
        setTopProducts(trendJson.data?.topProducts || []);
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Executive Business Dashboard
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time business performance, inventory ledger, and financial status
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/orders"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-sky-600 transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            <span>New Sales Order</span>
          </Link>
          <Link
            href="/purchases"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
          >
            <Truck className="h-4 w-4 text-slate-500" />
            <span>Receive Goods</span>
          </Link>
          <Link
            href="/payments"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
          >
            <CreditCard className="h-4 w-4 text-slate-500" />
            <span>Record Payment</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Sales */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Gross Sales Volume</span>
            <div className="rounded-lg bg-sky-50 p-2 text-primary">
              <ShoppingCart className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900">
              {formatCurrency(kpis?.totalSalesAmount)}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">{kpis?.totalSalesOrders || 0}</span>
            <span>confirmed orders</span>
          </div>
        </div>

        {/* Card 2: Gross Profit */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Gross Profit (COGS Deducted)</span>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-emerald-600">
              {formatCurrency(kpis?.grossProfit)}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs text-emerald-700 font-medium">
            <ArrowUpRight className="h-3.5 w-3.5" />
            <span>Sales Revenue minus COGS</span>
          </div>
        </div>

        {/* Card 3: Receivables */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Customer Receivables (AR)</span>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900">
              {formatCurrency(kpis?.totalReceivables)}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
            <span>Outstanding credit across retailers</span>
          </div>
        </div>

        {/* Card 4: Inventory Valuation */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Central Inventory Value</span>
            <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900">
              {formatCurrency(kpis?.totalInventoryValuation)}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">{kpis?.activeProducts || 0}</span>
            <span>active catalog items</span>
          </div>
        </div>
      </div>

      {/* Secondary KPI Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <span className="text-[11px] font-medium text-slate-400">Total Purchases</span>
          <p className="mt-1 text-sm font-semibold text-slate-800">
            {formatCurrency(kpis?.totalPurchasesAmount)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <span className="text-[11px] font-medium text-slate-400">Vendor Payables (AP)</span>
          <p className="mt-1 text-sm font-semibold text-red-600">
            {formatCurrency(kpis?.totalPayables)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <span className="text-[11px] font-medium text-slate-400">Total Net Profit</span>
          <p className="mt-1 text-sm font-semibold text-emerald-600">
            {formatCurrency(kpis?.netProfit)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <span className="text-[11px] font-medium text-slate-400">Retailers / Customers</span>
          <p className="mt-1 text-sm font-semibold text-slate-800">
            {kpis?.totalCustomers || 0} Shops
          </p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Monthly Trend Area Chart */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                Monthly Sales & Purchase Volume (৳ BDT)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Revenue inflows vs Acquisition expenditure
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-primary"></span>
                <span className="text-slate-600">Sales</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                <span className="text-slate-600">Purchases</span>
              </div>
            </div>
          </div>

          <div className="h-72 w-full">
            {trends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284c7" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="purchGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(v) => `৳${v / 1000}k`} />
                  <Tooltip
                    formatter={(val: any) => [formatCurrency(Number(val) || 0), "Amount"]}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
                  />
                  <Area type="monotone" dataKey="sales" stroke="#0284c7" strokeWidth={2} fillOpacity={1} fill="url(#salesGrad)" />
                  <Area type="monotone" dataKey="purchases" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#purchGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">
                No transaction trend data available yet
              </div>
            )}
          </div>
        </div>

        {/* Top Products */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <h3 className="text-sm font-semibold text-slate-800">Top Selling Items</h3>
          <p className="text-xs text-slate-400 mt-0.5 mb-4">Highest volume stock units</p>

          <div className="space-y-4">
            {topProducts.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Fulfilled orders will appear here
              </div>
            ) : (
              topProducts.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between border-b border-slate-50 pb-3">
                  <div>
                    <p className="text-xs font-medium text-slate-800">{p.name}</p>
                    <p className="text-[11px] text-slate-400">{p.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-slate-900">{p.quantitySold} units</p>
                    <p className="text-[11px] text-primary">{formatCurrency(p.revenue)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
