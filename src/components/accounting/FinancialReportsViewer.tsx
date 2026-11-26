"use client";

import React from "react";
import { formatShortDate } from "@/lib/utils";
import {
  FinancialReportType,
  TrialBalanceData,
  ProfitLossData,
  BalanceSheetData,
  LedgerStatementData,
  AccountRow,
} from "./types";

interface FinancialReportsViewerProps {
  reportType: FinancialReportType;
  onReportTypeChange: (type: FinancialReportType) => void;
  trialBalance: TrialBalanceData | null;
  profitLoss: ProfitLossData | null;
  balanceSheet: BalanceSheetData | null;
  ledgerStatement: LedgerStatementData | null;
  accounts: AccountRow[];
  selectedLedgerAccountId: string;
  onSelectLedgerAccountId: (id: string) => void;
  isLoading?: boolean;
}

export function FinancialReportsViewer({
  reportType,
  onReportTypeChange,
  trialBalance,
  profitLoss,
  balanceSheet,
  ledgerStatement,
  accounts,
  selectedLedgerAccountId,
  onSelectLedgerAccountId,
  isLoading = false,
}: FinancialReportsViewerProps) {
  const reportTabs = [
    { id: "trial-balance" as const, label: "Trial Balance" },
    { id: "profit-loss" as const, label: "Profit & Loss Statement" },
    { id: "balance-sheet" as const, label: "Balance Sheet" },
    { id: "ledger" as const, label: "General Ledger Statement" },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-Tabs for Reports */}
      <div className="flex border-b border-border/40 text-xs">
        {reportTabs.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onReportTypeChange(r.id)}
            className={`py-2 px-4 font-semibold border-b-2 transition ${
              reportType === r.id
                ? "border-emerald-600 text-emerald-600 font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="rounded-xl border border-border/50 bg-card p-12 text-center text-xs text-muted-foreground">
          Generating financial statement...
        </div>
      )}

      {/* 1. Trial Balance Report */}
      {!isLoading && reportType === "trial-balance" && trialBalance && (
        <div className="rounded-xl border border-border/50 bg-card shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border/30 pb-3">
            <div>
              <h3 className="font-bold text-foreground text-sm">Trial Balance Statement</h3>
              <span className="text-[11px] text-muted-foreground font-mono">
                As of {formatShortDate(trialBalance.asOfDate || new Date())}
              </span>
            </div>
            <div
              className={`px-3 py-1 rounded-md text-xs font-bold ${
                trialBalance.isBalanced
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
              }`}
            >
              {trialBalance.isBalanced ? "✓ Balanced (Debits == Credits)" : "! Out of Balance"}
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
                {trialBalance.accounts?.map((row) => (
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
                    ৳{Number(trialBalance.totalDebits || 0).toFixed(2)}
                  </td>
                  <td className="py-3 px-3 text-right text-foreground tabular-nums">
                    ৳{Number(trialBalance.totalCredits || 0).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 2. Profit & Loss Statement */}
      {!isLoading && reportType === "profit-loss" && profitLoss && (
        <div className="rounded-xl border border-border/50 bg-card shadow-xs p-5 space-y-4">
          <div className="border-b border-border/30 pb-3">
            <h3 className="font-bold text-foreground text-sm">Statement of Profit & Loss (Income Statement)</h3>
            <span className="text-[11px] text-muted-foreground font-mono">
              Fiscal Interval: {formatShortDate(profitLoss.startDate || new Date())} to {formatShortDate(profitLoss.endDate || new Date())}
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
                  ৳{Number(profitLoss.grossRevenue || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/20 text-rose-600 dark:text-rose-400">
                <span className="font-sans">Less: Sales Returns & Allowances (4110)</span>
                <span className="font-bold tabular-nums">
                  (৳{Number(profitLoss.salesReturns || 0).toFixed(2)})
                </span>
              </div>
              <div className="flex justify-between py-1.5 font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                <span className="font-sans">Net Operating Revenue</span>
                <span className="tabular-nums">৳{Number(profitLoss.netRevenue || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* COGS Section */}
            <div className="bg-muted/30 p-3.5 rounded-lg space-y-1.5">
              <span className="text-muted-foreground font-sans font-semibold text-[11px] uppercase tracking-wider block">
                Cost of Goods Sold (COGS)
              </span>
              <div className="flex justify-between py-1 font-bold text-amber-600 dark:text-amber-400">
                <span className="font-sans">Direct Inventory Landed Cost (5010)</span>
                <span className="tabular-nums">৳{Number(profitLoss.costOfGoodsSold || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-t border-border/40 font-bold text-foreground text-sm">
                <span className="font-sans">Gross Profit</span>
                <span className="tabular-nums">৳{Number(profitLoss.grossProfit || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Operating Expenses Section */}
            <div className="bg-muted/30 p-3.5 rounded-lg space-y-1.5">
              <span className="text-muted-foreground font-sans font-semibold text-[11px] uppercase tracking-wider block">
                Operating Expenses
              </span>
              {profitLoss.operatingExpenses?.map((e) => (
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
                <span className="tabular-nums">৳{Number(profitLoss.totalOperatingExpenses || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Net Margin Card */}
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3.5 flex justify-between items-center text-sm font-bold">
              <span className="font-sans text-emerald-800 dark:text-emerald-300">
                Net Operating Profit / (Loss)
              </span>
              <span
                className={`text-base tabular-nums ${
                  profitLoss.netProfit >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                ৳{Number(profitLoss.netProfit || 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Balance Sheet */}
      {!isLoading && reportType === "balance-sheet" && balanceSheet && (
        <div className="rounded-xl border border-border/50 bg-card shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border/30 pb-3">
            <div>
              <h3 className="font-bold text-foreground text-sm">Consolidated Balance Sheet</h3>
              <span className="text-[11px] text-muted-foreground font-mono">
                As of {formatShortDate(balanceSheet.asOfDate || new Date())}
              </span>
            </div>
            <div
              className={`px-3 py-1 rounded-md text-xs font-bold ${
                balanceSheet.isBalanced
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
              }`}
            >
              {balanceSheet.isBalanced ? "✓ Balanced (Assets == Liabilities + Equity)" : "! Out of Balance"}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            {/* Assets Column */}
            <div className="bg-muted/30 p-3.5 rounded-lg space-y-2">
              <h4 className="font-sans font-bold text-foreground text-sm border-b border-border/30 pb-1.5">
                Assets
              </h4>
              {balanceSheet.assets?.lines?.map((line) => (
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
                <span className="tabular-nums">৳{Number(balanceSheet.totalAssets || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Liabilities & Equity Column */}
            <div className="space-y-3">
              <div className="bg-muted/30 p-3.5 rounded-lg space-y-2">
                <h4 className="font-sans font-bold text-foreground text-sm border-b border-border/30 pb-1.5">
                  Liabilities
                </h4>
                {balanceSheet.liabilities?.lines?.map((line) => (
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
                  <span className="tabular-nums">৳{Number(balanceSheet.totalLiabilities || 0).toFixed(2)}</span>
                </div>
              </div>

              <div className="bg-muted/30 p-3.5 rounded-lg space-y-2">
                <h4 className="font-sans font-bold text-foreground text-sm border-b border-border/30 pb-1.5">
                  Equity & Retained Earnings
                </h4>
                {balanceSheet.equity?.lines?.map((line) => (
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
                  <span className="tabular-nums">৳{Number(balanceSheet.totalLiabilitiesAndEquity || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Account Ledger Statement */}
      {!isLoading && reportType === "ledger" && (
        <div className="rounded-xl border border-border/50 bg-card shadow-xs p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3 border-b border-border/30 pb-3">
            <span className="text-xs font-semibold text-muted-foreground">
              Select General Ledger Account:
            </span>
            <select
              value={selectedLedgerAccountId}
              onChange={(e) => onSelectLedgerAccountId(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-mono text-foreground"
            >
              {accounts.map((acc) => (
                <option key={acc._id} value={acc._id}>
                  {acc.code} - {acc.name} ({acc.category})
                </option>
              ))}
            </select>
          </div>

          {ledgerStatement ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-muted/30 p-3 rounded-lg text-xs font-mono">
                <div>
                  <span className="font-sans text-muted-foreground block text-[11px]">Active Account</span>
                  <span className="font-bold text-foreground text-sm">
                    {ledgerStatement.account?.code} - {ledgerStatement.account?.name}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-sans text-muted-foreground block text-[11px]">Closing Running Balance</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm tabular-nums">
                    ৳{Number(ledgerStatement.closingBalance || 0).toFixed(2)}
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
                    {ledgerStatement.lines?.map((row, idx) => (
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
                          ৳{row.runningBalance.toFixed(2)}
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
      )}
    </div>
  );
}
