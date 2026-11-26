"use client";

import React from "react";
import {
  DollarSign,
  TrendingUp,
  Landmark,
  Building2,
  Receipt,
  ShieldCheck,
  AlertCircle,
  Percent,
} from "lucide-react";
import { FinancialAnalyticsData } from "./types";
import { formatCurrency } from "@/lib/utils";

interface FinancialAnalyticsSectionProps {
  financials: FinancialAnalyticsData;
  canViewCosts: boolean;
}

export function FinancialAnalyticsSection({
  financials,
  canViewCosts,
}: FinancialAnalyticsSectionProps) {
  const {
    grossRevenue,
    salesReturns,
    netRevenue,
    costOfGoodsSold,
    grossProfit,
    grossMarginPercentage,
    totalOperatingExpenses,
    operatingExpenses,
    dealershipProfitability,
    treasury,
  } = financials;

  return (
    <div className="space-y-6">
      {/* 6 Top Financial KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Gross Revenue</span>
          <p className="mt-1 text-base font-bold text-slate-900">{formatCurrency(grossRevenue)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Returns & Deductions</span>
          <p className="mt-1 text-base font-bold text-rose-600">{formatCurrency(salesReturns)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Net Revenue</span>
          <p className="mt-1 text-base font-bold text-slate-900">{formatCurrency(netRevenue)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">COGS (Landed Cost)</span>
          <p className="mt-1 text-base font-bold text-slate-700">
            {canViewCosts ? formatCurrency(costOfGoodsSold) : "Confidential"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Gross Profit</span>
          <p className="mt-1 text-base font-bold text-emerald-600">
            {canViewCosts ? formatCurrency(grossProfit) : "Confidential"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Gross Margin %</span>
          <p className="mt-1 text-base font-bold text-emerald-600">
            {canViewCosts ? `${grossMarginPercentage.toFixed(1)}%` : "Confidential"}
          </p>
        </div>
      </div>

      {/* Shared Treasury Isolation Callout */}
      <div className="rounded-xl border border-sky-200 bg-gradient-to-r from-sky-50/70 to-indigo-50/70 p-5 shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-sky-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary p-2.5 text-white">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Treasury & Liquid Funds Segregation
              </h3>
              <p className="text-xs text-slate-500">
                Mother Company Central Treasury is strictly segregated from individual dealership branch operating cash
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-white px-3 py-1 text-xs font-bold text-slate-800 border border-slate-200 shadow-2xs">
              Total Liquid Funds: {formatCurrency(treasury.totalLiquidFunds)}
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-white p-3.5 border border-sky-100 shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500">Central Cash (GL 1010)</span>
            <p className="mt-1 text-sm font-bold text-slate-900">{formatCurrency(treasury.sharedTreasuryCash)}</p>
            <span className="text-[10px] text-sky-600 font-semibold">Shared Treasury</span>
          </div>
          <div className="rounded-lg bg-white p-3.5 border border-sky-100 shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500">Central Bank (GL 1020)</span>
            <p className="mt-1 text-sm font-bold text-slate-900">{formatCurrency(treasury.sharedTreasuryBank)}</p>
            <span className="text-[10px] text-sky-600 font-semibold">Shared Treasury</span>
          </div>
          <div className="rounded-lg bg-white p-3.5 border border-sky-100 shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500">Total Central Treasury</span>
            <p className="mt-1 text-sm font-bold text-primary">{formatCurrency(treasury.sharedTreasuryTotal)}</p>
            <span className="text-[10px] text-slate-400">Head Office Reserves</span>
          </div>
          <div className="rounded-lg bg-white p-3.5 border border-sky-100 shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500">Dealership Branch Operating</span>
            <p className="mt-1 text-sm font-bold text-slate-900">
              {formatCurrency(treasury.dealershipOperatingTreasuryTotal)}
            </p>
            <span className="text-[10px] text-slate-400">Branch Cash/Banks</span>
          </div>
        </div>
      </div>

      {/* Dealership Profitability & Operating Expenses */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Dealership-Wise Profitability */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-slate-900">Dealership Profitability</h3>
            </div>
            <span className="text-[11px] text-slate-400">Revenue vs COGS</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-2 px-2.5">Dealership</th>
                  <th className="py-2 px-2.5 text-right">Revenue</th>
                  <th className="py-2 px-2.5 text-right">{canViewCosts ? "COGS" : ""}</th>
                  <th className="py-2 px-2.5 text-right">Gross Profit</th>
                  <th className="py-2 px-2.5 text-right">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dealershipProfitability && dealershipProfitability.length > 0 ? (
                  dealershipProfitability.map((dp) => (
                    <tr key={dp.dealershipId} className="hover:bg-slate-50/60">
                      <td className="py-2 px-2.5 font-medium text-slate-800">{dp.dealershipName}</td>
                      <td className="py-2 px-2.5 text-right font-semibold text-slate-900">
                        {formatCurrency(dp.revenue)}
                      </td>
                      <td className="py-2 px-2.5 text-right text-slate-600">
                        {canViewCosts ? formatCurrency(dp.cogs) : "—"}
                      </td>
                      <td className="py-2 px-2.5 text-right font-bold text-emerald-600">
                        {canViewCosts ? formatCurrency(dp.grossProfit) : "Confidential"}
                      </td>
                      <td className="py-2 px-2.5 text-right text-slate-700">
                        {canViewCosts ? `${dp.grossMarginPercentage.toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No branch sales recorded in this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Operating Expenses Breakdown */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900">Operating Expenses (GL Ledgers)</h3>
            </div>
            <span className="text-xs font-bold text-slate-900">
              Total: {formatCurrency(totalOperatingExpenses)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-2 px-2.5">Code</th>
                  <th className="py-2 px-2.5">Expense Account</th>
                  <th className="py-2 px-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {operatingExpenses && operatingExpenses.length > 0 ? (
                  operatingExpenses.map((exp) => (
                    <tr key={exp.code} className="hover:bg-slate-50/60">
                      <td className="py-2 px-2.5 font-mono text-[11px] text-slate-500">{exp.code}</td>
                      <td className="py-2 px-2.5 font-medium text-slate-800">{exp.name}</td>
                      <td className="py-2 px-2.5 text-right font-bold text-slate-900">
                        {formatCurrency(exp.amount)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-400">
                      No operating expenses posted in this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
