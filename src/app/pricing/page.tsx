"use client";

import React, { useState, useMemo } from "react";
import { Tags, Edit3, Lock, ArrowUpRight } from "lucide-react";
import {
  PageHeader,
  DataTable,
  ColumnDef,
  SearchInput,
  Modal,
  FormField,
  Input,
  CurrencyDisplay,
  Pagination,
} from "@/components/shared";
import { useDataQuery } from "@/hooks/useDataQuery";

interface VariantItem {
  _id: string;
  sku: string;
  variantName?: string;
  purchasePrice?: number;
  customerPrice: number;
  retailPrice: number;
}

interface ProductWithVariants {
  _id: string;
  name: string;
  sku: string;
  category?: { name: string };
  variants: VariantItem[];
}

interface FlattenedPricingItem {
  productId: string;
  productName: string;
  variantId: string;
  sku: string;
  variantName: string;
  purchasePrice?: number;
  customerPrice: number;
  retailPrice: number;
  retailerMarginPercent: number;
}

/**
 * PricingPage - 3-Level Price Governance Refactored with Reusable Components
 */
export default function PricingPage() {
  const [editingItem, setEditingItem] = useState<FlattenedPricingItem | null>(null);
  const [formData, setFormData] = useState({
    purchasePrice: "0",
    customerPrice: "0",
    retailPrice: "0",
    reason: "",
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const {
    data: products,
    loading,
    page,
    totalPages,
    total,
    setPage,
    setParams,
    refetch,
  } = useDataQuery<ProductWithVariants>({
    url: "/api/v1/products",
  });

  const handleSearch = (searchVal: string) => {
    setPage(1);
    setParams((prev) => ({ ...prev, search: searchVal }));
  };

  const flattenedData: FlattenedPricingItem[] = useMemo(() => {
    const list: FlattenedPricingItem[] = [];
    products.forEach((p) => {
      (p.variants || []).forEach((v) => {
        const rp = v.retailPrice || 0;
        const cp = v.customerPrice || 0;
        const marginPct = rp > 0 ? ((rp - cp) / rp) * 100 : 0;

        list.push({
          productId: p._id,
          productName: p.name,
          variantId: v._id,
          sku: v.sku,
          variantName: v.variantName || "Standard",
          purchasePrice: v.purchasePrice,
          customerPrice: cp,
          retailPrice: rp,
          retailerMarginPercent: Math.round(marginPct * 10) / 10,
        });
      });
    });
    return list;
  }, [products]);

  const openEditModal = (item: FlattenedPricingItem) => {
    setEditingItem(item);
    setFormData({
      purchasePrice: item.purchasePrice !== undefined ? String(item.purchasePrice) : "0",
      customerPrice: String(item.customerPrice),
      retailPrice: String(item.retailPrice),
      reason: "",
    });
    setFormError("");
  };

  const handleUpdatePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setSaving(true);
    setFormError("");

    try {
      const res = await fetch("/api/v1/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: editingItem.productId,
          variantId: editingItem.variantId,
          purchasePrice: parseFloat(formData.purchasePrice) || 0,
          customerPrice: parseFloat(formData.customerPrice) || 0,
          retailPrice: parseFloat(formData.retailPrice) || 0,
          reason: formData.reason || "Catalog price adjustment",
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to update price");
      }

      setEditingItem(null);
      await refetch();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Error updating price");
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnDef<FlattenedPricingItem>[] = useMemo(
    () => [
      {
        header: "Product & Variant SKU",
        cell: (item) => (
          <div>
            <div className="font-semibold text-slate-900">{item.productName}</div>
            <div className="text-[10px] text-slate-400 font-mono">
              SKU: {item.sku} ({item.variantName})
            </div>
          </div>
        ),
      },
      {
        header: "1. Purchase Price (Cost)",
        align: "right",
        cell: (item) =>
          item.purchasePrice !== undefined ? (
            <CurrencyDisplay amount={item.purchasePrice} />
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
              <Lock className="h-3 w-3 text-slate-300" />
              Confidential
            </span>
          ),
      },
      {
        header: "2. Customer Price (Wholesale)",
        align: "right",
        cell: (item) => <CurrencyDisplay amount={item.customerPrice} />,
      },
      {
        header: "3. Retail Price (MSRP)",
        align: "right",
        cell: (item) => <CurrencyDisplay amount={item.retailPrice} />,
      },
      {
        header: "Retailer Margin",
        align: "right",
        cell: (item) => (
          <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600">
            <ArrowUpRight className="h-3 w-3" />
            {item.retailerMarginPercent}%
          </span>
        ),
      },
      {
        header: "Action",
        align: "center",
        cell: (item) => (
          <button
            type="button"
            onClick={() => openEditModal(item)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <Edit3 className="h-3 w-3 text-slate-500" />
            <span>Update</span>
          </button>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="3-Level Price Governance"
        description="Maintain Purchase, Customer (Wholesale), and Suggested Retail prices with audit tracking"
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <SearchInput
          placeholder="Filter by product name, variant SKU..."
          onChange={handleSearch}
          className="flex-1 max-w-sm"
        />
      </div>

      <DataTable
        columns={columns}
        data={flattenedData}
        loading={loading}
        emptyMessage="No product variants found to display pricing."
      />

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
      />

      {/* Edit Price Modal */}
      <Modal
        isOpen={!!editingItem}
        onClose={() => setEditingItem(null)}
        title="Update Tiered Product Prices"
        description={
          editingItem
            ? `${editingItem.productName} — SKU: ${editingItem.sku}`
            : "Update pricing"
        }
        size="md"
        loading={saving}
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditingItem(null)}
              className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="price-form"
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-sky-600 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Prices"}
            </button>
          </>
        }
      >
        <form id="price-form" onSubmit={handleUpdatePrice} className="space-y-3.5">
          {formError && (
            <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2.5">
            <FormField label="1. Purchase Price (৳)">
              <Input
                type="number"
                value={formData.purchasePrice}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, purchasePrice: e.target.value }))
                }
                step="0.01"
                min="0"
              />
            </FormField>

            <FormField label="2. Customer Price (৳)" required>
              <Input
                type="number"
                value={formData.customerPrice}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, customerPrice: e.target.value }))
                }
                step="0.01"
                min="0.01"
                required
              />
            </FormField>

            <FormField label="3. Retail Price (৳)" required>
              <Input
                type="number"
                value={formData.retailPrice}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, retailPrice: e.target.value }))
                }
                step="0.01"
                min="0.01"
                required
              />
            </FormField>
          </div>

          <FormField
            label="Reason for Price Change"
            helperText="Captured in the immutable price history audit trail."
            required
          >
            <Input
              value={formData.reason}
              onChange={(e) => setFormData((prev) => ({ ...prev, reason: e.target.value }))}
              placeholder="e.g. Raw material cost revision Q4"
              required
            />
          </FormField>
        </form>
      </Modal>
    </div>
  );
}
