"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, CheckCircle2, Clock, XCircle, ShieldAlert, Truck, Plus } from "lucide-react";

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrderDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/procurement/orders/${id}`);
      if (!res.ok) throw new Error("Failed to fetch order details");
      const json = await res.json();
      setOrder(json.data);
    } catch (err: any) {
      setError(err.message || "Failed to load order");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchOrderDetail();
  }, [id]);

  const handleSubmit = async () => {
    if (!confirm("Submit this purchase order?")) return;
    try {
      const res = await fetch(`/api/v1/procurement/orders/${id}/submit`, { method: "POST" });
      if (res.ok) fetchOrderDetail();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancel = async () => {
    const reason = prompt("Enter cancellation reason:");
    if (!reason) return;
    try {
      const res = await fetch(`/api/v1/procurement/orders/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) fetchOrderDetail();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto text-center text-zinc-400 font-mono text-xs">
        Loading purchase order workbench...
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-4">
        <Link href="/procurement/orders" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to orders
        </Link>
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs">
          {error || "Order not found."}
        </div>
      </div>
    );
  }

  const supplierName =
    typeof order.supplierId === "object"
      ? order.supplierId?.companyName || order.supplierId?.name || "Supplier"
      : "Supplier";

  const totalOrdered = (order.items || []).reduce((s: number, it: any) => s + (it.quantity || 0), 0);
  const totalRemaining = (order.items || []).reduce((s: number, it: any) => s + (it.remainingQuantity !== undefined ? it.remainingQuantity : it.quantity || 0), 0);
  const totalReceived = Math.max(0, totalOrdered - totalRemaining);
  const progressPct = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <Link
            href="/procurement/orders"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Purchase Orders</span>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 font-mono">
              {order.orderNumber}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800">
              {order.status}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {order.status === "DRAFT" && (
            <button
              onClick={handleSubmit}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 transition-colors"
            >
              Submit Order
            </button>
          )}

          {["DRAFT", "SUBMITTED"].includes(order.status) && (
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors"
            >
              Cancel Order
            </button>
          )}

          {["SUBMITTED", "PARTIALLY_RECEIVED"].includes(order.status) && (
            <Link
              href={`/inventory/grn/new?purchaseOrderId=${order._id}&supplierId=${typeof order.supplierId === "object" ? order.supplierId._id : order.supplierId}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Receive Delivery (GRN)</span>
            </Link>
          )}
        </div>
      </div>

      {/* Metadata & Progress Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-2 text-xs">
          <div className="text-zinc-400 font-mono uppercase text-[10px]">Vendor & Commercials</div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">{supplierName}</div>
          <div className="text-zinc-500 font-mono">Date: {new Date(order.orderDate).toLocaleDateString()}</div>
          {order.expectedDeliveryDate && (
            <div className="text-zinc-500 font-mono">Exp: {new Date(order.expectedDeliveryDate).toLocaleDateString()}</div>
          )}
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-2 text-xs">
          <div className="text-zinc-400 font-mono uppercase text-[10px]">Order Value</div>
          <div className="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
            {order.totalAmount !== null ? `৳${order.totalAmount.toLocaleString("en-BD", { minimumFractionDigits: 2 })}` : "Confidential"}
          </div>
          <div className="text-zinc-500">{order.items?.length || 0} line item(s) committed</div>
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-2 text-xs">
          <div className="text-zinc-400 font-mono uppercase text-[10px]">Inward Fulfillment</div>
          <div className="flex items-baseline justify-between font-mono">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{totalReceived} / {totalOrdered} Units</span>
            <span className="text-xs text-zinc-500">{progressPct}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h3 className="text-xs font-semibold uppercase tracking-wider font-mono text-zinc-700 dark:text-zinc-300">
            Committed Line Items
          </h3>
        </div>
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50/75 dark:bg-zinc-800/50 text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 font-mono">
              <th className="py-2.5 px-4">Product Name</th>
              <th className="py-2.5 px-3 text-right">Ordered</th>
              <th className="py-2.5 px-3 text-right">Received</th>
              <th className="py-2.5 px-3 text-right">Remaining</th>
              <th className="py-2.5 px-3 text-right">Unit Rate</th>
              <th className="py-2.5 px-4 text-right">Line Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-sans">
            {order.items?.map((it: any, idx: number) => {
              const remaining = it.remainingQuantity !== undefined ? it.remainingQuantity : it.quantity;
              const received = Math.max(0, it.quantity - remaining);
              return (
                <tr key={idx} className="hover:bg-zinc-50/50">
                  <td className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100">{it.name}</td>
                  <td className="py-3 px-3 text-right font-mono">{it.quantity}</td>
                  <td className="py-3 px-3 text-right font-mono text-emerald-600 font-medium">{received}</td>
                  <td className="py-3 px-3 text-right font-mono text-amber-600 font-medium">{remaining}</td>
                  <td className="py-3 px-3 text-right font-mono">
                    {it.unitPrice !== null ? `৳${it.unitPrice.toFixed(2)}` : "—"}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-medium">
                    {it.lineTotal !== null ? `৳${it.lineTotal.toFixed(2)}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Linked Goods Receipt Notes */}
      {order.grnIds && order.grnIds.length > 0 && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider font-mono text-zinc-700 dark:text-zinc-300">
            Linked Receiving Challans (GRNs)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {order.grnIds.map((grn: any) => (
              <div key={typeof grn === "object" ? grn._id : grn} className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs">
                <div>
                  <div className="font-mono font-medium text-zinc-900 dark:text-zinc-100">
                    {typeof grn === "object" ? grn.grnNumber || grn.challanNumber : grn}
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    Status: {typeof grn === "object" ? grn.status : "Verified"}
                  </div>
                </div>
                <Link
                  href={`/inventory/grn/${typeof grn === "object" ? grn._id : grn}`}
                  className="px-2.5 py-1 text-xs font-medium rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50"
                >
                  View GRN
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
