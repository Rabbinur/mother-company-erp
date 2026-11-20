"use client";

import React, { useState, useEffect } from "react";
import {
  Package,
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Lock,
  Tag,
  Warehouse,
  CheckCircle,
  X,
  Layers,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Variant {
  _id: string;
  variantName: string;
  sku: string;
  purchasePrice?: number;
  customerPrice: number;
  retailPrice: number;
  potentialMarginPercentage?: number;
  status: string;
}

interface ProductItem {
  _id: string;
  name: string;
  sku: string;
  unit: string;
  productType: string;
  hasVariants: boolean;
  status: string;
  categoryId?: { _id: string; name: string };
  brandId?: { _id: string; name: string };
  variants: Variant[];
  inventory: {
    onHand: number;
    reserved: number;
    available: number;
  };
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState<Array<{ _id: string; name: string }>>([]);
  const [selectedCategory, setSelectedCategory] = useState("");

  // Create Product Dialog State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [customerPrice, setCustomerPrice] = useState("");
  const [retailPrice, setRetailPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [search, selectedCategory]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (selectedCategory) params.append("categoryId", selectedCategory);

      const res = await fetch(`/api/v1/products?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setProducts(json.data || []);
      }
    } catch (err) {
      console.error("Products fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/v1/categories");
      const json = await res.json();
      if (json.success) setCategories(json.data || []);
    } catch {
      // ignore
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
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

      setShowCreateModal(false);
      setName("");
      setSku("");
      setPurchasePrice("");
      setCustomerPrice("");
      setRetailPrice("");
      fetchProducts();
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Error saving product");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Products & Variants Management
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Central catalog with 3-level pricing (Purchase, Customer, Retail) and live stock
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-sky-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Add New Product</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, SKU, or barcode..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 focus:bg-white focus:outline-hidden"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Product Name & SKU</th>
                <th className="px-4 py-3.5">Category</th>
                <th className="px-4 py-3.5">Purchase Price</th>
                <th className="px-4 py-3.5">Customer Price</th>
                <th className="px-4 py-3.5">Retail Price</th>
                <th className="px-4 py-3.5">Potential Margin</th>
                <th className="px-4 py-3.5">Available Stock</th>
                <th className="px-4 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-slate-400">
                    Loading catalog items...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-slate-400">
                    No products found. Click &apos;Add New Product&apos; to create one.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const mainVariant = p.variants?.[0];
                  return (
                    <tr key={p._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-900">{p.name}</div>
                        <div className="text-[11px] text-slate-400">SKU: {p.sku}</div>
                        {p.variants && p.variants.length > 1 && (
                          <span className="mt-1 inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                            <Layers className="h-3 w-3" />
                            {p.variants.length} Variants
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {p.categoryId?.name || "General"}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-700">
                        {mainVariant?.purchasePrice !== undefined ? (
                          formatCurrency(mainVariant.purchasePrice)
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                            <Lock className="h-3 w-3" /> Confidential
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-primary">
                        {formatCurrency(mainVariant?.customerPrice || 0)}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {formatCurrency(mainVariant?.retailPrice || 0)}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-100">
                          +{mainVariant?.potentialMarginPercentage || 0}%
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-800">
                          {p.inventory.available} {p.unit}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          On Hand: {p.inventory.onHand} | Res: {p.inventory.reserved}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            p.status === "active"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Product Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-slate-900">Add New Catalog Product</h3>
              <button
                onClick={() => setShowCreateModal(false)}
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

            <form onSubmit={handleCreateProduct} className="mt-4 space-y-4">
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

              {/* 3-Level Pricing Inputs */}
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
                      1. Purchase Price (Cost)
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
                      2. Customer Price (Sale)
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
                    <span className="text-[10px] text-primary">Order default</span>
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
                  onClick={() => setShowCreateModal(false)}
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
      )}
    </div>
  );
}
