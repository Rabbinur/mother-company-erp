"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import {
  AccountingTab,
  FinancialReportType,
  AccountRow,
  JournalEntryRow,
  AccountingPeriodRow,
  TrialBalanceData,
  ProfitLossData,
  BalanceSheetData,
  LedgerStatementData,
  ArAgingReportResult,
  ApAgingReportResult,
  CashBankReconciliationResult,
  AccountingHeader,
  AccountingKpiCards,
  ChartOfAccountsTable,
  JournalEntriesTable,
  AccountingPeriodsTable,
  FinancialReportsViewer,
  CreateJournalModal,
  CreatePeriodModal,
  CreateAccountModal,
  ReverseJournalModal,
} from "@/components/accounting";

export default function AccountingPage() {
  const [tab, setTab] = useState<AccountingTab>("overview");
  const [reportType, setReportType] = useState<FinancialReportType>("trial-balance");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Core Data States
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [journals, setJournals] = useState<JournalEntryRow[]>([]);
  const [periods, setPeriods] = useState<AccountingPeriodRow[]>([]);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceData | null>(null);
  const [profitLoss, setProfitLoss] = useState<ProfitLossData | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetData | null>(null);
  const [ledgerStatement, setLedgerStatement] = useState<LedgerStatementData | null>(null);
  const [arAging, setArAging] = useState<ArAgingReportResult | null>(null);
  const [apAging, setApAging] = useState<ApAgingReportResult | null>(null);
  const [cashBankRec, setCashBankRec] = useState<CashBankReconciliationResult | null>(null);
  const [selectedLedgerAccountId, setSelectedLedgerAccountId] = useState<string>("");

  // Modal Open States
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [reversalTarget, setReversalTarget] = useState<JournalEntryRow | null>(null);

  // Fetch Reports
  const fetchReports = useCallback(async (currentAccountId?: string) => {
    try {
      const accId = currentAccountId || selectedLedgerAccountId;

      if (reportType === "trial-balance" || tab === "overview") {
        const res = await fetch("/api/v1/accounting/reports/trial-balance");
        const json = await res.json();
        if (json.success) setTrialBalance(json.data);
      }

      if (reportType === "profit-loss" || tab === "overview") {
        const res = await fetch("/api/v1/accounting/reports/profit-loss");
        const json = await res.json();
        if (json.success) setProfitLoss(json.data);
      }

      if (reportType === "balance-sheet" || tab === "overview") {
        const res = await fetch("/api/v1/accounting/reports/balance-sheet");
        const json = await res.json();
        if (json.success) setBalanceSheet(json.data);
      }

      if (reportType === "ledger" && accId) {
        const res = await fetch(`/api/v1/accounting/reports/ledger?accountId=${accId}`);
        const json = await res.json();
        if (json.success) setLedgerStatement(json.data);
      }

      if (reportType === "ar-aging" || tab === "reports") {
        const res = await fetch("/api/v1/accounting/reports/ar-aging");
        const json = await res.json();
        if (json.success) setArAging(json.data);
      }

      if (reportType === "ap-aging" || tab === "reports") {
        const res = await fetch("/api/v1/accounting/reports/ap-aging");
        const json = await res.json();
        if (json.success) setApAging(json.data);
      }

      if (reportType === "cash-bank-reconciliation" || tab === "reports") {
        const res = await fetch("/api/v1/accounting/reports/cash-bank-reconciliation");
        const json = await res.json();
        if (json.success) setCashBankRec(json.data);
      }
    } catch (err: any) {
      console.error("Report fetch error:", err);
    }
  }, [reportType, tab, selectedLedgerAccountId]);

  // Main Data Fetcher
  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      if (tab === "overview" || tab === "chart" || tab === "journals" || tab === "reports") {
        const accRes = await fetch("/api/v1/accounting/accounts");
        const accJson = await accRes.json();
        if (accJson.success) {
          const list: AccountRow[] = accJson.data || [];
          setAccounts(list);
          if (!selectedLedgerAccountId && list[0]?._id) {
            setSelectedLedgerAccountId(list[0]._id);
            fetchReports(list[0]._id);
          }
        }
      }

      if (tab === "overview" || tab === "journals") {
        const jRes = await fetch("/api/v1/accounting/journals?limit=100");
        const jJson = await jRes.json();
        if (jJson.success) setJournals(jJson.data || []);
      }

      if (tab === "overview" || tab === "periods") {
        const pRes = await fetch("/api/v1/accounting/periods");
        const pJson = await pRes.json();
        if (pJson.success) setPeriods(pJson.data || []);
      }

      if (tab === "reports" || tab === "overview") {
        await fetchReports();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load accounting data");
    } finally {
      setLoading(false);
    }
  }, [tab, selectedLedgerAccountId, fetchReports]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // KPI Metrics Calculation
  const metrics = useMemo(() => {
    let assets = 0;
    let liabilities = 0;
    let equity = 0;
    let revenue = 0;
    let expense = 0;

    for (const acc of accounts) {
      const b = Number(acc.balance || 0);
      const cat = acc.category || (acc.type ? acc.type.toUpperCase() : "ASSET");
      if (cat === "ASSET") assets += b;
      else if (cat === "LIABILITY") liabilities += b;
      else if (cat === "EQUITY") equity += b;
      else if (cat === "REVENUE") revenue += b;
      else if (cat === "EXPENSE") expense += b;
      else if (cat === "CONTRA_REVENUE") revenue -= b;
    }

    const netProfit = revenue - expense;
    return { assets, liabilities, equity, revenue, expense, netProfit };
  }, [accounts]);

  // Action Handlers
  const handleCreateJournal = async (journalData: any) => {
    setLoading(true);
    const res = await fetch("/api/v1/accounting/journals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(journalData),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok || !json.success) {
      throw new Error(json.message || "Failed to post journal entry");
    }
    setSuccessMsg("Journal entry posted successfully!");
    fetchData();
  };

  const handleReverseJournal = async (journalId: string, reason: string) => {
    setLoading(true);
    const res = await fetch(`/api/v1/accounting/journals/${journalId}/reverse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok || !json.success) {
      throw new Error(json.message || "Failed to reverse journal entry");
    }
    setSuccessMsg("Journal entry reversed successfully.");
    fetchData();
  };

  const handleCreatePeriod = async (periodData: any) => {
    setLoading(true);
    const res = await fetch("/api/v1/accounting/periods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(periodData),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok || !json.success) {
      throw new Error(json.message || "Failed to create accounting period");
    }
    setSuccessMsg("Accounting period created.");
    fetchData();
  };

  const handleClosePeriod = async (periodId: string) => {
    if (!confirm("Are you sure you want to close this accounting period? All posting dates within this period will be locked.")) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/accounting/periods/${periodId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "Closed via accounting console" }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to close accounting period");
      }
      setSuccessMsg("Accounting period closed.");
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReopenPeriod = async (periodId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/accounting/periods/${periodId}/reopen`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to reopen accounting period");
      }
      setSuccessMsg("Accounting period reopened.");
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async (accountData: any) => {
    setLoading(true);
    const res = await fetch("/api/v1/accounting/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(accountData),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok || !json.success) {
      throw new Error(json.message || "Failed to create account");
    }
    setSuccessMsg("Account added to Chart of Accounts.");
    fetchData();
  };

  const handleSelectLedgerAccount = (accountId: string) => {
    setSelectedLedgerAccountId(accountId);
    fetchReports(accountId);
  };

  const handleRecordReconciliation = async (
    accountId: string,
    statementEndingBalance: number,
    notes?: string
  ) => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/accounting/reports/cash-bank-reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, statementEndingBalance, notes }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to record reconciliation statement");
      }
      setSuccessMsg("Reconciliation statement recorded successfully.");
      await fetchReports();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header with navigation tabs & primary action triggers */}
      <AccountingHeader
        activeTab={tab}
        onTabChange={setTab}
        onNewJournalClick={() => setShowJournalModal(true)}
        onNewPeriodClick={() => setShowPeriodModal(true)}
        onNewAccountClick={() => setShowAccountModal(true)}
        onRefresh={fetchData}
        isLoading={loading}
      />

      {/* Notifications */}
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-600 dark:text-rose-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="ml-auto font-bold">✕</button>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="ml-auto font-bold">✕</button>
        </div>
      )}

      {/* TAB 1: Financial Overview */}
      {tab === "overview" && (
        <AccountingKpiCards
          metrics={metrics}
          journalsCount={journals.length}
          openPeriodsCount={periods.filter((p) => p.status === "OPEN").length}
          closedPeriodsCount={periods.filter((p) => p.status === "CLOSED").length}
        />
      )}

      {/* TAB 2: Chart of Accounts */}
      {tab === "chart" && (
        <ChartOfAccountsTable
          accounts={accounts}
          isLoading={loading}
        />
      )}

      {/* TAB 3: Journal Entries */}
      {tab === "journals" && (
        <JournalEntriesTable
          journals={journals}
          isLoading={loading}
          onReverseClick={(j) => setReversalTarget(j)}
        />
      )}

      {/* TAB 4: Accounting Periods */}
      {tab === "periods" && (
        <AccountingPeriodsTable
          periods={periods}
          isLoading={loading}
          onClosePeriodClick={handleClosePeriod}
          onReopenPeriodClick={handleReopenPeriod}
        />
      )}

      {/* TAB 5: Financial Reports */}
      {tab === "reports" && (
        <FinancialReportsViewer
          reportType={reportType}
          onReportTypeChange={setReportType}
          trialBalance={trialBalance}
          profitLoss={profitLoss}
          balanceSheet={balanceSheet}
          ledgerStatement={ledgerStatement}
          arAging={arAging}
          apAging={apAging}
          cashBankReconciliation={cashBankRec}
          accounts={accounts}
          selectedLedgerAccountId={selectedLedgerAccountId}
          onSelectLedgerAccountId={handleSelectLedgerAccount}
          onRecordBankReconciliation={handleRecordReconciliation}
          isLoading={loading}
        />
      )}

      {/* Modals */}
      <CreateJournalModal
        isOpen={showJournalModal}
        onClose={() => setShowJournalModal(false)}
        accounts={accounts}
        onSubmit={handleCreateJournal}
        isLoading={loading}
      />

      <CreatePeriodModal
        isOpen={showPeriodModal}
        onClose={() => setShowPeriodModal(false)}
        onSubmit={handleCreatePeriod}
        isLoading={loading}
      />

      <CreateAccountModal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        onSubmit={handleCreateAccount}
        isLoading={loading}
      />

      <ReverseJournalModal
        journal={reversalTarget}
        onClose={() => setReversalTarget(null)}
        onConfirm={handleReverseJournal}
        isLoading={loading}
      />
    </div>
  );
}
