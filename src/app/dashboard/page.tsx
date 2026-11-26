"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Package,
  AlertCircle,
  RotateCw,
} from "lucide-react";
import {
  DashboardFilterState,
  DashboardTab,
  ExecutiveDashboardData,
  DealershipOption,
  PrincipalCompanyOption,
} from "@/components/dashboard/types";
import {
  DashboardHeader,
  BusinessOverviewSection,
  SalesAnalyticsSection,
  FinancialAnalyticsSection,
  InventoryAnalyticsSection,
} from "@/components/dashboard";

export default function ExecutiveDashboardPage() {
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [filters, setFilters] = useState<DashboardFilterState>({
    preset: "last_30_days",
  });

  const [data, setData] = useState<ExecutiveDashboardData | null>(null);
  const [dealerships, setDealerships] = useState<DealershipOption[]>([]);
  const [principalCompanies, setPrincipalCompanies] = useState<PrincipalCompanyOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load available dealerships for filtering
  useEffect(() => {
    async function loadOptions() {
      try {
        const dRes = await fetch("/api/v1/dealerships");
        if (dRes.ok) {
          const dJson = await dRes.json();
          if (dJson.success && Array.isArray(dJson.data)) {
            setDealerships(dJson.data);
          }
        }
      } catch (e) {
        console.warn("Failed to load dealership options:", e);
      }
    }
    loadOptions();
  }, []);

  // Fetch executive dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters.preset) params.set("period", filters.preset);
      if (filters.startDate) params.set("startDate", filters.startDate);
      if (filters.endDate) params.set("endDate", filters.endDate);
      if (filters.dealershipId) params.set("dealershipId", filters.dealershipId);
      if (filters.principalCompanyId) params.set("principalCompanyId", filters.principalCompanyId);

      const res = await fetch(`/api/v1/dashboard/executive?${params.toString()}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Server error (${res.status})`);
      }

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || "Failed to load executive analytics");
      }

      setData(json.data);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred while loading dashboard");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const activeDealership = dealerships.find((d) => d._id === filters.dealershipId);
  const isConsolidated = !filters.dealershipId;
  const canViewCosts = true; // Secured and masked server-side by the API route

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Global Filter Controls */}
      <DashboardHeader
        filters={filters}
        onFilterChange={setFilters}
        dealerships={dealerships}
        principalCompanies={principalCompanies}
        onRefresh={fetchDashboardData}
        loading={loading}
        isConsolidated={isConsolidated}
        activeDealershipName={activeDealership?.name}
        dateRange={data?.dateRange}
      />

      {/* Tab Navigation Navigation Bar */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-2 sm:space-x-4">
          <button
            onClick={() => setActiveTab("overview")}
            className={`inline-flex items-center gap-2 border-b-2 py-3 px-3 text-xs font-semibold transition-colors ${
              activeTab === "overview"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span>Overview & KPIs</span>
          </button>

          <button
            onClick={() => setActiveTab("sales")}
            className={`inline-flex items-center gap-2 border-b-2 py-3 px-3 text-xs font-semibold transition-colors ${
              activeTab === "sales"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            <span>Sales Analytics</span>
          </button>

          <button
            onClick={() => setActiveTab("financials")}
            className={`inline-flex items-center gap-2 border-b-2 py-3 px-3 text-xs font-semibold transition-colors ${
              activeTab === "financials"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            <DollarSign className="h-4 w-4" />
            <span>Financials & Treasury</span>
          </button>

          <button
            onClick={() => setActiveTab("inventory")}
            className={`inline-flex items-center gap-2 border-b-2 py-3 px-3 text-xs font-semibold transition-colors ${
              activeTab === "inventory"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            <Package className="h-4 w-4" />
            <span>Inventory & Batches</span>
          </button>
        </nav>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchDashboardData}
            className="rounded-md bg-white px-2.5 py-1 font-semibold text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-pulse">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-slate-100 border border-slate-200" />
          ))}
        </div>
      )}

      {/* Tab Panels Content */}
      {data && (
        <div className="space-y-6">
          {activeTab === "overview" && (
            <>
              <BusinessOverviewSection overview={data.overview} canViewCosts={canViewCosts} />
              <SalesAnalyticsSection sales={data.sales} canViewCosts={canViewCosts} />
            </>
          )}

          {activeTab === "sales" && (
            <SalesAnalyticsSection sales={data.sales} canViewCosts={canViewCosts} />
          )}

          {activeTab === "financials" && (
            <FinancialAnalyticsSection financials={data.financials} canViewCosts={canViewCosts} />
          )}

          {activeTab === "inventory" && (
            <InventoryAnalyticsSection inventory={data.inventory} canViewCosts={canViewCosts} />
          )}
        </div>
      )}
    </div>
  );
}
