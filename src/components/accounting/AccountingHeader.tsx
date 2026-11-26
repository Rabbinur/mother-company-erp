"use client";

import React from "react";
import {
  Scale,
  BookOpen,
  FileText,
  Calendar,
  TrendingUp,
  Plus,
  RefreshCw,
} from "lucide-react";
import { AccountingTab } from "./types";

interface AccountingHeaderProps {
  activeTab: AccountingTab;
  onTabChange: (tab: AccountingTab) => void;
  onNewJournalClick: () => void;
  onNewPeriodClick: () => void;
  onNewAccountClick: () => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export function AccountingHeader({
  activeTab,
  onTabChange,
  onNewJournalClick,
  onNewPeriodClick,
  onNewAccountClick,
  onRefresh,
  isLoading = false,
}: AccountingHeaderProps) {
  const tabs = [
    { id: "overview" as const, label: "Overview", icon: Scale },
    { id: "chart" as const, label: "Chart of Accounts", icon: BookOpen },
    { id: "journals" as const, label: "Journal Entries", icon: FileText },
    { id: "periods" as const, label: "Accounting Periods", icon: Calendar },
    { id: "reports" as const, label: "Financial Reports", icon: TrendingUp },
  ];

  return (
    <div className="space-y-4">
      {/* Top Title & Actions Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                General Ledger & Financial Accounting
              </h1>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted font-medium text-muted-foreground border">
                Double-Entry Enforced
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Dealership books, shared treasury management, immutable posted journals, and consolidated reporting.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onNewJournalClick}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition"
          >
            <Plus className="h-3.5 w-3.5" />
            New Journal
          </button>
          <button
            onClick={onNewPeriodClick}
            className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/50 transition"
          >
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            New Period
          </button>
          <button
            onClick={onNewAccountClick}
            className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/50 transition"
          >
            <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
            New Account
          </button>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center justify-center rounded-lg border border-input bg-background p-2 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-emerald-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Segmented Tab Navigation */}
      <div className="flex border-b border-border/40">
        <nav className="flex space-x-6 overflow-x-auto pb-px">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onTabChange(t.id)}
                className={`flex items-center gap-2 border-b-2 py-2.5 px-1 text-xs font-medium whitespace-nowrap transition ${
                  active
                    ? "border-emerald-600 text-emerald-600 font-semibold"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
