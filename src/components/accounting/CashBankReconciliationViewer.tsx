"use client";

import React, { useState } from "react";
import { formatShortDate } from "@/lib/utils";
import { Landmark, Wallet, Building2, CheckCircle2, ShieldAlert, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { CashBankReconciliationResult, CashBankAccountReconciliationItem } from "./types";

interface CashBankReconciliationViewerProps {
  data: CashBankReconciliationResult | null;
  isLoading?: boolean;
  onRecordReconciliation?: (accountId: string, statementEndingBalance: number, notes?: string) => Promise<void>;
}

export function CashBankReconciliationViewer({
  data,
  isLoading,
  onRecordReconciliation,
}: CashBankReconciliationViewerProps) {
  const [selectedAccount, setSelectedAccount] = useState<CashBankAccountReconciliationItem | null>(null);
  const [statementBalanceInput, setStatementBalanceInput] = useState<string>("");
  const [notesInput, setNotesInput] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-12 text-center text-xs text-muted-foreground">
        Loading Cash & Bank Reconciliation statements...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-12 text-center text-xs text-muted-foreground">
        No treasury reconciliation data available.
      </div>
    );
  }

  const { summary, sharedTreasury, dealershipTreasury } = data;

  const handleOpenReconcileModal = (acc: CashBankAccountReconciliationItem) => {
    setSelectedAccount(acc);
    setStatementBalanceInput(acc.statementEndingBalance !== undefined ? String(acc.statementEndingBalance) : String(acc.closingBalance));
    setNotesInput("");
    setSubmitError(null);
  };

  const handleSubmitReconciliation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount || !onRecordReconciliation) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const balanceNum = parseFloat(statementBalanceInput);
      if (isNaN(balanceNum)) throw new Error("Please enter a valid ending balance.");
      await onRecordReconciliation(selectedAccount.accountId, balanceNum, notesInput);
      setSelectedAccount(null);
    } catch (err: any) {
      setSubmitError(err.message || "Failed to record reconciliation statement.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderAccountRow = (acc: CashBankAccountReconciliationItem) => {
    const isReconciled = acc.reconciliationStatus === "RECONCILED";
    const hasDiscrepancy = acc.reconciliationStatus === "DISCREPANCY";

    return (
      <tr key={acc.accountId} className="hover:bg-muted/20">
        <td className="py-2.5 px-3 font-mono font-bold text-foreground">
          {acc.accountCode}
        </td>
        <td className="py-2.5 px-3 font-sans">
          <span className="font-semibold text-foreground block">{acc.accountName}</span>
          <span className="text-[10px] text-muted-foreground">
            {acc.subType || acc.category} • {acc.currency || "BDT"}
          </span>
        </td>
        <td className="py-2.5 px-3 font-sans text-muted-foreground text-[11px]">
          {acc.isSharedTreasury ? (
            <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-[10px]">
              Business Shared
            </span>
          ) : (
            acc.dealershipName || "Dealership Operating"
          )}
        </td>
        <td className="py-2.5 px-3 text-right font-mono text-muted-foreground tabular-nums">
          ৳{acc.openingBalance.toFixed(2)}
        </td>
        <td className="py-2.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
          {acc.periodDebits > 0 ? `+৳${acc.periodDebits.toFixed(2)}` : "-"}
        </td>
        <td className="py-2.5 px-3 text-right font-mono text-rose-600 dark:text-rose-400 tabular-nums">
          {acc.periodCredits > 0 ? `-৳${acc.periodCredits.toFixed(2)}` : "-"}
        </td>
        <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground tabular-nums">
          ৳{acc.closingBalance.toFixed(2)}
        </td>
        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-muted-foreground">
          {acc.statementEndingBalance !== undefined ? `৳${acc.statementEndingBalance.toFixed(2)}` : "—"}
        </td>
        <td className="py-2.5 px-3 text-center">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
              isReconciled
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                : hasDiscrepancy
                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {isReconciled ? (
              <>
                <CheckCircle2 className="h-3 w-3" /> Reconciled
              </>
            ) : hasDiscrepancy ? (
              <>
                <ShieldAlert className="h-3 w-3" /> Diff: ৳{Math.abs(acc.discrepancy || 0).toFixed(2)}
              </>
            ) : (
              "Unverified"
            )}
          </span>
        </td>
        <td className="py-2.5 px-3 text-right">
          {onRecordReconciliation && (
            <button
              type="button"
              onClick={() => handleOpenReconcileModal(acc)}
              className="px-2.5 py-1 rounded text-[11px] font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition"
            >
              Verify / Reconcile
            </button>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-5">
      {/* 1. Treasury KPI Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border/50 bg-card p-4 shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Building2 className="h-4 w-4" />
            <span>Total Treasury Balance</span>
          </div>
          <span className="text-lg font-bold font-mono text-foreground tabular-nums">
            ৳{Number(summary.totalTreasury || 0).toFixed(2)}
          </span>
          <span className="text-[10px] text-muted-foreground block mt-1">
            Across All Cash, Bank & MFS Accounts
          </span>
        </div>

        <div className="rounded-xl border border-border/50 bg-card p-4 shadow-xs">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs mb-1">
            <Wallet className="h-4 w-4" />
            <span>Cash on Hand</span>
          </div>
          <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
            ৳{Number(summary.totalCashOnHand || 0).toFixed(2)}
          </span>
          <span className="text-[10px] text-muted-foreground block mt-1">GL Account 1010</span>
        </div>

        <div className="rounded-xl border border-border/50 bg-card p-4 shadow-xs">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-xs mb-1">
            <Landmark className="h-4 w-4" />
            <span>Bank Balances</span>
          </div>
          <span className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400 tabular-nums">
            ৳{Number(summary.totalBankBalances || 0).toFixed(2)}
          </span>
          <span className="text-[10px] text-muted-foreground block mt-1">GL Account 1020</span>
        </div>

        <div className="rounded-xl border border-border/50 bg-card p-4 shadow-xs">
          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 text-xs mb-1">
            <Wallet className="h-4 w-4" />
            <span>Mobile Financial (MFS)</span>
          </div>
          <span className="text-lg font-bold font-mono text-purple-600 dark:text-purple-400 tabular-nums">
            ৳{Number(summary.totalMfsBalances || 0).toFixed(2)}
          </span>
          <span className="text-[10px] text-muted-foreground block mt-1">bKash, Nagad, Rocket</span>
        </div>
      </div>

      {/* 2. Section: Business Shared Treasury */}
      <div className="rounded-xl border border-border/50 bg-card shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-border/30 pb-3">
          <div>
            <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-purple-500 inline-block" />
              Business Shared Treasury (Mother Company Accounts)
            </h3>
            <span className="text-[11px] text-muted-foreground">
              Central treasury accounts strictly preserved at business level (not attributed to or duplicated across individual dealerships).
            </span>
          </div>
          <span className="font-mono font-bold text-foreground text-xs tabular-nums">
            Closing Total: ৳{Number(sharedTreasury.totalClosing || 0).toFixed(2)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-border/40 bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              <tr>
                <th className="py-2.5 px-3 text-left">Code</th>
                <th className="py-2.5 px-3 text-left">Account Name</th>
                <th className="py-2.5 px-3 text-left">Scope</th>
                <th className="py-2.5 px-3 text-right">Opening</th>
                <th className="py-2.5 px-3 text-right">Debits (+)</th>
                <th className="py-2.5 px-3 text-right">Credits (-)</th>
                <th className="py-2.5 px-3 text-right">GL Closing</th>
                <th className="py-2.5 px-3 text-right">Statement Balance</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {sharedTreasury.accounts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-6 text-center text-muted-foreground font-sans">
                    No shared treasury accounts found.
                  </td>
                </tr>
              ) : (
                sharedTreasury.accounts.map(renderAccountRow)
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Section: Dealership Operating Treasury */}
      <div className="rounded-xl border border-border/50 bg-card shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-border/30 pb-3">
          <div>
            <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500 inline-block" />
              Dealership Operating Accounts
            </h3>
            <span className="text-[11px] text-muted-foreground">
              Local operating cash drawers and branch-specific depository accounts.
            </span>
          </div>
          <span className="font-mono font-bold text-foreground text-xs tabular-nums">
            Closing Total: ৳{Number(dealershipTreasury.totalClosing || 0).toFixed(2)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-border/40 bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              <tr>
                <th className="py-2.5 px-3 text-left">Code</th>
                <th className="py-2.5 px-3 text-left">Account Name</th>
                <th className="py-2.5 px-3 text-left">Scope</th>
                <th className="py-2.5 px-3 text-right">Opening</th>
                <th className="py-2.5 px-3 text-right">Debits (+)</th>
                <th className="py-2.5 px-3 text-right">Credits (-)</th>
                <th className="py-2.5 px-3 text-right">GL Closing</th>
                <th className="py-2.5 px-3 text-right">Statement Balance</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {dealershipTreasury.accounts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-6 text-center text-muted-foreground font-sans">
                    No dealership operating accounts found.
                  </td>
                </tr>
              ) : (
                dealershipTreasury.accounts.map(renderAccountRow)
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Verification / Reconciliation Modal */}
      {selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl space-y-4">
            <div className="border-b border-border/30 pb-3">
              <h3 className="font-bold text-foreground text-sm">
                Record Bank / Cash Reconciliation
              </h3>
              <span className="text-xs text-muted-foreground font-mono">
                {selectedAccount.accountCode} - {selectedAccount.accountName}
              </span>
            </div>

            <form onSubmit={handleSubmitReconciliation} className="space-y-3 text-xs">
              {submitError && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400">
                  {submitError}
                </div>
              )}

              <div className="p-3 rounded-lg bg-muted/40 font-mono space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GL Book Balance:</span>
                  <span className="font-bold text-foreground">৳{selectedAccount.closingBalance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Scope:</span>
                  <span>{selectedAccount.isSharedTreasury ? "Business Shared" : selectedAccount.dealershipName || "Dealership"}</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Statement Ending Balance (৳) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={statementBalanceInput}
                  onChange={(e) => setStatementBalanceInput(e.target.value)}
                  placeholder="e.g. 50000.00"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Reconciliation Notes / Remarks
                </label>
                <textarea
                  rows={2}
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder="e.g. Verified with bank statement for period end..."
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/30">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setSelectedAccount(null)}
                  className="px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition"
                >
                  {submitting ? "Saving..." : "Confirm & Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
