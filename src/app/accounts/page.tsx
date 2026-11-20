"use client";

import React, { useState, useEffect } from "react";
import { BookOpen, History, Layers, CheckCircle, ShieldCheck } from "lucide-react";
import { formatCurrency, formatShortDate, formatDate } from "@/lib/utils";

export default function AccountsPage() {
  const [tab, setTab] = useState<"chart" | "journal">("chart");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [journalEntries, setJournalEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [tab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      if (tab === "chart") {
        const res = await fetch("/api/v1/accounts");
        const json = await res.json();
        if (json.success) setAccounts(json.data || []);
      } else {
        const res = await fetch("/api/v1/accounts/journal");
        const json = await res.json();
        if (json.success) setJournalEntries(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Accounting & Double-Entry Ledger
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Chart of Accounts and immutable double-entry journal entries (Debit === Credit)
          </p>
        </div>

        <div className="flex rounded-lg border border-slate-200 bg-white p-1">
          <button
            onClick={() => setTab("chart")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              tab === "chart" ? "bg-primary text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Chart of Accounts
          </button>
          <button
            onClick={() => setTab("journal")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              tab === "journal" ? "bg-primary text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            General Ledger Journal Entries
          </button>
        </div>
      </div>

      {tab === "chart" ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Account Code</th>
                  <th className="px-4 py-3.5">Account Title</th>
                  <th className="px-4 py-3.5">Classification</th>
                  <th className="px-4 py-3.5">Sub-Type</th>
                  <th className="px-4 py-3.5">Current Balance (৳)</th>
                  <th className="px-4 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-xs text-slate-400">
                      Loading chart of accounts...
                    </td>
                  </tr>
                ) : accounts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-xs text-slate-400">
                      No accounts found.
                    </td>
                  </tr>
                ) : (
                  accounts.map((acc) => (
                    <tr key={acc._id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3.5 font-mono font-bold text-slate-900">
                        {acc.code}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-800">{acc.name}</td>
                      <td className="px-4 py-3.5 uppercase text-[10px] font-bold text-slate-600">
                        <span
                          className={`rounded px-1.5 py-0.5 ${
                            acc.type === "asset"
                              ? "bg-sky-50 text-sky-700"
                              : acc.type === "liability"
                              ? "bg-red-50 text-red-700"
                              : acc.type === "revenue"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-purple-50 text-purple-700"
                          }`}
                        >
                          {acc.type}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500">{acc.subType}</td>
                      <td className="px-4 py-3.5 font-bold text-slate-900 text-sm">
                        {formatCurrency(acc.balance)}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          {acc.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Journal Entries */
        <div className="space-y-4">
          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-400">
              Loading journal entries...
            </div>
          ) : journalEntries.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-400">
              No journal entries posted yet. All business transactions (orders, purchases, receipts) will generate balanced double-entry vouchers here.
            </div>
          ) : (
            journalEntries.map((entry) => (
              <div
                key={entry._id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3 gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-slate-900">
                      {entry.entryNumber}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 uppercase">
                      {entry.referenceType.replace(/_/g, " ")}: {entry.referenceId}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">{formatDate(entry.date)}</span>
                </div>

                <p className="text-xs text-slate-700 font-medium">{entry.narration}</p>

                {/* Voucher Lines */}
                <div className="rounded-lg border border-slate-100 bg-slate-50/50 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100/70 text-[10px] font-semibold uppercase text-slate-500">
                        <th className="py-2 px-3 text-left">Account Line</th>
                        <th className="py-2 px-3 text-right">Debit (৳)</th>
                        <th className="py-2 px-3 text-right">Credit (৳)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {entry.lines?.map((line: any, idx: number) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 text-slate-800">
                            <span className="font-semibold">{line.accountName}</span>{" "}
                            <span className="text-slate-400 text-[11px]">({line.accountCode})</span>
                            {line.description && (
                              <span className="block text-[10px] text-slate-500">
                                {line.description}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-medium text-slate-900">
                            {line.debit > 0 ? formatCurrency(line.debit) : "-"}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-medium text-slate-900">
                            {line.credit > 0 ? formatCurrency(line.credit) : "-"}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-100 font-bold border-t border-slate-200">
                        <td className="py-2 px-3 text-slate-700">Balanced Total</td>
                        <td className="py-2 px-3 text-right font-mono text-emerald-700">
                          {formatCurrency(entry.debitsTotal)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-emerald-700">
                          {formatCurrency(entry.creditsTotal)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
