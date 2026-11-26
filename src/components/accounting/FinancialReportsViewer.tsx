"use client";

import React from "react";
import {
  FinancialReportType,
  TrialBalanceData,
  ProfitLossData,
  BalanceSheetData,
  LedgerStatementData,
  ArAgingReportResult,
  ApAgingReportResult,
  CashBankReconciliationResult,
  AccountRow,
} from "./types";
import { TrialBalanceViewer } from "./TrialBalanceViewer";
import { ProfitLossViewer } from "./ProfitLossViewer";
import { BalanceSheetViewer } from "./BalanceSheetViewer";
import { LedgerStatementViewer } from "./LedgerStatementViewer";
import { ArAgingReportViewer } from "./ArAgingReportViewer";
import { ApAgingReportViewer } from "./ApAgingReportViewer";
import { CashBankReconciliationViewer } from "./CashBankReconciliationViewer";

export interface FinancialReportsViewerProps {
  reportType: FinancialReportType;
  onReportTypeChange: (type: FinancialReportType) => void;
  trialBalance: TrialBalanceData | null;
  profitLoss: ProfitLossData | null;
  balanceSheet: BalanceSheetData | null;
  ledgerStatement: LedgerStatementData | null;
  arAging?: ArAgingReportResult | null;
  apAging?: ApAgingReportResult | null;
  cashBankReconciliation?: CashBankReconciliationResult | null;
  accounts: AccountRow[];
  selectedLedgerAccountId: string;
  onSelectLedgerAccountId: (id: string) => void;
  onRecordBankReconciliation?: (accountId: string, statementEndingBalance: number, notes?: string) => Promise<void>;
  isLoading?: boolean;
}

export function FinancialReportsViewer({
  reportType,
  onReportTypeChange,
  trialBalance,
  profitLoss,
  balanceSheet,
  ledgerStatement,
  arAging = null,
  apAging = null,
  cashBankReconciliation = null,
  accounts,
  selectedLedgerAccountId,
  onSelectLedgerAccountId,
  onRecordBankReconciliation,
  isLoading = false,
}: FinancialReportsViewerProps) {
  const reportTabs: Array<{ id: FinancialReportType; label: string }> = [
    { id: "trial-balance", label: "Trial Balance" },
    { id: "profit-loss", label: "Profit & Loss" },
    { id: "balance-sheet", label: "Balance Sheet" },
    { id: "ledger", label: "General Ledger" },
    { id: "ar-aging", label: "AR Aging" },
    { id: "ap-aging", label: "AP Aging" },
    { id: "cash-bank-reconciliation", label: "Cash & Bank Reconciliation" },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-Tabs for Reports */}
      <div className="flex flex-wrap border-b border-border/40 text-xs gap-1">
        {reportTabs.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onReportTypeChange(r.id)}
            className={`py-2 px-3 font-semibold border-b-2 transition ${
              reportType === r.id
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* 1. Trial Balance Report */}
      {reportType === "trial-balance" && (
        <TrialBalanceViewer data={trialBalance} isLoading={isLoading} />
      )}

      {/* 2. Profit & Loss Statement */}
      {reportType === "profit-loss" && (
        <ProfitLossViewer data={profitLoss} isLoading={isLoading} />
      )}

      {/* 3. Balance Sheet */}
      {reportType === "balance-sheet" && (
        <BalanceSheetViewer data={balanceSheet} isLoading={isLoading} />
      )}

      {/* 4. General Ledger Statement */}
      {reportType === "ledger" && (
        <LedgerStatementViewer
          data={ledgerStatement}
          accounts={accounts}
          selectedAccountId={selectedLedgerAccountId}
          onSelectAccountId={onSelectLedgerAccountId}
          isLoading={isLoading}
        />
      )}

      {/* 5. AR Aging Report */}
      {reportType === "ar-aging" && (
        <ArAgingReportViewer data={arAging} isLoading={isLoading} />
      )}

      {/* 6. AP Aging Report */}
      {reportType === "ap-aging" && (
        <ApAgingReportViewer data={apAging} isLoading={isLoading} />
      )}

      {/* 7. Cash & Bank Reconciliation */}
      {reportType === "cash-bank-reconciliation" && (
        <CashBankReconciliationViewer
          data={cashBankReconciliation}
          isLoading={isLoading}
          onRecordReconciliation={onRecordBankReconciliation}
        />
      )}
    </div>
  );
}
