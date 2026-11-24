"use client";

import React, { useState, useEffect } from "react";
import { ProcurementHeader } from "@/components/procurement/ProcurementHeader";
import { PurchaseOrderTable, PurchaseOrderRow } from "@/components/procurement/PurchaseOrderTable";
import { PurchaseOrderFormModal } from "@/components/procurement/PurchaseOrderFormModal";

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const [orderRes, supRes, prodRes] = await Promise.all([
        fetch("/api/v1/procurement/orders"),
        fetch("/api/v1/procurement/suppliers"),
        fetch("/api/v1/products"),
      ]);

      if (orderRes.ok) {
        const json = await orderRes.json();
        setOrders(json.data?.orders || json.data || []);
      }
      if (supRes.ok) {
        const json = await supRes.json();
        setSuppliers(json.data?.suppliers || json.data || []);
      }
      if (prodRes.ok) {
        const json = await prodRes.json();
        setProducts(json.data?.products || json.data || []);
      }
    } catch (err) {
      console.error("Failed to load orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleSubmitOrder = async (orderId: string) => {
    if (!confirm("Submit this purchase order to supplier?")) return;
    try {
      const res = await fetch(`/api/v1/procurement/orders/${orderId}/submit`, { method: "POST" });
      if (res.ok) fetchOrders();
    } catch (err) {
      console.error("Submit order error:", err);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    const reason = prompt("Enter reason for cancellation:");
    if (!reason) return;
    try {
      const res = await fetch(`/api/v1/procurement/orders/${orderId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) fetchOrders();
    } catch (err) {
      console.error("Cancel order error:", err);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <ProcurementHeader
        title="Purchase Orders"
        subtitle="Manage supplier procurement commitments, deliveries, and inward fulfillment"
        activeTab="orders"
        onRefresh={fetchOrders}
        loading={loading}
        onNewOrder={() => setIsModalOpen(true)}
      />

      <PurchaseOrderTable
        orders={orders}
        loading={loading}
        onSubmitOrder={handleSubmitOrder}
        onCancelOrder={handleCancelOrder}
      />

      <PurchaseOrderFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchOrders}
        suppliers={suppliers}
        products={products}
      />
    </div>
  );
}
