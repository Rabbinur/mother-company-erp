"use client";

import React from "react";
import { formatShortDate } from "@/lib/utils";
import { TrialBalanceData } from "./types";

interface TrialBalanceViewerProps {
  data: TrialBalanceData | null;
  isLoading?: boolean;
}

export function TrialBalanceViewer({ data, isLoading }: TrialBalanceViewerProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-12 text-center text-xs text-muted-foreground">
        Generating Trial Balance statement...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-12 text-center text-xs text-muted-foreground">
        No trial balance data available.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card shadow-xs p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-border/30 pb-3">
        <div>
          <h3 className="font-bold text-foreground text-sm">Trial Balance Statement</h3>
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
          {data.isBalanced ? "✓ Balanced (Debits == Credits)" : "! Out of Balance"}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="border-b border-border/40 bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            <tr>
              <th className="py-2.5 px-3 text-left">Code</th>
              <th className="py-2.5 px-3 text-left">Account Name</th>
              <th className="py-2.5 px-3 text-left">Category</th>
              <th className="py-2.5 px-3 text-right">Debit Balance (৳)</th>
              <th className="py-2.5 px-3 text-right">Credit Balance (৳)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20 font-mono">
            {data.accounts?.map((row) => (
              <tr key={row.code} className="hover:bg-muted/20">
                <td className="py-2 px-3 font-bold text-foreground">{row.code}</td>
                <td className="py-2 px-3 font-sans font-medium text-foreground">{row.name}</td>
                <td className="py-2 px-3 font-sans text-muted-foreground text-[11px]">{row.category}</td>
                <td className="py-2 px-3 text-right font-bold text-foreground tabular-nums">
                  {row.debit > 0 ? `৳${row.debit.toFixed(2)}` : "-"}
                </td>
                <td className="py-2 px-3 text-right font-bold text-foreground tabular-nums">
                  {row.credit > 0 ? `৳${row.credit.toFixed(2)}` : "-"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-foreground font-mono font-bold bg-muted/30 text-xs">
            <tr>
              <td colSpan={3} className="py-3 px-3 font-sans">
                Total Trial Balance
              </td>
              <td className="py-3 px-3 text-right text-foreground tabular-nums">
                ৳{Number(data.totalDebits || 0).toFixed(2)}
              </td>
              <td className="py-3 px-3 text-right text-foreground tabular-nums">
                ৳{Number(data.totalCredits || 0).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
