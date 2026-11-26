"use client";

import React, { useState, useMemo } from "react";
import { Search, Filter, Layers } from "lucide-react";
import { AccountRow } from "./types";

interface ChartOfAccountsTableProps {
  accounts: AccountRow[];
  isLoading?: boolean;
}

export function ChartOfAccountsTable({
  accounts,
  isLoading = false,
}: ChartOfAccountsTableProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedScope, setSelectedScope] = useState<string>("ALL");

  const categories = [
    "ALL",
    "ASSET",
    "LIABILITY",
    "EQUITY",
    "REVENUE",
    "EXPENSE",
    "CONTRA_REVENUE",
  ];

  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      if (search) {
        const q = search.toLowerCase();
        const matchCode = acc.code.toLowerCase().includes(q);
        const matchName = acc.name.toLowerCase().includes(q);
        if (!matchCode && !matchName) return false;
      }

      if (selectedCategory !== "ALL") {
        const cat = acc.category || acc.type?.toUpperCase();
        if (cat !== selectedCategory) return false;
      }

      if (selectedScope === "SHARED" && acc.dealershipId) return false;
      if (selectedScope === "DEALERSHIP" && !acc.dealershipId) return false;

      return true;
    });
  }, [accounts, search, selectedCategory, selectedScope]);

  return (
    <div className="space-y-3">
      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card p-3 rounded-xl border border-border/50 text-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search code or account title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-input bg-background pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-muted-foreground font-medium">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-lg border border-input bg-background px-2.5 py-1 text-xs text-foreground"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === "ALL" ? "All Categories" : c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[11px] text-muted-foreground font-medium">Scope:</span>
            <select
              value={selectedScope}
              onChange={(e) => setSelectedScope(e.target.value)}
              className="rounded-lg border border-input bg-background px-2.5 py-1 text-xs text-foreground"
            >
              <option value="ALL">All Scopes</option>
              <option value="SHARED">Shared Treasury</option>
              <option value="DEALERSHIP">Dealership Isolated</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/50 bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border/40 bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Account Title</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Normal Balance</th>
                <th className="px-4 py-3">Treasury Scope</th>
                <th className="px-4 py-3 text-right">Current Balance (৳)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    Loading chart of accounts...
                  </td>
                </tr>
              ) : filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    No accounts match the current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((acc) => {
                  const cat = acc.category || acc.type?.toUpperCase();
                  return (
                    <tr key={acc._id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-foreground">
                        {acc.code}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">{acc.name}</span>
                        {acc.description && (
                          <span className="block text-[11px] text-muted-foreground truncate max-w-xs mt-0.5">
                            {acc.description}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                            cat === "ASSET"
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                              : cat === "LIABILITY"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                              : cat === "EQUITY"
                              ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                              : cat === "REVENUE"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              : cat === "CONTRA_REVENUE"
                              ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {cat}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                        {acc.normalBalance}
                      </td>
                      <td className="px-4 py-3">
                        {acc.dealershipId ? (
                          <span className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground font-medium border border-border/40">
                            Dealership
                          </span>
                        ) : (
                          <span className="rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 text-[10px] font-semibold border border-indigo-500/20">
                            Shared Treasury
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-foreground tabular-nums">
                        ৳{Number(acc.balance || 0).toLocaleString("en-BD", { minimumFractionDigits: 2 })}
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
