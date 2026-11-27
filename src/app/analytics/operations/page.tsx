"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Truck, RotateCcw, AlertCircle, ArrowLeft, LayoutDashboard, FileText, Printer } from "lucide-react";
import type { OperationalIntelligencePayload, DeliveryReportPayload } from "@/services/analytics/operational/types";
import {
  OperationalOverviewCards,
  DeliveryPerformanceSection,
  VehicleTripSection,
  WarehouseOperationsSection,
  WorkerIntelligenceSection,
  OperationalCostSection,
  BottlenecksRecommendationsSection,
} from "@/components/analytics/operational";
import {
  ReportDateFilterBar,
  GeneralOperationalReport,
  DeliveryPrintReport,
} from "@/components/analytics/operational/reports";

type ViewTab = "dashboard" | "general_report" | "delivery_report";

export default function OperationalAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<ViewTab>("dashboard");
  const [data, setData] = useState<OperationalIntelligencePayload | null>(null);
  const [deliveryReportData, setDeliveryReportData] = useState<DeliveryReportPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [periodPreset, setPeriodPreset] = useState<string>("last_30_days");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [dealershipId, setDealershipId] = useState<string>("all");
  const [dealerships, setDealerships] = useState<Array<{ _id: string; name: string }>>([]);

  useEffect(() => {
    async function loadMeta() {
      try {
        const res = await fetch("/api/v1/dealerships");
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) setDealerships(json.data);
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
        domain: activeTab === "delivery_report" ? "delivery_report" : "operations",
      });

      if (startDate && endDate) {
        params.set("startDate", startDate);
        params.set("endDate", endDate);
      } else {
        params.set("period", periodPreset);
      }

      if (dealershipId !== "all") params.set("dealershipId", dealershipId);

      const res = await fetch(`/api/v1/analytics/operational?${params.toString()}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Failed to fetch operational data (${res.status})`);
      }

      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Failed to load operational analytics");

      if (activeTab === "delivery_report") {
        setDeliveryReportData(json.data);
      } else {
        setData(json.data);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while fetching operational analytics");
    } finally {
      setLoading(false);
    }
  }, [activeTab, periodPreset, startDate, endDate, dealershipId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const selectedDealershipName = dealerships.find((d) => d._id === dealershipId)?.name;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto pb-16">
      {/* Top Header - Hidden in Print */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/analytics" className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Commercial Analytics
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-xs font-semibold text-primary">Operations & Logistics</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Truck className="w-6 h-6 text-primary" /> Operational Intelligence & Reports
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Physical logistics, stop-level delivery fulfillment, warehouse flow, worker handling, and print-ready reports.
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center bg-muted p-1 rounded-xl border border-border">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors ${
              activeTab === "dashboard" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab("general_report")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors ${
              activeTab === "general_report" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>General Report</span>
          </button>
          <button
            onClick={() => setActiveTab("delivery_report")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors ${
              activeTab === "delivery_report" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Delivery Report</span>
          </button>
        </div>
      </div>

      {/* Report Custom Date Range Filter Bar (When in Report Modes) */}
      {activeTab !== "dashboard" && (
        <ReportDateFilterBar
          startDate={startDate}
          endDate={endDate}
          dealershipId={dealershipId}
          dealerships={dealerships}
          loading={loading}
          reportLabel={activeTab === "delivery_report" ? "Delivery Report" : "General Operational Report"}
          onApply={({ startDate: s, endDate: e, dealershipId: d }) => {
            setStartDate(s);
            setEndDate(e);
            setDealershipId(d);
          }}
          onReset={() => {
            setStartDate("");
            setEndDate("");
            setDealershipId("all");
            setPeriodPreset("last_30_days");
          }}
          onPrint={() => window.print()}
        />
      )}

      {/* Global Filter Bar (Dashboard Mode only) */}
      {activeTab === "dashboard" && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border rounded-xl p-3 shadow-xs print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={periodPreset}
              onChange={(e) => {
                setPeriodPreset(e.target.value);
                setStartDate("");
                setEndDate("");
              }}
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
              className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground min-w-[140px]"
            >
              <option value="all">All Dealerships</option>
              {dealerships.map((d) => (
                <option key={d._id} value={d._id}>{d.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh"
          >
            <RotateCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 print:hidden">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button onClick={() => fetchData()} className="ml-auto underline font-medium">Retry</button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !data && !deliveryReportData && (
        <div className="space-y-4 print:hidden">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
          <div className="h-64 rounded-xl bg-muted/30 animate-pulse" />
        </div>
      )}

      {/* View 1: Interactive Dashboard */}
      {activeTab === "dashboard" && data && (
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

      {/* View 2: General Operational Report */}
      {activeTab === "general_report" && data && (
        <GeneralOperationalReport
          data={data}
          dealershipName={selectedDealershipName}
          startDate={startDate}
          endDate={endDate}
        />
      )}

      {/* View 3: Dedicated Delivery Print Report */}
      {activeTab === "delivery_report" && deliveryReportData && (
        <DeliveryPrintReport
          data={deliveryReportData}
          dealershipName={selectedDealershipName}
          startDate={startDate}
          endDate={endDate}
        />
      )}
    </div>
  );
}
