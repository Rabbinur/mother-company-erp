"use client";

import React from "react";
import {
  ShoppingCart,
  TrendingUp,
  DollarSign,
  Package,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  ShieldCheck,
  Percent,
} from "lucide-react";
import { ExecutiveOverviewKpis } from "./types";
import { formatCurrency } from "@/lib/utils";

interface BusinessOverviewSectionProps {
  overview: ExecutiveOverviewKpis;
  canViewCosts: boolean;
}

export function BusinessOverviewSection({
  overview,
  canViewCosts,
}: BusinessOverviewSectionProps) {
  const growth = overview.salesGrowthPercentage || 0;
  const isPositiveGrowth = growth >= 0;

  return (
    <div className="space-y-6">
      {/* 8 Primary KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Gross Sales Volume */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-hover hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Gross Sales
            </span>
            <div className="rounded-lg bg-sky-50 p-2 text-primary">
              <ShoppingCart className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {formatCurrency(overview.totalSales)}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            <span
              className={`inline-flex items-center gap-0.5 font-semibold ${
                isPositiveGrowth ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {isPositiveGrowth ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" />
              )}
              {isPositiveGrowth ? `+${growth.toFixed(1)}%` : `${growth.toFixed(1)}%`}
            </span>
            <span className="text-slate-400">vs prior period</span>
          </div>
        </div>

        {/* Card 2: Net Sales */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-hover hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Net Sales
            </span>
            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {formatCurrency(overview.netSales)}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Realized revenue after deductions & returns
          </p>
        </div>

        {/* Card 3: Gross Profit */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-hover hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Gross Profit
            </span>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold tracking-tight text-emerald-600">
              {canViewCosts ? formatCurrency(overview.grossProfit) : "Confidential"}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700">
            <Percent className="h-3.5 w-3.5" />
            <span>
              {canViewCosts && overview.netSales > 0
                ? `${((overview.grossProfit / overview.netSales) * 100).toFixed(1)}% gross margin`
                : "FIFO COGS deducted"}
            </span>
          </div>
        </div>

        {/* Card 4: Net Profit */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-hover hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Net Profit
            </span>
            <div className="rounded-lg bg-teal-50 p-2 text-teal-600">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {!canViewCosts
                ? "Confidential"
                : overview.netProfit !== null
                ? formatCurrency(overview.netProfit)
                : "Pending Period Close"}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {overview.netProfitMargin !== null
              ? `${overview.netProfitMargin.toFixed(1)}% net operating margin`
              : "Reconciled upon period end journal closure"}
          </p>
        </div>

        {/* Card 5: Total Receivables (AR) */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-hover hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Customer Receivables
            </span>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {formatCurrency(overview.totalReceivables)}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Active credit ledger across all retailers
          </p>
        </div>

        {/* Card 6: Supplier Payables (AP) */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-hover hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Supplier Payables
            </span>
            <div className="rounded-lg bg-rose-50 p-2 text-rose-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold tracking-tight text-rose-600">
              {formatCurrency(overview.totalPayables)}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Outstanding principal & vendor bills
          </p>
        </div>

        {/* Card 7: Central Inventory Valuation */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-hover hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Inventory Valuation
            </span>
            <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {canViewCosts ? formatCurrency(overview.inventoryValuation) : "Confidential"}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            FIFO landed cost from verified StockBatches
          </p>
        </div>

        {/* Card 8: Active Dealerships */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-hover hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Dealership Network
            </span>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {overview.activeDealerships}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Authorized operating distribution branches
          </p>
        </div>
      </div>
    </div>
  );
}
