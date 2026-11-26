"use client";

import React from "react";
import { formatShortDate } from "@/lib/utils";
import { ProfitLossData } from "./types";

interface ProfitLossViewerProps {
  data: ProfitLossData | null;
  isLoading?: boolean;
}

export function ProfitLossViewer({ data, isLoading }: ProfitLossViewerProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-12 text-center text-xs text-muted-foreground">
        Generating Income Statement...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-12 text-center text-xs text-muted-foreground">
        No Profit & Loss data available.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card shadow-xs p-5 space-y-4">
      <div className="border-b border-border/30 pb-3">
        <h3 className="font-bold text-foreground text-sm">Statement of Profit & Loss (Income Statement)</h3>
        <span className="text-[11px] text-muted-foreground font-mono">
          Fiscal Interval: {formatShortDate(data.startDate || new Date())} to {formatShortDate(data.endDate || new Date())}
        </span>
      </div>

      <div className="space-y-3 text-xs font-mono">
        {/* Revenue Section */}
        <div className="bg-muted/30 p-3.5 rounded-lg space-y-1.5">
          <span className="text-muted-foreground font-sans font-semibold text-[11px] uppercase tracking-wider block">
            Operating Revenues
          </span>
          <div className="flex justify-between py-1 border-b border-border/20">
            <span className="font-sans text-foreground">Gross Sales Revenue (4010)</span>
            <span className="font-bold text-foreground tabular-nums">
              ৳{Number(data.grossRevenue || 0).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-border/20 text-rose-600 dark:text-rose-400">
            <span className="font-sans">Less: Sales Returns & Allowances (4110)</span>
            <span className="font-bold tabular-nums">
              (৳{Number(data.salesReturns || 0).toFixed(2)})
            </span>
          </div>
          <div className="flex justify-between py-1.5 font-bold text-emerald-600 dark:text-emerald-400 text-sm">
            <span className="font-sans">Net Operating Revenue</span>
            <span className="tabular-nums">৳{Number(data.netRevenue || 0).toFixed(2)}</span>
          </div>
        </div>

        {/* COGS Section */}
        <div className="bg-muted/30 p-3.5 rounded-lg space-y-1.5">
          <span className="text-muted-foreground font-sans font-semibold text-[11px] uppercase tracking-wider block">
            Cost of Goods Sold (COGS)
          </span>
          <div className="flex justify-between py-1 font-bold text-amber-600 dark:text-amber-400">
            <span className="font-sans">Direct Inventory Landed Cost (5010)</span>
            <span className="tabular-nums">৳{Number(data.costOfGoodsSold || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-1.5 border-t border-border/40 font-bold text-foreground text-sm">
            <span className="font-sans">Gross Profit</span>
            <span className="tabular-nums">৳{Number(data.grossProfit || 0).toFixed(2)}</span>
          </div>
        </div>

        {/* Operating Expenses Section */}
        <div className="bg-muted/30 p-3.5 rounded-lg space-y-1.5">
          <span className="text-muted-foreground font-sans font-semibold text-[11px] uppercase tracking-wider block">
            Operating Expenses
          </span>
          {data.operatingExpenses?.map((e) => (
            <div key={e.code} className="flex justify-between py-1 border-b border-border/10">
              <span className="font-sans text-muted-foreground">
                {e.name} ({e.code})
              </span>
              <span className="font-semibold text-foreground tabular-nums">
                ৳{Number(e.amount).toFixed(2)}
              </span>
            </div>
          ))}
          <div className="flex justify-between py-1.5 font-bold text-foreground">
            <span className="font-sans">Total Operating Expenses</span>
            <span className="tabular-nums">৳{Number(data.totalOperatingExpenses || 0).toFixed(2)}</span>
          </div>
        </div>

        {/* Net Margin Card */}
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3.5 flex justify-between items-center text-sm font-bold">
          <span className="font-sans text-emerald-800 dark:text-emerald-300">
            Net Operating Profit / (Loss)
          </span>
          <span
            className={`text-base tabular-nums ${
              data.netProfit >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            ৳{Number(data.netProfit || 0).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
