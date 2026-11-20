"use client";

import React, { useState, useEffect } from "react";
import {
  ShoppingCart,
  Plus,
  Search,
  CheckCircle2,
  PackageCheck,
  XCircle,
  Printer,
  X,
  CreditCard,
  User,
  ShieldCheck,
} from "lucide-react";
import { formatCurrency, formatShortDate, formatDate } from "@/lib/utils";

interface OrderItem {
  _id: string;
  orderNumber: string;
  externalOrderId?: string;
  source: string;
  orderStatus: string;
  fulfillmentStatus: string;
  paymentStatus: string;
  grandTotal: number;
  paidAmount: number;
  receivableAmount: number;
  orderDate: string;
  customerId?: {
    _id: string;
    shopName: string;
    name: string;
    phone: string;
    address?: string;
    district?: string;
    currentReceivable: number;
  };
  warehouseId?: { _id: string; name: string };
  items: Array<{
    variantId: string;
    name: string;
    sku: string;
    quantity: number;
    customerPriceSnapshot: number;
    retailPriceSnapshot: number;
    subtotal: number;
  }>;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [customers, setCustomers] = useState<
    Array<{ _id: string; shopName: string; name: string; phone: string; currentReceivable: number }>
  >([]);
  const [products, setProducts] = useState<
    Array<{
      _id: string;
      name: string;
      variants: Array<{
        _id: string;
        variantName: string;
        sku: string;
        customerPrice: number;
        retailPrice: number;
      }>;
    }>
  >([]);

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [lineItems, setLineItems] = useState<
    Array<{
      productId: string;
      variantId: string;
      name: string;
      sku: string;
      quantity: number;
      price: number;
    }>
  >([]);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState("");

  // Invoice Print Modal State
  const [printOrder, setPrintOrder] = useState<OrderItem | null>(null);

  useEffect(() => {
    fetchOrders();
    fetchCustomers();
    fetchProducts();
  }, [search, statusFilter]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter) params.append("status", statusFilter);

      const res = await fetch(`/api/v1/orders?${params.toString()}`);
      const json = await res.json();
      if (json.success) setOrders(json.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch("/api/v1/customers");
      const json = await res.json();
      if (json.success) setCustomers(json.data || []);
    } catch {
      // ignore
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/v1/products");
      const json = await res.json();
      if (json.success) setProducts(json.data || []);
    } catch {
      // ignore
    }
  };

  const handleAddLineItem = () => {
    if (products.length === 0) return;
    const p = products[0];
    const v = p.variants?.[0];
    setLineItems((prev) => [
      ...prev,
      {
        productId: p._id,
        variantId: v?._id || "",
        name: `${p.name} - ${v?.variantName || "Standard"}`,
        sku: v?.sku || "SKU",
        quantity: 5,
        price: v?.customerPrice || 80,
      },
    ]);
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || lineItems.length === 0) {
      setCreateError("Customer and items are required");
      return;
    }
    setSaving(true);
    setCreateError("");

    try {
      const res = await fetch("/api/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          items: lineItems.map((l) => ({
            productId: l.productId,
            variantId: l.variantId,
            quantity: l.quantity,
          })),
          autoConfirmAndReserve: true,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to create order");
      }

      setShowCreateModal(false);
      setLineItems([]);
      setSelectedCustomerId("");
      fetchOrders();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Error creating order");
    } finally {
      setSaving(false);
    }
  };

  const handleFulfillOrder = async (orderId: string) => {
    if (!confirm("Fulfill this order? This will deduct physical stock and update customer receivables.")) {
      return;
    }
    try {
      const res = await fetch(`/api/v1/orders/${orderId}/fulfill`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        fetchOrders();
      } else {
        alert(json.message || "Fulfillment failed");
      }
    } catch {
      alert("Fulfillment failed");
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    const reason = prompt("Enter cancellation reason:");
    if (!reason) return;

    try {
      const res = await fetch(`/api/v1/orders/${orderId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (json.success) {
        fetchOrders();
      } else {
        alert(json.message || "Cancellation failed");
      }
    } catch {
      alert("Cancellation failed");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Sales Orders & Fulfillment
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Orders from Internal Staff and Field Sales with atomic inventory reservation
          </p>
        </div>

        <button
          onClick={() => {
            setShowCreateModal(true);
            if (lineItems.length === 0) handleAddLineItem();
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-sky-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>New Sales Order</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order #, external ID..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 focus:bg-white focus:outline-hidden"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="confirmed">Confirmed (Stock Reserved)</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Order Number</th>
                <th className="px-4 py-3.5">Retailer / Customer</th>
                <th className="px-4 py-3.5">Source</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Payment</th>
                <th className="px-4 py-3.5">Grand Total</th>
                <th className="px-4 py-3.5">Receivable</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-slate-400">
                    Loading orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-slate-400">
                    No sales orders found. Click &apos;New Sales Order&apos; to create one.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o._id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3.5">
                      <div className="font-mono font-bold text-slate-900">{o.orderNumber}</div>
                      <div className="text-[10px] text-slate-400">{formatShortDate(o.orderDate)}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-800">
                        {o.customerId?.shopName || "Walk-in Retailer"}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {o.customerId?.name} ({o.customerId?.phone})
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 uppercase">
                        {o.source}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          o.orderStatus === "fulfilled"
                            ? "bg-emerald-50 text-emerald-700"
                            : o.orderStatus === "confirmed"
                            ? "bg-blue-50 text-blue-700"
                            : o.orderStatus === "cancelled"
                            ? "bg-red-50 text-red-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {o.orderStatus.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`text-[11px] font-medium ${
                          o.paymentStatus === "paid"
                            ? "text-emerald-600"
                            : o.paymentStatus === "partially_paid"
                            ? "text-amber-600"
                            : "text-red-500"
                        }`}
                      >
                        {o.paymentStatus.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-bold text-slate-900">
                      {formatCurrency(o.grandTotal)}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-amber-600">
                      {formatCurrency(o.receivableAmount)}
                    </td>
                    <td className="px-4 py-3.5 text-right space-x-1">
                      {/* Fulfill Action */}
                      {o.orderStatus === "confirmed" && (
                        <button
                          onClick={() => handleFulfillOrder(o._id)}
                          title="Fulfill and Deduct Physical Stock"
                          className="rounded bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                        >
                          Fulfill
                        </button>
                      )}

                      {/* Cancel Action */}
                      {(o.orderStatus === "draft" || o.orderStatus === "confirmed") && (
                        <button
                          onClick={() => handleCancelOrder(o._id)}
                          title="Cancel and Release Reservation"
                          className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-100"
                        >
                          Cancel
                        </button>
                      )}

                      {/* Print Invoice */}
                      <button
                        onClick={() => setPrintOrder(o)}
                        title="Print Invoice"
                        className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Printer className="inline h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Order Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-slate-900">
                New Sales Order & Atomic Stock Reservation
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {createError && (
              <div className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700 border border-red-200">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateOrder} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Select Retailer / Customer</label>
                <select
                  required
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs focus:outline-hidden focus:border-primary"
                >
                  <option value="">-- Choose Retailer --</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.shopName} ({c.name} - {c.phone})
                    </option>
                  ))}
                </select>
              </div>

              {/* Line Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Order Line Items</span>
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {lineItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs"
                    >
                      <div className="col-span-7">
                        <select
                          value={`${item.productId}:${item.variantId}`}
                          onChange={(e) => {
                            const [pId, vId] = e.target.value.split(":");
                            const prod = products.find((p) => p._id === pId);
                            const variant = prod?.variants.find((v) => v._id === vId);
                            setLineItems((prev) =>
                              prev.map((it, i) =>
                                i === idx
                                  ? {
                                      ...it,
                                      productId: pId,
                                      variantId: vId,
                                      name: `${prod?.name} - ${variant?.variantName || "Standard"}`,
                                      sku: variant?.sku || "SKU",
                                      price: variant?.customerPrice || 80,
                                    }
                                  : it
                              )
                            );
                          }}
                          className="w-full rounded border border-slate-200 bg-white p-1.5 text-xs"
                        >
                          {products.map((p) =>
                            p.variants.map((v) => (
                              <option key={v._id} value={`${p._id}:${v._id}`}>
                                {p.name} - {v.variantName} (Customer Price: ৳{v.customerPrice})
                              </option>
                            ))
                          )}
                        </select>
                      </div>

                      <div className="col-span-2">
                        <input
                          type="number"
                          min="1"
                          required
                          value={item.quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 1;
                            setLineItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, quantity: val } : it))
                            );
                          }}
                          placeholder="Qty"
                          className="w-full rounded border border-slate-200 bg-white p-1.5 text-xs text-center"
                        />
                      </div>

                      <div className="col-span-3 flex items-center justify-end font-semibold text-slate-800 pr-1">
                        {formatCurrency(item.quantity * item.price)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
                >
                  {saving ? "Reserving Stock..." : "Confirm & Reserve Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Preview & Print Modal */}
      {printOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-2xl border border-slate-200">
            {/* Header / Brand */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-6">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  MOTHER COMPANY ERP
                </h1>
                <p className="text-xs text-slate-500">Central Distribution & Head Office</p>
                <p className="text-xs text-slate-500">Dhaka, Bangladesh | Phone: +880 1700-000000</p>
              </div>
              <div className="text-right">
                <span className="rounded-md bg-slate-900 px-3 py-1 font-mono text-xs font-bold text-white">
                  TAX INVOICE
                </span>
                <p className="mt-2 text-xs font-semibold text-slate-900 font-mono">
                  {printOrder.orderNumber}
                </p>
                <p className="text-[11px] text-slate-400">
                  Date: {formatDate(printOrder.orderDate)}
                </p>
              </div>
            </div>

            {/* Bill To */}
            <div className="my-6 rounded-lg bg-slate-50 p-4 text-xs">
              <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider block mb-1">
                Billed To (Retailer / Customer):
              </span>
              <p className="text-sm font-bold text-slate-900">{printOrder.customerId?.shopName}</p>
              <p className="text-slate-600 font-medium">Owner: {printOrder.customerId?.name}</p>
              <p className="text-slate-500">
                Phone: {printOrder.customerId?.phone} | District: {printOrder.customerId?.district || "Dhaka"}
              </p>
            </div>

            {/* Items Table */}
            <table className="w-full text-left text-xs mb-6">
              <thead className="border-b border-slate-200 bg-slate-100 text-[11px] font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="py-2 px-3">Item Description</th>
                  <th className="py-2 px-3 text-center">Qty</th>
                  <th className="py-2 px-3 text-right">Unit Price</th>
                  <th className="py-2 px-3 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {printOrder.items?.map((item, i) => (
                  <tr key={i}>
                    <td className="py-2.5 px-3">
                      <span className="font-medium text-slate-900">{item.name}</span>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        SKU: {item.sku}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                      {item.quantity}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600">
                      {formatCurrency(item.customerPriceSnapshot)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      {formatCurrency(item.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end border-t border-slate-200 pt-4 text-xs">
              <div className="w-64 space-y-1.5 text-right">
                <div className="flex justify-between text-slate-600">
                  <span>Grand Total:</span>
                  <span className="font-bold text-slate-900">{formatCurrency(printOrder.grandTotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Paid Amount:</span>
                  <span className="font-semibold text-emerald-600">{formatCurrency(printOrder.paidAmount)}</span>
                </div>
                <div className="flex justify-between text-slate-900 font-bold border-t border-slate-200 pt-1.5 text-sm">
                  <span>Receivable Due:</span>
                  <span className="text-red-600">{formatCurrency(printOrder.receivableAmount)}</span>
                </div>
              </div>
            </div>

            {/* Print Modal Controls */}
            <div className="mt-8 flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                onClick={() => setPrintOrder(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-sky-600"
              >
                <Printer className="h-4 w-4" />
                <span>Print Invoice</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
