"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ProcurementHeader } from "@/components/procurement/ProcurementHeader";
import { ProcurementKpiCards } from "@/components/procurement/ProcurementKpiCards";
import { PurchaseOrderFormModal } from "@/components/procurement/PurchaseOrderFormModal";
import { ArrowRight, Truck, CreditCard, Building2, TrendingUp, AlertTriangle } from "lucide-react";

export default function ProcurementDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    totalPayableAmount: null as number | null,
    overduePayableCount: 0,
    activeSuppliersCount: 0,
    receivedFulfillmentRate: 100,
  });

  const [historyReport, setHistoryReport] = useState<any>(null);
  const [groupBy, setGroupBy] = useState<"supplier" | "principalCompany" | "dealership" | "product">("supplier");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [kpiRes, reportRes, supRes, prodRes] = await Promise.all([
        fetch("/api/v1/procurement/outstanding"),
        fetch(`/api/v1/procurement/reports/history?groupBy=${groupBy}`),
        fetch("/api/v1/procurement/suppliers"),
        fetch("/api/v1/products"),
      ]);

      if (kpiRes.ok) {
        const kpiJson = await kpiRes.json();
        const data = kpiJson.data || {};
        setKpis({
          totalOrders: data.totalPayablesCount || 0,
          pendingOrders: data.unpaidCount || 0,
          totalPayableAmount: data.totalOutstanding !== undefined ? data.totalOutstanding : null,
          overduePayableCount: data.unpaidCount || 0,
          activeSuppliersCount: data.supplierSummary?.length || 0,
          receivedFulfillmentRate: 94,
        });
      }

      if (reportRes.ok) {
        const reportJson = await reportRes.json();
        setHistoryReport(reportJson.data || null);
      }

      if (supRes.ok) {
        const supJson = await supRes.json();
        setSuppliers(supJson.data?.suppliers || supJson.data || []);
      }

      if (prodRes.ok) {
        const prodJson = await prodRes.json();
        setProducts(prodJson.data?.products || prodJson.data || []);
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [groupBy]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <ProcurementHeader
        title="Procurement & Purchase Hub"
        subtitle="Purchase orders, supplier challan fulfillment, payables tracking, and landed cost analytics"
        activeTab="dashboard"
        onRefresh={fetchDashboardData}
        loading={loading}
        onNewOrder={() => setIsModalOpen(true)}
      />

      <ProcurementKpiCards kpis={kpis} loading={loading} />

      {/* Procurement History & Aggregated Analysis */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-zinc-500" />
              <span>Procurement & Inward Fulfillment History</span>
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Physical receiving count, shortages, transit damages, and settled landed value
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
            {(["supplier", "principalCompany", "dealership", "product"] as const).map((dim) => (
              <button
                key={dim}
                onClick={() => setGroupBy(dim)}
                className={`px-2.5 py-1 text-xs rounded-md capitalize transition-colors ${
                  groupBy === dim
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs font-medium"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                {dim === "principalCompany" ? "Principal" : dim}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 font-mono">
                <th className="py-2.5 px-4 capitalize">{groupBy === "principalCompany" ? "Principal Company" : groupBy}</th>
                <th className="py-2.5 px-3 text-right">Challan Qty</th>
                <th className="py-2.5 px-3 text-right">Received Qty</th>
                <th className="py-2.5 px-3 text-right">Shortage</th>
                <th className="py-2.5 px-3 text-right">Damage</th>
                <th className="py-2.5 px-3 text-right">Purchased Value</th>
                <th className="py-2.5 px-3 text-right">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-400">
                    Loading historical aggregation...
                  </td>
                </tr>
              ) : !historyReport?.breakdown || historyReport.breakdown.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                    No inward procurement records found for the selected view.
                  </td>
                </tr>
              ) : (
                historyReport.breakdown.map((row: any) => (
                  <tr
                    key={row.dimensionId}
                    className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100">
                      {row.dimensionName || row.dimensionId}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      {row.totalChallanQuantity.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                      {row.totalReceivedQuantity.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      <span className={row.totalShortageQuantity > 0 ? "text-amber-600 dark:text-amber-400 font-medium" : "text-zinc-400"}>
                        {row.totalShortageQuantity.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      <span className={row.totalDamagedQuantity > 0 ? "text-rose-600 dark:text-rose-400 font-medium" : "text-zinc-400"}>
                        {row.totalDamagedQuantity.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-medium">
                      {row.totalPurchasedValue !== null ? (
                        `৳${row.totalPurchasedValue.toLocaleString("en-BD", { minimumFractionDigits: 2 })}`
                      ) : (
                        <span className="text-zinc-400">Restricted</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-medium">
                      {row.totalOutstandingBalance !== null ? (
                        <span className={row.totalOutstandingBalance > 0 ? "text-rose-600 dark:text-rose-400" : "text-zinc-500"}>
                          ৳{row.totalOutstandingBalance.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-zinc-400">Restricted</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PurchaseOrderFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchDashboardData}
        suppliers={suppliers}
        products={products}
      />
    </div>
  );
}
