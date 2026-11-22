"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Plus, Layers, Tag, Trash2 } from "lucide-react";
import {
  PageHeader,
  DataTable,
  ColumnDef,
  StatusBadge,
  Modal,
  FormField,
  Input,
  Textarea,
} from "@/components/shared";

interface CategoryItem {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  status: string;
}

interface BrandItem {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  status: string;
}

/**
 * CategoriesPage - Refactored with Reusable Components adhering to SOLID
 */
export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCatModal, setShowCatModal] = useState(false);
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");

  const [showBrandModal, setShowBrandModal] = useState(false);
  const [brandName, setBrandName] = useState("");
  const [brandDesc, setBrandDesc] = useState("");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [cRes, bRes] = await Promise.all([
        fetch("/api/v1/categories").then((r) => r.json()),
        fetch("/api/v1/brands").then((r) => r.json()),
      ]);

      if (cRes.success) setCategories(cRes.data || []);
      if (bRes.success) setBrands(bRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    try {
      const res = await fetch("/api/v1/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: catName, description: catDesc }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to create category");
      }

      setShowCatModal(false);
      setCatName("");
      setCatDesc("");
      await fetchData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Error creating category");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    try {
      const res = await fetch("/api/v1/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: brandName, description: brandDesc }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to create brand");
      }

      setShowBrandModal(false);
      setBrandName("");
      setBrandDesc("");
      await fetchData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Error creating brand");
    } finally {
      setSaving(false);
    }
  };

  const categoryColumns: ColumnDef<CategoryItem>[] = useMemo(
    () => [
      {
        header: "Category Name",
        cell: (c) => (
          <div>
            <div className="font-semibold text-slate-900">{c.name}</div>
            <div className="text-[10px] text-slate-400 font-mono">slug: {c.slug}</div>
          </div>
        ),
      },
      {
        header: "Description",
        accessorKey: "description",
      },
      {
        header: "Status",
        align: "center",
        cell: (c) => <StatusBadge status={c.status} />,
      },
    ],
    []
  );

  const brandColumns: ColumnDef<BrandItem>[] = useMemo(
    () => [
      {
        header: "Brand Name",
        cell: (b) => (
          <div>
            <div className="font-semibold text-slate-900">{b.name}</div>
            <div className="text-[10px] text-slate-400 font-mono">slug: {b.slug}</div>
          </div>
        ),
      },
      {
        header: "Description",
        accessorKey: "description",
      },
      {
        header: "Status",
        align: "center",
        cell: (b) => <StatusBadge status={b.status} />,
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Categories & Brands"
        description="Configure product taxonomy and brand classifications"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setFormError("");
                setShowCatModal(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-sky-600 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Add Category</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFormError("");
                setShowBrandModal(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Add Brand</span>
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Categories Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-slate-900">Product Categories</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
              {categories.length}
            </span>
          </div>
          <DataTable
            columns={categoryColumns}
            data={categories}
            loading={loading}
            emptyMessage="No product categories created yet."
          />
        </div>

        {/* Brands Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-slate-900">Product Brands</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
              {brands.length}
            </span>
          </div>
          <DataTable
            columns={brandColumns}
            data={brands}
            loading={loading}
            emptyMessage="No brands registered yet."
          />
        </div>
      </div>

      {/* Category Modal */}
      <Modal
        isOpen={showCatModal}
        onClose={() => setShowCatModal(false)}
        title="Add New Category"
        description="Create a product category for grouping catalog items."
        size="md"
        loading={saving}
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowCatModal(false)}
              className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="category-form"
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-sky-600 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Category"}
            </button>
          </>
        }
      >
        <form id="category-form" onSubmit={handleCreateCategory} className="space-y-3.5">
          {formError && (
            <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
              {formError}
            </div>
          )}

          <FormField label="Category Name" required>
            <Input
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="e.g. Household & Laundry"
              required
            />
          </FormField>

          <FormField label="Description">
            <Textarea
              value={catDesc}
              onChange={(e) => setCatDesc(e.target.value)}
              placeholder="Short description of this category"
              rows={3}
            />
          </FormField>
        </form>
      </Modal>

      {/* Brand Modal */}
      <Modal
        isOpen={showBrandModal}
        onClose={() => setShowBrandModal(false)}
        title="Add New Brand"
        description="Register a manufacturing or product brand name."
        size="md"
        loading={saving}
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowBrandModal(false)}
              className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="brand-form"
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-sky-600 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Brand"}
            </button>
          </>
        }
      >
        <form id="brand-form" onSubmit={handleCreateBrand} className="space-y-3.5">
          {formError && (
            <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
              {formError}
            </div>
          )}

          <FormField label="Brand Name" required>
            <Input
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="e.g. PowerClean"
              required
            />
          </FormField>

          <FormField label="Description">
            <Textarea
              value={brandDesc}
              onChange={(e) => setBrandDesc(e.target.value)}
              placeholder="Brand details and origin"
              rows={3}
            />
          </FormField>
        </form>
      </Modal>
    </div>
  );
}
