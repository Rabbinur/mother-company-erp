"use client";

import React from "react";
import {
  Calendar,
  Building,
  RotateCw,
  Building2,
  SlidersHorizontal,
} from "lucide-react";
import {
  DashboardFilterState,
  DateRangePreset,
  DealershipOption,
  PrincipalCompanyOption,
} from "./types";
import { formatShortDate } from "@/lib/utils";

interface DashboardHeaderProps {
  filters: DashboardFilterState;
  onFilterChange: (filters: DashboardFilterState) => void;
  dealerships: DealershipOption[];
  principalCompanies: PrincipalCompanyOption[];
  onRefresh: () => void;
  loading: boolean;
  isConsolidated: boolean;
  activeDealershipName?: string;
  dateRange?: {
    startDate: string | Date;
    endDate: string | Date;
    priorStartDate: string | Date;
    priorEndDate: string | Date;
  };
}

const PRESET_OPTIONS: Array<{ label: string; value: DateRangePreset }> = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "Last 7 Days", value: "last_7_days" },
  { label: "Last 30 Days", value: "last_30_days" },
  { label: "This Month", value: "this_month" },
  { label: "Previous Month", value: "previous_month" },
  { label: "Custom Range", value: "custom" },
];

export function DashboardHeader({
  filters,
  onFilterChange,
  dealerships,
  principalCompanies,
  onRefresh,
  loading,
  isConsolidated,
  activeDealershipName,
  dateRange,
}: DashboardHeaderProps) {
  const handlePresetSelect = (preset: DateRangePreset) => {
    onFilterChange({
      ...filters,
      preset,
    });
  };

  const handleDealershipChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    onFilterChange({
      ...filters,
      dealershipId: val === "all" ? undefined : val,
    });
  };

  const handlePrincipalChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    onFilterChange({
      ...filters,
      principalCompanyId: val === "all" ? undefined : val,
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Title & Status Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Executive Business Analytics
            </h1>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                isConsolidated
                  ? "bg-purple-50 text-purple-700 ring-1 ring-purple-600/20"
                  : "bg-sky-50 text-sky-700 ring-1 ring-sky-600/20"
              }`}
            >
              {isConsolidated
                ? "Consolidated Business View"
                : activeDealershipName || "Branch View"}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time business intelligence, financial ledgers, inventory valuation, and branch KPIs
          </p>
        </div>

        {/* Date Window Summary & Refresh Action */}
        <div className="flex items-center gap-3">
          {dateRange && (
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <span>
                {formatShortDate(dateRange.startDate)} – {formatShortDate(dateRange.endDate)}
              </span>
            </div>
          )}

          <button
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50 transition-colors"
            title="Refresh analytics data"
          >
            <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-primary" : "text-slate-500"}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <SlidersHorizontal className="h-4 w-4 text-slate-500" />
            <span>Filters:</span>
          </div>

          {/* Period Preset Dropdown */}
          <div className="flex-1 min-w-[140px] sm:max-w-[180px]">
            <select
              value={filters.preset}
              onChange={(e) => handlePresetSelect(e.target.value as DateRangePreset)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 shadow-xs focus:border-primary focus:outline-none"
            >
              {PRESET_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Dealership Filter */}
          <div className="flex-1 min-w-[170px] sm:max-w-[220px]">
            <div className="relative">
              <select
                value={filters.dealershipId || "all"}
                onChange={handleDealershipChange}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 shadow-xs focus:border-primary focus:outline-none"
              >
                <option value="all">🏢 All Dealerships (Consolidated)</option>
                {dealerships.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Principal Company Filter */}
          {principalCompanies.length > 0 && (
            <div className="flex-1 min-w-[170px] sm:max-w-[220px]">
              <select
                value={filters.principalCompanyId || "all"}
                onChange={handlePrincipalChange}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 shadow-xs focus:border-primary focus:outline-none"
              >
                <option value="all">🏭 All Principal Companies</option>
                {principalCompanies.map((pc) => (
                  <option key={pc._id} value={pc._id}>
                    {pc.name} ({pc.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Custom Date Inputs (when preset === 'custom') */}
          {filters.preset === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={filters.startDate || ""}
                onChange={(e) => onFilterChange({ ...filters, startDate: e.target.value })}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 shadow-xs"
                placeholder="Start Date"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={filters.endDate || ""}
                onChange={(e) => onFilterChange({ ...filters, endDate: e.target.value })}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 shadow-xs"
                placeholder="End Date"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
