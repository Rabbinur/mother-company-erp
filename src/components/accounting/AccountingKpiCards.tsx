"use client";

import React from "react";
import {
  Wallet,
  Building2,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  ShieldCheck,
} from "lucide-react";
import { AccountingKpiMetrics } from "./types";

interface AccountingKpiCardsProps {
  metrics: AccountingKpiMetrics;
  journalsCount: number;
  openPeriodsCount: number;
  closedPeriodsCount: number;
}

export function AccountingKpiCards({
  metrics,
  journalsCount,
  openPeriodsCount,
  closedPeriodsCount,
}: AccountingKpiCardsProps) {
  const cards = [
    {
      title: "Total Assets",
      value: metrics.assets,
      subtitle: "Cash, Bank, AR & Stock",
      icon: Wallet,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/40",
    },
    {
      title: "Total Liabilities",
      value: metrics.liabilities,
      subtitle: "Supplier AP & Advances",
      icon: Building2,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/40",
    },
    {
      title: "Total Equity",
      value: metrics.equity,
      subtitle: "Capital & Retained",
      icon: PieChart,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-950/40",
    },
    {
      title: "Gross Revenue",
      value: metrics.revenue,
      subtitle: "Sales Invoiced",
      icon: ArrowUpRight,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
    },
    {
      title: "Total Expenses",
      value: metrics.expense,
      subtitle: "COGS & Operating",
      icon: ArrowDownRight,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-950/40",
    },
    {
      title: "Net Operating Margin",
      value: metrics.netProfit,
      subtitle: "Revenue - Total Expenses",
      icon: TrendingUp,
      color: metrics.netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
      bg: metrics.netProfit >= 0 ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-rose-50 dark:bg-rose-950/40",
    },
  ];

  const totalLiabAndEquity = metrics.liabilities + metrics.equity + metrics.netProfit;
  const equationDiff = Math.abs(metrics.assets - totalLiabAndEquity);
  const isEquationBalanced = equationDiff <= 0.05;

  return (
    <div className="space-y-4">
      {/* 6 Core Financial Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div
              key={i}
              className="p-3.5 rounded-xl border border-border/50 bg-card text-card-foreground shadow-xs flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {c.title}
                </span>
                <div className={`p-1.5 rounded-md ${c.bg}`}>
                  <Icon className={`w-3.5 h-3.5 ${c.color}`} />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-base font-bold font-mono tracking-tight text-foreground">
                  ৳{c.value.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{c.subtitle}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Accounting Equation & Period Governance Banner */}
      <div className="rounded-xl border border-border/50 bg-card p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/30 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-xs font-bold text-foreground">
              Accounting Equation Verification (A = L + E + Retained)
            </h3>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
              isEquationBalanced
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
            }`}
          >
            {isEquationBalanced ? "✓ Balanced Equation" : "! Out of Balance"}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="rounded-lg bg-muted/40 p-2.5">
            <span className="text-[11px] text-muted-foreground block font-medium">Assets vs (Liabilities + Equity)</span>
            <p className="mt-0.5 font-mono font-bold text-foreground">
              ৳{metrics.assets.toFixed(2)} vs ৳{totalLiabAndEquity.toFixed(2)}
            </p>
          </div>
          <div className="rounded-lg bg-muted/40 p-2.5">
            <span className="text-[11px] text-muted-foreground block font-medium">Immutable Journal Entries</span>
            <p className="mt-0.5 font-mono font-bold text-foreground">
              {journalsCount} Total Posted Records
            </p>
          </div>
          <div className="rounded-lg bg-muted/40 p-2.5">
            <span className="text-[11px] text-muted-foreground block font-medium">Financial Fiscal Periods</span>
            <p className="mt-0.5 font-mono font-bold text-foreground">
              {openPeriodsCount} Open / {closedPeriodsCount} Closed
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
