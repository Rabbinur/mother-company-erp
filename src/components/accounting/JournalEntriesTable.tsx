"use client";

import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Filter,
  RotateCcw,
  CheckCircle2,
  XCircle,
  FileText,
} from "lucide-react";
import { formatShortDate } from "@/lib/utils";
import { JournalEntryRow } from "./types";

interface JournalEntriesTableProps {
  journals: JournalEntryRow[];
  isLoading?: boolean;
  onReverseClick: (journal: JournalEntryRow) => void;
}

export function JournalEntriesTable({
  journals,
  isLoading = false,
  onReverseClick,
}: JournalEntriesTableProps) {
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredJournals = journals.filter((j) => {
    if (sourceFilter) {
      const src = j.sourceType || j.referenceType;
      if (src !== sourceFilter) return false;
    }
    if (statusFilter && j.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-3">
      {/* Filters Toolbar */}
      <div className="flex flex-wrap items-center gap-3 bg-card p-3 rounded-xl border border-border/50 text-xs">
        <span className="font-semibold text-muted-foreground flex items-center gap-1 text-[11px] uppercase tracking-wider">
          <Filter className="h-3 w-3" /> Filter Journals:
        </span>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-lg border border-input bg-background px-2.5 py-1 text-xs text-foreground"
        >
          <option value="">All Source Events</option>
          <option value="purchase_grn">Purchase GRN</option>
          <option value="sales_fulfillment">Sales Fulfillment</option>
          <option value="customer_payment">Customer Receipt</option>
          <option value="supplier_payment">Supplier Payment</option>
          <option value="customer_return">Customer Return</option>
          <option value="purchase_return">Purchase Return</option>
          <option value="expense">Operating Expense</option>
          <option value="manual_adjustment">Manual Entry</option>
          <option value="reversal">Reversals</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-input bg-background px-2.5 py-1 text-xs text-foreground"
        >
          <option value="">All Statuses</option>
          <option value="POSTED">POSTED</option>
          <option value="REVERSED">REVERSED</option>
          <option value="VOIDED">VOIDED</option>
          <option value="DRAFT">DRAFT</option>
        </select>

        <div className="ml-auto text-[11px] text-muted-foreground">
          Showing <strong>{filteredJournals.length}</strong> of {journals.length} entries
        </div>
      </div>

      {/* Journal Cards List */}
      <div className="space-y-2.5">
        {isLoading ? (
          <div className="rounded-xl border border-border/50 bg-card p-12 text-center text-xs text-muted-foreground">
            Loading general ledger journals...
          </div>
        ) : filteredJournals.length === 0 ? (
          <div className="rounded-xl border border-border/50 bg-card p-12 text-center text-xs text-muted-foreground">
            No journal entries match the selected filters.
          </div>
        ) : (
          filteredJournals.map((j) => {
            const isExpanded = !!expandedIds[j._id];
            const isReversedOrVoided =
              j.status === "VOIDED" ||
              j.status === "REVERSED" ||
              Boolean(j.reversedByJournalId);

            return (
              <div
                key={j._id}
                className="rounded-xl border border-border/50 bg-card shadow-xs overflow-hidden transition-all"
              >
                {/* Journal Row Summary Header */}
                <div
                  onClick={() => toggleExpand(j._id)}
                  className="flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground p-0.5"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-foreground text-xs">
                          {j.journalNumber || j.entryNumber}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                            j.status === "POSTED" && !j.reversedByJournalId
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              : j.status === "REVERSED" || j.reversedByJournalId
                              ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                              : j.status === "VOIDED"
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                          }`}
                        >
                          {j.reversedByJournalId ? "REVERSED" : j.status || "POSTED"}
                        </span>
                        {j.reversalOfJournalId && (
                          <span className="rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 text-[10px] font-semibold border border-purple-500/20">
                            Reversal Journal
                          </span>
                        )}
                        <span className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground font-medium border border-border/40">
                          {j.sourceType || j.referenceType}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 max-w-lg truncate">
                        {j.narration || j.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono">
                    <div className="text-right hidden sm:block">
                      <span className="text-[10px] text-muted-foreground block font-sans">
                        Posting Date
                      </span>
                      <span className="text-foreground">
                        {formatShortDate(j.postingDate || j.date)}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-muted-foreground block font-sans">
                        Debits / Credits
                      </span>
                      <span className="font-bold text-foreground tabular-nums">
                        ৳{Number(j.debitsTotal || 0).toFixed(2)}
                      </span>
                    </div>

                    {!isReversedOrVoided && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onReverseClick(j);
                        }}
                        className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition"
                      >
                        Reverse
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Multi-Line Breakdown */}
                {isExpanded && (
                  <div className="border-t border-border/30 p-3 bg-card">
                    <table className="w-full text-xs">
                      <thead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/30 pb-1.5">
                        <tr>
                          <th className="text-left py-1.5 px-2">Account Title</th>
                          <th className="text-left py-1.5 px-2">Line Memo</th>
                          <th className="text-right py-1.5 px-2">Debit (৳)</th>
                          <th className="text-right py-1.5 px-2">Credit (৳)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20 font-mono">
                        {j.lines?.map((line, idx) => (
                          <tr key={idx} className="hover:bg-muted/20">
                            <td className="py-2 px-2 text-foreground font-medium">
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                {line.accountCode}
                              </span>{" "}
                              - {line.accountName}
                            </td>
                            <td className="py-2 px-2 text-muted-foreground font-sans text-[11px]">
                              {line.memo || line.description || "-"}
                            </td>
                            <td className="py-2 px-2 text-right font-bold text-foreground tabular-nums">
                              {line.debit > 0 ? `৳${Number(line.debit).toFixed(2)}` : "-"}
                            </td>
                            <td className="py-2 px-2 text-right font-bold text-foreground tabular-nums">
                              {line.credit > 0 ? `৳${Number(line.credit).toFixed(2)}` : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
