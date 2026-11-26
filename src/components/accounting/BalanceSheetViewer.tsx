"use client";

import React from "react";
import { formatShortDate } from "@/lib/utils";
import { BalanceSheetData } from "./types";

interface BalanceSheetViewerProps {
  data: BalanceSheetData | null;
  isLoading?: boolean;
}

export function BalanceSheetViewer({ data, isLoading }: BalanceSheetViewerProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-12 text-center text-xs text-muted-foreground">
        Generating Balance Sheet...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-12 text-center text-xs text-muted-foreground">
        No Balance Sheet data available.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card shadow-xs p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-border/30 pb-3">
        <div>
          <h3 className="font-bold text-foreground text-sm">Consolidated Balance Sheet</h3>
          <span className="text-[11px] text-muted-foreground font-mono">
            As of {formatShortDate(data.asOfDate || new Date())}
          </span>
        </div>
        <div
          className={`px-3 py-1 rounded-md text-xs font-bold ${
            data.isBalanced
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
          }`}
        >
          {data.isBalanced ? "✓ Balanced (Assets == Liabilities + Equity)" : "! Out of Balance"}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
        {/* Assets Column */}
        <div className="bg-muted/30 p-3.5 rounded-lg space-y-2">
          <h4 className="font-sans font-bold text-foreground text-sm border-b border-border/30 pb-1.5">
            Assets
          </h4>
          {data.assets?.lines?.map((line) => (
            <div key={line.code} className="flex justify-between py-1 border-b border-border/10">
              <span className="font-sans text-muted-foreground">
                {line.name} ({line.code})
              </span>
              <span className="font-semibold text-foreground tabular-nums">
                ৳{Number(line.amount).toFixed(2)}
              </span>
            </div>
          ))}
          <div className="border-t-2 border-foreground pt-2 flex justify-between font-bold text-foreground text-sm">
            <span className="font-sans">Total Assets</span>
            <span className="tabular-nums">৳{Number(data.totalAssets || 0).toFixed(2)}</span>
          </div>
        </div>

        {/* Liabilities & Equity Column */}
        <div className="space-y-3">
          <div className="bg-muted/30 p-3.5 rounded-lg space-y-2">
            <h4 className="font-sans font-bold text-foreground text-sm border-b border-border/30 pb-1.5">
              Liabilities
            </h4>
            {data.liabilities?.lines?.map((line) => (
              <div key={line.code} className="flex justify-between py-1 border-b border-border/10">
                <span className="font-sans text-muted-foreground">
                  {line.name} ({line.code})
                </span>
                <span className="font-semibold text-foreground tabular-nums">
                  ৳{Number(line.amount).toFixed(2)}
                </span>
              </div>
            ))}
            <div className="border-t border-border/40 pt-1.5 flex justify-between font-bold text-foreground">
              <span className="font-sans">Total Liabilities</span>
              <span className="tabular-nums">৳{Number(data.totalLiabilities || 0).toFixed(2)}</span>
            </div>
          </div>

          <div className="bg-muted/30 p-3.5 rounded-lg space-y-2">
            <h4 className="font-sans font-bold text-foreground text-sm border-b border-border/30 pb-1.5">
              Equity & Retained Earnings
            </h4>
            {data.equity?.lines?.map((line) => (
              <div key={line.code} className="flex justify-between py-1 border-b border-border/10">
                <span className="font-sans text-muted-foreground">
                  {line.name} ({line.code})
                </span>
                <span className="font-semibold text-foreground tabular-nums">
                  ৳{Number(line.amount).toFixed(2)}
                </span>
              </div>
            ))}
            <div className="border-t-2 border-foreground pt-2 flex justify-between font-bold text-foreground text-sm">
              <span className="font-sans">Total Liabilities & Equity</span>
              <span className="tabular-nums">৳{Number(data.totalLiabilitiesAndEquity || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
