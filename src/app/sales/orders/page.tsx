"use client";

import React, { useState, useEffect } from "react";
import { SalesHeader } from "@/components/sales/SalesHeader";
import { SalesOrderTable, SalesOrderRow } from "@/components/sales/SalesOrderTable";
import { SalesOrderFormModal } from "@/components/sales/SalesOrderFormModal";

export default function SalesOrdersPage() {
  const [orders, setOrders] = useState<SalesOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const [orderRes, custRes, whRes] = await Promise.all([
        fetch("/api/v1/sales/orders"),
        fetch("/api/v1/customers"),
        fetch("/api/v1/warehouses"),
      ]);

      if (orderRes.ok) {
        const json = await orderRes.json();
        setOrders(json.data || []);
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
      console.error("Failed to load sales orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleConfirmOrder = async (orderId: string) => {
    if (!confirm("Confirm this sales order and reserve inventory?")) return;
    try {
      const res = await fetch(`/api/v1/sales/orders/${orderId}/confirm`, { method: "POST" });
      if (res.ok) fetchOrders();
      else {
        const j = await res.json();
        alert(j.error || "Failed to confirm order");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    const reason = prompt("Enter cancellation reason:");
    if (!reason) return;
    try {
      const res = await fetch(`/api/v1/sales/orders/${orderId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) fetchOrders();
      else {
        const j = await res.json();
        alert(j.error || "Failed to cancel order");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <SalesHeader
        title="Sales Orders"
        subtitle="Track customer bookings, stock reservations, order status, and fulfillment"
        activeTab="orders"
        onRefresh={fetchOrders}
        loading={loading}
        onNewOrder={() => setIsModalOpen(true)}
      />

      <SalesOrderTable
        orders={orders}
        loading={loading}
        onConfirmOrder={handleConfirmOrder}
        onCancelOrder={handleCancelOrder}
      />

      <SalesOrderFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchOrders}
        customers={customers}
        warehouses={warehouses}
      />
    </div>
  );
}
