"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Package,
  Users,
  Award,
  Truck,
  LineChart,
  AlertCircle,
} from "lucide-react";
import {
  AnalyticsTab,
  AnalyticsFilterState,
  DealershipOption,
  PrincipalCompanyOption,
} from "@/components/analytics/types";
import {
  AnalyticsHeader,
  ProductIntelligenceTab,
  CustomerIntelligenceTab,
  SalesmanPerformanceTab,
  SupplierIntelligenceTab,
  DemandForecastTab,
} from "@/components/analytics";
import type { OperationalAnalyticsPayload } from "@/services/analytics/types";

export default function OperationalAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("products");
  const [filters, setFilters] = useState<AnalyticsFilterState>({
    preset: "last_30_days",
  });

  const [data, setData] = useState<OperationalAnalyticsPayload | null>(null);
  const [dealerships, setDealerships] = useState<DealershipOption[]>([]);
  const [principalCompanies, setPrincipalCompanies] = useState<PrincipalCompanyOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDealerships() {
      try {
        const res = await fetch("/api/v1/dealerships");
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setDealerships(json.data);
          }
        }
      } catch (e) {
        console.warn("Failed to load dealerships:", e);
      }
    }
    loadDealerships();
  }, []);

  const fetchAnalyticsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters.preset) params.set("period", filters.preset);
      if (filters.startDate) params.set("startDate", filters.startDate);
      if (filters.endDate) params.set("endDate", filters.endDate);
      if (filters.dealershipId) params.set("dealershipId", filters.dealershipId);
      if (filters.principalCompanyId) params.set("principalCompanyId", filters.principalCompanyId);

      const res = await fetch(`/api/v1/analytics/operational?${params.toString()}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Server error (${res.status})`);
      }

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || "Failed to load operational analytics");
      }

      setData(json.data);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred while loading analytics");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  const canViewCosts = true; // Secured server-side by API route

  return (
    <div className="space-y-6 pb-12">
      <AnalyticsHeader
        filters={filters}
        onFilterChange={setFilters}
        dealerships={dealerships}
        principalCompanies={principalCompanies}
        onRefresh={fetchAnalyticsData}
        loading={loading}
        dateRange={data?.filterScope}
      />

      {/* Domain Navigation Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex flex-wrap space-x-2 sm:space-x-4">
          <button
            onClick={() => setActiveTab("products")}
            className={`inline-flex items-center gap-2 border-b-2 py-3 px-3 text-xs font-semibold transition-colors ${
              activeTab === "products"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            <Package className="h-4 w-4" />
            <span>Product Intelligence</span>
          </button>

          <button
            onClick={() => setActiveTab("customers")}
            className={`inline-flex items-center gap-2 border-b-2 py-3 px-3 text-xs font-semibold transition-colors ${
              activeTab === "customers"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Customer Intelligence</span>
          </button>

          <button
            onClick={() => setActiveTab("salesmen")}
            className={`inline-flex items-center gap-2 border-b-2 py-3 px-3 text-xs font-semibold transition-colors ${
              activeTab === "salesmen"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            <Award className="h-4 w-4" />
            <span>Salesman Performance</span>
          </button>

          <button
            onClick={() => setActiveTab("suppliers")}
            className={`inline-flex items-center gap-2 border-b-2 py-3 px-3 text-xs font-semibold transition-colors ${
              activeTab === "suppliers"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            <Truck className="h-4 w-4" />
            <span>Supplier Intelligence</span>
          </button>

          <button
            onClick={() => setActiveTab("demand")}
            className={`inline-flex items-center gap-2 border-b-2 py-3 px-3 text-xs font-semibold transition-colors ${
              activeTab === "demand"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            <LineChart className="h-4 w-4" />
            <span>Demand & Reorder Radar</span>
          </button>
        </nav>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchAnalyticsData}
            className="rounded-md bg-white px-2.5 py-1 font-semibold text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {loading && !data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-pulse">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-slate-100 border border-slate-200" />
          ))}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {activeTab === "products" && (
            <ProductIntelligenceTab
              products={data.productIntelligence.products}
              fastMoving={data.productIntelligence.fastMoving}
              slowMoving={data.productIntelligence.slowMoving}
              topReturnRates={data.productIntelligence.topReturnRates}
              canViewCosts={canViewCosts}
            />
          )}

          {activeTab === "customers" && (
            <CustomerIntelligenceTab
              customers={data.customerIntelligence.customers}
              segmentCounts={data.customerIntelligence.segmentCounts}
              inactiveCustomers={data.customerIntelligence.inactiveCustomers}
              highCreditRisk={data.customerIntelligence.highCreditRisk}
            />
          )}

          {activeTab === "salesmen" && (
            <SalesmanPerformanceTab
              salesmen={data.salesmanPerformance.salesmen}
              topPerformers={data.salesmanPerformance.topPerformers}
            />
          )}

          {activeTab === "suppliers" && (
            <SupplierIntelligenceTab
              suppliers={data.supplierIntelligence.suppliers}
              principalComparisons={data.supplierIntelligence.principalComparisons}
              canViewCosts={canViewCosts}
            />
          )}

          {activeTab === "demand" && (
            <DemandForecastTab
              forecasts={data.demandIntelligence.forecasts}
              reorderAlerts={data.demandIntelligence.reorderAlerts}
            />
          )}
        </div>
      )}
    </div>
  );
}
