"use client";

import React, { useState, useMemo } from "react";
import { formatShortDate } from "@/lib/utils";
import { Search, AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";
import { ArAgingReportResult } from "./types";

interface ArAgingReportViewerProps {
  data: ArAgingReportResult | null;
  isLoading?: boolean;
}

export function ArAgingReportViewer({ data, isLoading }: ArAgingReportViewerProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredCustomers = useMemo(() => {
    if (!data?.customers) return [];
    if (!searchTerm.trim()) return data.customers;
    const term = searchTerm.toLowerCase();
    return data.customers.filter(
      (c) =>
        c.customerName?.toLowerCase().includes(term) ||
        c.shopName?.toLowerCase().includes(term) ||
        c.phone?.includes(term) ||
        c.dealershipName?.toLowerCase().includes(term)
    );
  }, [data?.customers, searchTerm]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-12 text-center text-xs text-muted-foreground">
        Generating Accounts Receivable (AR) Aging Report...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-12 text-center text-xs text-muted-foreground">
        No accounts receivable data available.
      </div>
    );
  }

  const { summary, reconciliation } = data;

  return (
    <div className="space-y-4">
      {/* 1. Header & GL Reconciliation Banner */}
      <div className="rounded-xl border border-border/50 bg-card shadow-xs p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/30 pb-3">
          <div>
            <h3 className="font-bold text-foreground text-sm">Accounts Receivable (AR) Aging Analysis</h3>
            <span className="text-[11px] text-muted-foreground font-mono">
              As of {formatShortDate(data.asOfDate || new Date())} • {summary.customerCount} Active Customers
            </span>
          </div>

          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              reconciliation.isReconciled
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
            }`}
          >
            {reconciliation.isReconciled ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>Reconciled with GL ({reconciliation.glAccountCode})</span>
              </>
            ) : (
              <>
                <ShieldAlert className="h-4 w-4" />
                <span>
                  GL Discrepancy: ৳{Math.abs(reconciliation.discrepancy || 0).toFixed(2)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* 2. Aging KPI Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="bg-muted/40 p-3 rounded-lg border border-border/20">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
              Total Outstanding
            </span>
            <span className="text-sm font-bold font-mono text-foreground tabular-nums">
              ৳{Number(summary.totalReceivables || 0).toFixed(2)}
            </span>
          </div>
          <div className="bg-emerald-500/5 p-3 rounded-lg border border-emerald-500/20">
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400 block">
              Current (Not Due)
            </span>
            <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
              ৳{Number(summary.totalCurrent || 0).toFixed(2)}
            </span>
          </div>
          <div className="bg-blue-500/5 p-3 rounded-lg border border-blue-500/20">
            <span className="text-[10px] uppercase font-bold tracking-wider text-blue-600 dark:text-blue-400 block">
              1–30 Days
            </span>
            <span className="text-sm font-bold font-mono text-blue-600 dark:text-blue-400 tabular-nums">
              ৳{Number(summary.totalDays1_30 || 0).toFixed(2)}
            </span>
          </div>
          <div className="bg-amber-500/5 p-3 rounded-lg border border-amber-500/20">
            <span className="text-[10px] uppercase font-bold tracking-wider text-amber-600 dark:text-amber-400 block">
              31–60 Days
            </span>
            <span className="text-sm font-bold font-mono text-amber-600 dark:text-amber-400 tabular-nums">
              ৳{Number(summary.totalDays31_60 || 0).toFixed(2)}
            </span>
          </div>
          <div className="bg-orange-500/5 p-3 rounded-lg border border-orange-500/20">
            <span className="text-[10px] uppercase font-bold tracking-wider text-orange-600 dark:text-orange-400 block">
              61–90 Days
            </span>
            <span className="text-sm font-bold font-mono text-orange-600 dark:text-orange-400 tabular-nums">
              ৳{Number(summary.totalDays61_90 || 0).toFixed(2)}
            </span>
          </div>
          <div className="bg-rose-500/5 p-3 rounded-lg border border-rose-500/20">
            <span className="text-[10px] uppercase font-bold tracking-wider text-rose-600 dark:text-rose-400 block">
              90+ Days (Critical)
            </span>
            <span className="text-sm font-bold font-mono text-rose-600 dark:text-rose-400 tabular-nums">
              ৳{Number(summary.totalDays90Plus || 0).toFixed(2)}
            </span>
          </div>
        </div>

        {/* 3. Customer Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by customer name, shop name, phone or dealership..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* 4. Customer Aging Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-border/40 bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              <tr>
                <th className="py-2.5 px-3 text-left">Customer</th>
                <th className="py-2.5 px-3 text-left">Dealership</th>
                <th className="py-2.5 px-3 text-right">Credit Limit</th>
                <th className="py-2.5 px-3 text-right">Balance (৳)</th>
                <th className="py-2.5 px-3 text-right">Current</th>
                <th className="py-2.5 px-3 text-right">1–30 D</th>
                <th className="py-2.5 px-3 text-right">31–60 D</th>
                <th className="py-2.5 px-3 text-right">61–90 D</th>
                <th className="py-2.5 px-3 text-right">90+ D</th>
                <th className="py-2.5 px-3 text-center">Unpaid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20 font-mono">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-6 text-center text-muted-foreground font-sans">
                    No customers found matching the search criteria.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => (
                  <tr key={`${c.customerId}-${c.dealershipId}`} className="hover:bg-muted/20">
                    <td className="py-2 px-3 font-sans">
                      <span className="font-semibold text-foreground block">{c.customerName}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {c.shopName ? `${c.shopName} • ` : ""}
                        {c.phone || "No phone"}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-sans text-muted-foreground text-[11px]">
                      {c.dealershipName || "Central"}
                    </td>
                    <td className="py-2 px-3 text-right text-muted-foreground tabular-nums">
                      {c.creditLimit > 0 ? `৳${c.creditLimit.toFixed(2)}` : "None"}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-foreground tabular-nums">
                      ৳{c.currentBalance.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {c.current > 0 ? `৳${c.current.toFixed(2)}` : "-"}
                    </td>
                    <td className="py-2 px-3 text-right text-blue-600 dark:text-blue-400 tabular-nums">
                      {c.days1_30 > 0 ? `৳${c.days1_30.toFixed(2)}` : "-"}
                    </td>
                    <td className="py-2 px-3 text-right text-amber-600 dark:text-amber-400 tabular-nums">
                      {c.days31_60 > 0 ? `৳${c.days31_60.toFixed(2)}` : "-"}
                    </td>
                    <td className="py-2 px-3 text-right text-orange-600 dark:text-orange-400 tabular-nums">
                      {c.days61_90 > 0 ? `৳${c.days61_90.toFixed(2)}` : "-"}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                      {c.days90Plus > 0 ? `৳${c.days90Plus.toFixed(2)}` : "-"}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground">
                        {c.unpaidOrdersCount}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="border-t-2 border-foreground font-mono font-bold bg-muted/30 text-xs">
              <tr>
                <td colSpan={3} className="py-3 px-3 font-sans">
                  Total Receivables
                </td>
                <td className="py-3 px-3 text-right text-foreground tabular-nums">
                  ৳{Number(summary.totalReceivables || 0).toFixed(2)}
                </td>
                <td className="py-3 px-3 text-right text-emerald-600 dark:text-emerald-400 tabular-nums">
                  ৳{Number(summary.totalCurrent || 0).toFixed(2)}
                </td>
                <td className="py-3 px-3 text-right text-blue-600 dark:text-blue-400 tabular-nums">
                  ৳{Number(summary.totalDays1_30 || 0).toFixed(2)}
                </td>
                <td className="py-3 px-3 text-right text-amber-600 dark:text-amber-400 tabular-nums">
                  ৳{Number(summary.totalDays31_60 || 0).toFixed(2)}
                </td>
                <td className="py-3 px-3 text-right text-orange-600 dark:text-orange-400 tabular-nums">
                  ৳{Number(summary.totalDays61_90 || 0).toFixed(2)}
                </td>
                <td className="py-3 px-3 text-right text-rose-600 dark:text-rose-400 tabular-nums">
                  ৳{Number(summary.totalDays90Plus || 0).toFixed(2)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
