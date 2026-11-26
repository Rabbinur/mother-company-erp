"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Truck, RotateCcw, AlertCircle, ArrowLeft, Building2, Calendar } from "lucide-react";
import type { OperationalIntelligencePayload } from "@/services/analytics/operational/types";
import {
  OperationalOverviewCards,
  DeliveryPerformanceSection,
  VehicleTripSection,
  WarehouseOperationsSection,
  WorkerIntelligenceSection,
  OperationalCostSection,
  BottlenecksRecommendationsSection,
} from "@/components/analytics/operational";

export default function OperationalAnalyticsPage() {
  const [data, setData] = useState<OperationalIntelligencePayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [periodPreset, setPeriodPreset] = useState<string>("last_30_days");
  const [dealershipId, setDealershipId] = useState<string>("all");
  const [principalCompanyId, setPrincipalCompanyId] = useState<string>("all");
  const [dealerships, setDealerships] = useState<Array<{ _id: string; name: string }>>([]);

  useEffect(() => {
    async function loadMeta() {
      try {
        const res = await fetch("/api/v1/dealerships");
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setDealerships(json.data);
          }
        }
      } catch (e) {
        console.warn("Failed to load dealerships metadata", e);
      }
    }
    loadMeta();
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        domain: "operations",
        period: periodPreset,
      });

      if (dealershipId !== "all") params.set("dealershipId", dealershipId);
      if (principalCompanyId !== "all") params.set("principalCompanyId", principalCompanyId);

      const res = await fetch(`/api/v1/analytics/operational?${params.toString()}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Failed to fetch operational data (${res.status})`);
      }

      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Failed to load operational analytics");

      setData(json.data);
    } catch (err: any) {
      setError(err.message || "An error occurred while fetching operational analytics");
    } finally {
      setLoading(false);
    }
  }, [periodPreset, dealershipId, principalCompanyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/analytics"
              className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Commercial Analytics
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-xs font-semibold text-primary">Operations & Logistics</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Truck className="w-6 h-6 text-primary" /> Operational Intelligence
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Physical logistics, stop-level delivery fulfillment, warehouse flow, worker handling, and operational costs.
          </p>
        </div>

        {/* Global Filter Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={periodPreset}
            onChange={(e) => setPeriodPreset(e.target.value)}
            className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground"
          >
            <option value="today">Today</option>
            <option value="last_7_days">Last 7 Days</option>
            <option value="last_30_days">Last 30 Days</option>
            <option value="this_month">This Month</option>
            <option value="all_time">All Time</option>
          </select>

          <select
            value={dealershipId}
            onChange={(e) => setDealershipId(e.target.value)}
            className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground"
          >
            <option value="all">All Dealerships</option>
            {dealerships.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh"
          >
            <RotateCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button onClick={() => fetchData()} className="ml-auto underline font-medium">Retry</button>
        </div>
      )}

      {/* Loading State */}
      {loading && !data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
          <div className="h-64 rounded-xl bg-muted/30 animate-pulse" />
        </div>
      )}

      {/* Loaded Content */}
      {data && (
        <div className="space-y-8">
          <OperationalOverviewCards data={data} />
          <BottlenecksRecommendationsSection recommendations={data.bottlenecksAndRecommendations} />
          <DeliveryPerformanceSection data={data.deliveryPerformance} />
          <VehicleTripSection data={data.vehicleTripAnalytics} />
          <WarehouseOperationsSection data={data.warehouseOperations} />
          <WorkerIntelligenceSection data={data.workerIntelligence} />
          <OperationalCostSection data={data.operationalCosts} />
        </div>
      )}
    </div>
  );
}
