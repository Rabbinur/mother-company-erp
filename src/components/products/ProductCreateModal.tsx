"use client";

import React, { useState } from "react";
import { X, Tag } from "lucide-react";

interface CategoryOption {
  _id: string;
  name: string;
}

interface ProductCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryOption[];
  onCreated: () => void;
}

export function ProductCreateModal({
  isOpen,
  onClose,
  categories,
  onCreated,
}: ProductCreateModalProps) {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [customerPrice, setCustomerPrice] = useState("");
  const [retailPrice, setRetailPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setModalError("");

    try {
      const res = await fetch("/api/v1/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          sku,
          categoryId,
          unit,
          purchasePrice: parseFloat(purchasePrice) || 0,
          customerPrice: parseFloat(customerPrice) || 0,
          retailPrice: parseFloat(retailPrice) || 0,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to create product");
      }

      setName("");
      setSku("");
      setPurchasePrice("");
      setCustomerPrice("");
      setRetailPrice("");
      onCreated();
      onClose();
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Error saving product");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-semibold text-slate-900">Add New Catalog Product</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {modalError && (
          <div className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
            {modalError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700">Product Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Walton Prime Refrigerator 220L"
                className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs focus:outline-hidden focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">SKU Code</label>
              <input
                type="text"
                required
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="WLTN-REF-220"
                className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs focus:outline-hidden focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Category</label>
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs focus:outline-hidden focus:border-primary"
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold text-slate-800">
                3-Level Enterprise Pricing (৳ BDT)
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-slate-600">
                  1. Purchase Price
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  placeholder="৳60.00"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs focus:outline-hidden focus:border-primary"
                />
                <span className="text-[10px] text-slate-400">Confidential</span>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600">
                  2. Customer Price
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={customerPrice}
                  onChange={(e) => setCustomerPrice(e.target.value)}
                  placeholder="৳80.00"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs focus:outline-hidden focus:border-primary"
                />
                <span className="text-[10px] text-primary">Selling price</span>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600">
                  3. Retail Price (MSRP)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={retailPrice}
                  onChange={(e) => setRetailPrice(e.target.value)}
                  placeholder="৳100.00"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs focus:outline-hidden focus:border-primary"
                />
                <span className="text-[10px] text-slate-400">Suggested resale</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-sky-600 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Create Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
