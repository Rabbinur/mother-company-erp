"use client";

import React, { useState, useEffect, useCallback } from "react";
import { GrnHeader } from "@/components/grn/GrnHeader";
import { GrnHistoryTable, GrnSummary } from "@/components/grn/GrnHistoryTable";
import { Search, Filter } from "lucide-react";

export default function GrnListPage() {
  const [grns, setGrns] = useState<GrnSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [canViewCost, setCanViewCost] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchGrns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await fetch(`/api/v1/grn?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.data) {
        setGrns(data.data.grns || []);
        setCanViewCost(data.data.canViewCost ?? true);
      }
    } catch (err) {
      console.error("Error loading GRNs:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    fetchGrns();
  }, [fetchGrns]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <GrnHeader
        title="Goods Receipt Notes (GRN)"
        subtitle="Manage supplier challans, physical stock verification, and landed cost batches."
        onRefresh={fetchGrns}
        loading={loading}
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-5">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-400" />
          <input
            type="text"
            placeholder="Search GRN #, Challan #, Invoice #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-500 font-mono"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-zinc-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="NEEDS_REVIEW">Needs Review</option>
            <option value="READY_FOR_CONFIRMATION">Ready for Confirmation</option>
            <option value="VERIFIED">Verified</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      <GrnHistoryTable
        grns={grns}
        loading={loading}
        canViewCost={canViewCost}
      />
    </div>
  );
}
