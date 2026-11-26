"use client";

import React from "react";
import { Lock, Unlock, Calendar } from "lucide-react";
import { formatShortDate } from "@/lib/utils";
import { AccountingPeriodRow } from "./types";

interface AccountingPeriodsTableProps {
  periods: AccountingPeriodRow[];
  isLoading?: boolean;
  onClosePeriodClick: (periodId: string) => void;
  onReopenPeriodClick: (periodId: string) => void;
}

export function AccountingPeriodsTable({
  periods,
  isLoading = false,
  onClosePeriodClick,
  onReopenPeriodClick,
}: AccountingPeriodsTableProps) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border/50 bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border/40 bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Period Name</th>
                <th className="px-4 py-3">Start Date</th>
                <th className="px-4 py-3">End Date</th>
                <th className="px-4 py-3">Posting Status</th>
                <th className="px-4 py-3">Closed Governance</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    Loading financial periods...
                  </td>
                </tr>
              ) : periods.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    No accounting periods found. Click &quot;New Period&quot; to establish a fiscal period.
                  </td>
                </tr>
              ) : (
                periods.map((p) => {
                  const isOpen = p.status === "OPEN";
                  return (
                    <tr key={p._id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-bold text-foreground">
                        {p.periodName}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono">
                        {formatShortDate(p.startDate)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono">
                        {formatShortDate(p.endDate)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                            isOpen
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {isOpen ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-[11px]">
                        {p.closedBy?.name ? (
                          <span>
                            Closed by <strong>{p.closedBy.name}</strong>
                            {p.closedAt && ` on ${formatShortDate(p.closedAt)}`}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isOpen ? (
                          <button
                            type="button"
                            onClick={() => onClosePeriodClick(p._id)}
                            className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition"
                          >
                            Close Period
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onReopenPeriodClick(p._id)}
                            className="rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-muted/50 transition"
                          >
                            Reopen
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
