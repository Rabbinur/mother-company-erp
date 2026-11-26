"use client";

import React from "react";
import { formatShortDate } from "@/lib/utils";
import { LedgerStatementData, AccountRow } from "./types";

interface LedgerStatementViewerProps {
  data: LedgerStatementData | null;
  accounts: AccountRow[];
  selectedAccountId: string;
  onSelectAccountId: (id: string) => void;
  isLoading?: boolean;
}

export function LedgerStatementViewer({
  data,
  accounts,
  selectedAccountId,
  onSelectAccountId,
  isLoading,
}: LedgerStatementViewerProps) {
  return (
    <div className="rounded-xl border border-border/50 bg-card shadow-xs p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-3 border-b border-border/30 pb-3">
        <span className="text-xs font-semibold text-muted-foreground">
          Select General Ledger Account:
        </span>
        <select
          value={selectedAccountId}
          onChange={(e) => onSelectAccountId(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-mono text-foreground"
        >
          {accounts.map((acc) => (
            <option key={acc._id} value={acc._id}>
              {acc.code} - {acc.name} ({acc.category})
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-xs text-muted-foreground">
          Loading ledger statement...
        </div>
      ) : data ? (
        <div className="space-y-3">
          <div className="flex justify-between items-center bg-muted/30 p-3 rounded-lg text-xs font-mono">
            <div>
              <span className="font-sans text-muted-foreground block text-[11px]">Active Account</span>
              <span className="font-bold text-foreground text-sm">
                {data.account?.code} - {data.account?.name}
              </span>
            </div>
            <div className="text-right">
              <span className="font-sans text-muted-foreground block text-[11px]">Closing Running Balance</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm tabular-nums">
                ৳{Number(data.closingBalance || 0).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border/40 bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                <tr>
                  <th className="py-2.5 px-3 text-left">Posting Date</th>
                  <th className="py-2.5 px-3 text-left">Journal #</th>
                  <th className="py-2.5 px-3 text-left">Line Memo</th>
                  <th className="py-2.5 px-3 text-right">Debit (৳)</th>
                  <th className="py-2.5 px-3 text-right">Credit (৳)</th>
                  <th className="py-2.5 px-3 text-right">Running Balance (৳)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20 font-mono">
                {data.lines?.map((row, idx) => (
                  <tr key={idx} className="hover:bg-muted/20">
                    <td className="py-2 px-3 text-muted-foreground">{formatShortDate(row.date)}</td>
                    <td className="py-2 px-3 font-bold text-foreground">{row.journalNumber}</td>
                    <td className="py-2 px-3 font-sans text-muted-foreground text-[11px]">{row.memo}</td>
                    <td className="py-2 px-3 text-right font-bold tabular-nums">
                      {row.debit > 0 ? `৳${row.debit.toFixed(2)}` : "-"}
                    </td>
                    <td className="py-2 px-3 text-right font-bold tabular-nums">
                      {row.credit > 0 ? `৳${row.credit.toFixed(2)}` : "-"}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      ৳{Number(row.runningBalance || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="py-12 text-center text-xs text-muted-foreground">
          Select an account to view its running ledger statement.
        </div>
      )}
    </div>
  );
}
