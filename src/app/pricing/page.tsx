"use client";

import React, { useState, useEffect } from "react";
import { Tags, Search, Edit3, Lock, ArrowUpRight, X, History } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function PricingPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Edit Price Modal
  const [showModal, setShowModal] = useState(false);
  const [editingVariant, setEditingVariant] = useState<any | null>(null);
  const [newPurchasePrice, setNewPurchasePrice] = useState("");
  const [newCustomerPrice, setNewCustomerPrice] = useState("");
  const [newRetailPrice, setNewRetailPrice] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchProducts();
  }, [search]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await fetch(`/api/v1/products${params}`);
      const json = await res.json();
      if (json.success) setProducts(json.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (p: any, v: any) => {
    setEditingVariant({ ...v, productId: p._id, productName: p.name });
    setNewPurchasePrice(v.purchasePrice !== undefined ? String(v.purchasePrice) : "0");
    setNewCustomerPrice(String(v.customerPrice || 0));
    setNewRetailPrice(String(v.retailPrice || 0));
    setReason("");
    setError("");
    setShowModal(true);
  };

  const handleUpdatePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVariant) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/v1/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: editingVariant.productId,
          variantId: editingVariant._id,
          newPurchasePrice: parseFloat(newPurchasePrice) || 0,
          newCustomerPrice: parseFloat(newCustomerPrice) || 0,
          newRetailPrice: parseFloat(newRetailPrice) || 0,
          reason: reason || "Price adjustment",
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to update price");
      }

      setShowModal(false);
      fetchProducts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error updating price");
    } finally {
      setSaving(false);
    }
  };

  const calcMargin = () => {
    const cust = parseFloat(newCustomerPrice) || 0;
    const ret = parseFloat(newRetailPrice) || 0;
    if (ret <= 0) return 0;
    return Math.round(((ret - cust) / ret) * 100 * 10) / 10;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Enterprise 3-Level Pricing Management
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Purchase Acquisition Cost, Customer Sales Price, and Suggested Retail Resale Price
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products or SKU..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs focus:bg-white focus:outline-hidden"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Item & SKU</th>
                <th className="px-4 py-3.5">Variant</th>
                <th className="px-4 py-3.5">1. Purchase Price (Cost)</th>
                <th className="px-4 py-3.5">2. Customer Price (Order)</th>
                <th className="px-4 py-3.5">3. Retail Price (MSRP)</th>
                <th className="px-4 py-3.5">Retailer Margin %</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Loading pricing matrix...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No products found.
                  </td>
                </tr>
              ) : (
                products.flatMap((p) =>
                  (p.variants || []).map((v: any) => (
                    <tr key={v._id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3.5 font-semibold text-slate-900">
                        {p.name}
                        <span className="block font-mono text-[10px] text-slate-400 font-normal">
                          {v.sku}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 font-medium">{v.variantName}</td>
                      <td className="px-4 py-3.5 font-medium text-slate-700">
                        {v.purchasePrice !== undefined ? (
                          formatCurrency(v.purchasePrice)
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                            <Lock className="h-3 w-3" /> Confidential
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-primary">
                        {formatCurrency(v.customerPrice)}
                      </td>
                      <td className="px-4 py-3.5 text-slate-700 font-semibold">
                        {formatCurrency(v.retailPrice)}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="rounded bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-100">
                          +{v.potentialMarginPercentage || 0}%
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => openEditModal(p, v)}
                          className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          <Edit3 className="h-3 w-3" />
                          <span>Update</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {showModal && editingVariant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Update 3-Level Price</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingVariant.productName} ({editingVariant.variantName})
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && <div className="mt-2 text-xs text-red-600">{error}</div>}

            <form onSubmit={handleUpdatePrice} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  1. Purchase Acquisition Price (৳)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={newPurchasePrice}
                  onChange={(e) => setNewPurchasePrice(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  2. Customer Sales Price (৳) [Order Default]
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={newCustomerPrice}
                  onChange={(e) => setNewCustomerPrice(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  3. Retail Resale Price (৳) [Suggested MSRP]
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={newRetailPrice}
                  onChange={(e) => setNewRetailPrice(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs"
                />
              </div>

              <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">
                Projected Retailer Margin: <span className="font-bold">+{calcMargin()}%</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Reason for Change</label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Supplier raw material price revision"
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border px-3 py-1.5 text-xs text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {saving ? "Updating..." : "Save Prices"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
