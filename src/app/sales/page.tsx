"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { SalesHeader } from "@/components/sales/SalesHeader";
import { SalesKpiCards } from "@/components/sales/SalesKpiCards";
import { SalesOrderTable, SalesOrderRow } from "@/components/sales/SalesOrderTable";
import { SalesOrderFormModal } from "@/components/sales/SalesOrderFormModal";
import { ArrowRight, ShoppingCart, TrendingUp } from "lucide-react";

export default function SalesDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({
    totalOrders: 0,
    draftOrders: 0,
    confirmedOrders: 0,
    fulfilledOrders: 0,
    totalSalesValue: 0,
    fulfillmentRate: 100,
  });
  const [recentOrders, setRecentOrders] = useState<SalesOrderRow[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const [kpiRes, ordersRes, custRes, whRes] = await Promise.all([
        fetch("/api/v1/sales/dashboard"),
        fetch("/api/v1/sales/orders?limit=10"),
        fetch("/api/v1/customers"),
        fetch("/api/v1/warehouses"),
      ]);

      if (kpiRes.ok) {
        const json = await kpiRes.json();
        if (json.data) setKpis(json.data);
      }
      if (ordersRes.ok) {
        const json = await ordersRes.json();
        setRecentOrders(json.data || []);
      }
      if (custRes.ok) {
        const json = await custRes.json();
        setCustomers(json.data?.customers || json.data || []);
      }
      if (whRes.ok) {
        const json = await whRes.json();
        setWarehouses(json.data?.warehouses || json.data || []);
      }
    } catch (err) {
      console.error("Sales dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleConfirmOrder = async (orderId: string) => {
    if (!confirm("Confirm this sales order and reserve inventory?")) return;
    try {
      const res = await fetch(`/api/v1/sales/orders/${orderId}/confirm`, { method: "POST" });
      if (res.ok) fetchDashboard();
      else {
        const j = await res.json();
        alert(j.error || "Failed to confirm order");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <SalesHeader
        title="Sales & Order Hub"
        subtitle="Manage retailer draft bookings, stock reservations, credit terms, and fulfillment"
        activeTab="dashboard"
        onRefresh={fetchDashboard}
        loading={loading}
        onNewOrder={() => setIsModalOpen(true)}
      />

      <SalesKpiCards kpis={kpis} loading={loading} />

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <ShoppingCart className="w-4 h-4 text-zinc-500" />
              <span>Recent Sales Bookings</span>
            </h2>
            <p className="text-xs text-zinc-500">Latest orders placed across retail customers</p>
          </div>
          <Link
            href="/sales/orders"
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            <span>View all orders</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <SalesOrderTable
          orders={recentOrders}
          loading={loading}
          onConfirmOrder={handleConfirmOrder}
        />
      </div>

      <SalesOrderFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchDashboard}
        customers={customers}
        warehouses={warehouses}
      />
    </div>
  );
}
