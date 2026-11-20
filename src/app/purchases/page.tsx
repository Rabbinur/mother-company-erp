"use client";

import React, { useState, useEffect } from "react";
import {
  Truck,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  X,
  FileText,
  Building2,
  PackageCheck,
} from "lucide-react";
import { formatCurrency, formatShortDate, formatDate } from "@/lib/utils";

interface PurchaseItem {
  _id: string;
  purchaseNumber: string;
  vendorId?: { _id: string; companyName: string; phone: string };
  warehouseId?: { _id: string; name: string };
  status: "draft" | "ordered" | "partially_received" | "received" | "cancelled";
  subtotal: number;
  discountTotal: number;
  grandTotal: number;
  paidAmount: number;
  balanceDue: number;
  orderDate: string;
  items: Array<{
    productId: string;
    variantId: string;
    name: string;
    sku: string;
    orderedQuantity: number;
    receivedQuantity: number;
    unitCost: number;
    subtotal: number;
  }>;
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [vendors, setVendors] = useState<Array<{ _id: string; companyName: string }>>([]);
  const [products, setProducts] = useState<
    Array<{
      _id: string;
      name: string;
      variants: Array<{ _id: string; variantName: string; sku: string; purchasePrice?: number }>;
    }>
  >([]);

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [orderItems, setOrderItems] = useState<
    Array<{
      productId: string;
      variantId: string;
      name: string;
      sku: string;
      orderedQuantity: number;
      unitCost: number;
    }>
  >([]);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState("");

  // Receive Modal
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [activePurchase, setActivePurchase] = useState<PurchaseItem | null>(null);
  const [receiveInputs, setReceiveInputs] = useState<Record<string, number>>({});
  const [receiving, setReceiving] = useState(false);
  const [receiveError, setReceiveError] = useState("");

  useEffect(() => {
    fetchPurchases();
    fetchVendors();
    fetchProducts();
  }, [search]);

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const params = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await fetch(`/api/v1/purchases${params}`);
      const json = await res.json();
      if (json.success) setPurchases(json.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVendors = async () => {
    try {
      const res = await fetch("/api/v1/vendors");
      const json = await res.json();
      if (json.success) setVendors(json.data || []);
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

  const handleAddItemToOrder = () => {
    if (products.length === 0) return;
    const p = products[0];
    const v = p.variants?.[0];
    setOrderItems((prev) => [
      ...prev,
      {
        productId: p._id,
        variantId: v?._id || "",
        name: `${p.name} - ${v?.variantName || "Standard"}`,
        sku: v?.sku || "SKU",
        orderedQuantity: 10,
        unitCost: v?.purchasePrice || 50,
      },
    ]);
  };

  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendorId || orderItems.length === 0) {
      setCreateError("Select a vendor and add at least one line item");
      return;
    }
    setSaving(true);
    setCreateError("");

    try {
      const res = await fetch("/api/v1/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: selectedVendorId,
          items: orderItems,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to create purchase order");
      }

      setShowCreateModal(false);
      setOrderItems([]);
      setSelectedVendorId("");
      fetchPurchases();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Error creating purchase");
    } finally {
      setSaving(false);
    }
  };

  const openReceiveModal = (pur: PurchaseItem) => {
    setActivePurchase(pur);
    const initial: Record<string, number> = {};
    for (const item of pur.items) {
      initial[String(item.variantId)] = Math.max(0, item.orderedQuantity - item.receivedQuantity);
    }
    setReceiveInputs(initial);
    setShowReceiveModal(true);
  };

  const handleReceiveGoods = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePurchase) return;
    setReceiving(true);
    setReceiveError("");

    try {
      const receivedItems = Object.entries(receiveInputs).map(([vId, qty]) => ({
        variantId: vId,
        quantityReceived: Number(qty) || 0,
      }));

      const res = await fetch(`/api/v1/purchases/${activePurchase._id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receivedItems }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to receive goods");
      }

      setShowReceiveModal(false);
      setActivePurchase(null);
      fetchPurchases();
    } catch (err: unknown) {
      setReceiveError(err instanceof Error ? err.message : "Failed to receive stock");
    } finally {
      setReceiving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Purchase Orders & Receiving
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Vendor procurement workflow. Stock updates only upon physical receipt.
          </p>
        </div>

        <button
          onClick={() => {
            setShowCreateModal(true);
            if (orderItems.length === 0) handleAddItemToOrder();
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-sky-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>New Purchase Order</span>
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">PO Number</th>
                <th className="px-4 py-3.5">Vendor</th>
                <th className="px-4 py-3.5">Order Date</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Items</th>
                <th className="px-4 py-3.5">Total Amount</th>
                <th className="px-4 py-3.5">Balance Due</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-slate-400">
                    Loading purchase orders...
                  </td>
                </tr>
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-slate-400">
                    No purchase orders recorded yet.
                  </td>
                </tr>
              ) : (
                purchases.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-900">
                      {p.purchaseNumber}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {p.vendorId?.companyName || "N/A"}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {formatShortDate(p.orderDate)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          p.status === "received"
                            ? "bg-emerald-50 text-emerald-700"
                            : p.status === "partially_received"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-sky-50 text-sky-700"
                        }`}
                      >
                        {p.status.replace(/_/g, " ").toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      {p.items?.length || 0} line items
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-900">
                      {formatCurrency(p.grandTotal)}
                    </td>
                    <td className="px-4 py-3.5 text-red-600 font-semibold">
                      {formatCurrency(p.balanceDue)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {p.status !== "received" && p.status !== "cancelled" ? (
                        <button
                          onClick={() => openReceiveModal(p)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
                        >
                          <PackageCheck className="h-3.5 w-3.5" />
                          <span>Receive Goods</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">Completed</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Purchase Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-slate-900">
                Create Purchase Order (Stock Draft)
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

            <form onSubmit={handleCreatePurchase} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Select Vendor</label>
                <select
                  required
                  value={selectedVendorId}
                  onChange={(e) => setSelectedVendorId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs focus:outline-hidden focus:border-primary"
                >
                  <option value="">-- Choose Supplier / Vendor --</option>
                  {vendors.map((v) => (
                    <option key={v._id} value={v._id}>
                      {v.companyName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Items Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Purchased Items</span>
                  <button
                    type="button"
                    onClick={handleAddItemToOrder}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {orderItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs"
                    >
                      <div className="col-span-6">
                        <select
                          value={`${item.productId}:${item.variantId}`}
                          onChange={(e) => {
                            const [pId, vId] = e.target.value.split(":");
                            const prod = products.find((p) => p._id === pId);
                            const variant = prod?.variants.find((v) => v._id === vId);
                            setOrderItems((prev) =>
                              prev.map((it, i) =>
                                i === idx
                                  ? {
                                      ...it,
                                      productId: pId,
                                      variantId: vId,
                                      name: `${prod?.name} - ${variant?.variantName || "Standard"}`,
                                      sku: variant?.sku || "SKU",
                                      unitCost: variant?.purchasePrice || 50,
                                    }
                                  : it
                              )
                            );
                          }}
                          className="w-full rounded border border-slate-200 bg-white p-1.5 text-xs focus:outline-hidden"
                        >
                          {products.map((p) =>
                            p.variants.map((v) => (
                              <option key={v._id} value={`${p._id}:${v._id}`}>
                                {p.name} - {v.variantName} ({v.sku})
                              </option>
                            ))
                          )}
                        </select>
                      </div>

                      <div className="col-span-3">
                        <input
                          type="number"
                          min="1"
                          required
                          value={item.orderedQuantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 1;
                            setOrderItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, orderedQuantity: val } : it))
                            );
                          }}
                          placeholder="Qty"
                          className="w-full rounded border border-slate-200 bg-white p-1.5 text-xs"
                        />
                      </div>

                      <div className="col-span-3">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={item.unitCost}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setOrderItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, unitCost: val } : it))
                            );
                          }}
                          placeholder="Unit Cost ৳"
                          className="w-full rounded border border-slate-200 bg-white p-1.5 text-xs"
                        />
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
                  {saving ? "Saving..." : "Save Purchase Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receive Goods Modal */}
      {showReceiveModal && activePurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Receive Physical Stock ({activePurchase.purchaseNumber})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Supplier: {activePurchase.vendorId?.companyName}
                </p>
              </div>
              <button
                onClick={() => setShowReceiveModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {receiveError && (
              <div className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700 border border-red-200">
                {receiveError}
              </div>
            )}

            <form onSubmit={handleReceiveGoods} className="mt-4 space-y-4">
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {activePurchase.items.map((item) => {
                  const remaining = item.orderedQuantity - item.receivedQuantity;
                  return (
                    <div
                      key={String(item.variantId)}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs flex items-center justify-between"
                    >
                      <div>
                        <p className="font-semibold text-slate-800">{item.name}</p>
                        <p className="text-[11px] text-slate-500">
                          Ordered: {item.orderedQuantity} | Received so far: {item.receivedQuantity}
                        </p>
                      </div>

                      <div className="w-28 text-right">
                        <label className="block text-[10px] text-slate-500 mb-1">
                          Receive Now (max {remaining})
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={remaining}
                          value={receiveInputs[String(item.variantId)] ?? remaining}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 0;
                            setReceiveInputs((prev) => ({
                              ...prev,
                              [String(item.variantId)]: val,
                            }));
                          }}
                          className="w-full rounded border border-slate-200 bg-white p-1.5 text-xs text-right font-bold text-slate-900 focus:outline-hidden focus:border-primary"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReceiveModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={receiving}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {receiving ? "Processing..." : "Confirm Stock Receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
