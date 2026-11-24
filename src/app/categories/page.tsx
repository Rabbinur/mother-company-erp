"use client";

import React, { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared";
import {
  CategoryTaxonomyTables,
  CategoryItem,
  BrandItem,
} from "@/components/categories/CategoryTaxonomyTables";
import { CategoryModals } from "@/components/categories/CategoryModals";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCatModal, setShowCatModal] = useState(false);
  const [showBrandModal, setShowBrandModal] = useState(false);

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Categories & Brands"
        description="Configure product taxonomy and brand classifications"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCatModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-sky-600 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Add Category</span>
            </button>
            <button
              type="button"
              onClick={() => setShowBrandModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Add Brand</span>
            </button>
          </div>
        }
      />

      <CategoryTaxonomyTables
        categories={categories}
        brands={brands}
        loading={loading}
      />

      <CategoryModals
        showCatModal={showCatModal}
        onCloseCatModal={() => setShowCatModal(false)}
        onCategoryCreated={fetchData}
        showBrandModal={showBrandModal}
        onCloseBrandModal={() => setShowBrandModal(false)}
        onBrandCreated={fetchData}
      />
    </div>
  );
}
