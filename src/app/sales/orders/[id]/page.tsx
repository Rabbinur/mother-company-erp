"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, CheckCircle2, ShieldCheck, Box, XCircle, AlertCircle, ShoppingCart } from "lucide-react";

export default function SalesOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrderDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/sales/orders/${id}`);
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

  const handleConfirm = async () => {
    if (!confirm("Confirm this sales order and atomically reserve stock?")) return;
    try {
      const res = await fetch(`/api/v1/sales/orders/${id}/confirm`, { method: "POST" });
      if (res.ok) fetchOrderDetail();
      else {
        const j = await res.json();
        alert(j.error || "Failed to confirm order");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancel = async () => {
    const reason = prompt("Enter cancellation reason:");
    if (!reason) return;
    try {
      const res = await fetch(`/api/v1/sales/orders/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) fetchOrderDetail();
      else {
        const j = await res.json();
        alert(j.error || "Failed to cancel order");
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto text-center text-zinc-400 font-mono text-xs">
        Loading sales order workbench...
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-4">
        <Link href="/sales/orders" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to orders
        </Link>
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs">
          {error || "Sales order not found."}
        </div>
      </div>
    );
  }

  const cust = order.customerId || {};
  const wh = order.warehouseId || {};
  const dl = order.dealershipId || {};
  const isDraft = order.orderStatus?.toUpperCase() === "DRAFT";
  const isConfirmed = order.orderStatus?.toUpperCase() === "CONFIRMED";
  const isCancelled = order.orderStatus?.toUpperCase() === "CANCELLED";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <Link
            href="/sales/orders"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Sales Orders</span>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 font-mono">
              {order.orderNumber}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 font-mono">
              {order.orderStatus?.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isDraft && (
            <button
              onClick={handleConfirm}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Confirm & Reserve Stock</span>
            </button>
          )}

          {!isCancelled && (
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors"
            >
              Cancel Order
            </button>
          )}
        </div>
      </div>

      {/* Metadata Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-2 text-xs">
          <div className="text-zinc-400 font-mono uppercase text-[10px]">Retailer Customer</div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">{cust.shopName || cust.name || "Customer"}</div>
          {cust.phone && <div className="text-zinc-500 font-mono">Phone: {cust.phone}</div>}
          {cust.address && <div className="text-zinc-500">{cust.address}</div>}
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-2 text-xs">
          <div className="text-zinc-400 font-mono uppercase text-[10px]">Dispatch & Dealership</div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">{wh.name || "Central Warehouse"}</div>
          <div className="text-zinc-500 font-mono">Dealership: {dl.name || "Direct"}</div>
          <div className="text-zinc-500 font-mono">Date: {new Date(order.orderDate).toLocaleDateString()}</div>
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-2 text-xs">
          <div className="text-zinc-400 font-mono uppercase text-[10px]">Stock Reservation</div>
          {order.reservationId ? (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-mono font-medium">
                <ShieldCheck className="w-4 h-4" />
                <span>Reserved: {typeof order.reservationId === "object" ? order.reservationId.reservationNumber : "Active"}</span>
              </div>
              <div className="text-zinc-500 text-[11px]">Stock locked for this dealership's fulfillment</div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-500 font-mono">
                <Box className="w-4 h-4" />
                <span>No reservation (Draft)</span>
              </div>
              <div className="text-zinc-400 text-[11px]">Stock is reserved upon confirmation</div>
            </div>
          )}
        </div>
      </div>

      {/* Immutable Pricing Snapshot Table */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider font-mono text-zinc-700 dark:text-zinc-300">
            Order Line Items & Pricing Snapshots
          </h3>
          <span className="text-[11px] text-zinc-500 font-mono">
            {order.items?.length || 0} line item(s)
          </span>
        </div>
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50/75 dark:bg-zinc-800/50 text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 font-mono">
              <th className="py-2.5 px-4">Product Name</th>
              <th className="py-2.5 px-3">SKU</th>
              <th className="py-2.5 px-3 text-right">Quantity</th>
              <th className="py-2.5 px-3 text-right">Selling Price (৳)</th>
              <th className="py-2.5 px-3 text-right">Suggested Retail (৳)</th>
              <th className="py-2.5 px-3 text-center">Price Source</th>
              <th className="py-2.5 px-4 text-right">Line Total (৳)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-sans">
            {order.items?.map((it: any, idx: number) => (
              <tr key={idx} className="hover:bg-zinc-50/50">
                <td className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100">{it.name}</td>
                <td className="py-3 px-3 font-mono text-[11px] text-zinc-500">{it.sku}</td>
                <td className="py-3 px-3 text-right font-mono font-medium">{it.quantity}</td>
                <td className="py-3 px-3 text-right font-mono text-zinc-900 dark:text-zinc-100">
                  {it.customerPriceSnapshot?.toFixed(2)}
                </td>
                <td className="py-3 px-3 text-right font-mono text-zinc-500">
                  {it.retailPriceSnapshot?.toFixed(2) || "—"}
                </td>
                <td className="py-3 px-3 text-center font-mono text-[10px]">
                  <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    {it.priceSource === "dealership_override" ? "Override" : "Base"}
                  </span>
                </td>
                <td className="py-3 px-4 text-right font-mono font-medium text-zinc-900 dark:text-zinc-100">
                  {it.subtotal?.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-4 bg-zinc-50/50 dark:bg-zinc-800/30 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
          <div className="space-y-1 text-right font-mono text-xs">
            <div className="text-zinc-500">Subtotal: ৳{order.subtotal?.toFixed(2)}</div>
            {order.discountTotal > 0 && (
              <div className="text-emerald-600">Discount: -৳{order.discountTotal?.toFixed(2)}</div>
            )}
            <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 pt-1 border-t border-zinc-200 dark:border-zinc-700">
              Grand Total: ৳{order.grandTotal?.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
