"use client";

import React, { useMemo } from "react";
import { DataTable, ColumnDef, StatusBadge } from "@/components/shared";

export interface CategoryItem {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  status: string;
}

export interface BrandItem {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  status: string;
}

interface CategoryTaxonomyTablesProps {
  categories: CategoryItem[];
  brands: BrandItem[];
  loading: boolean;
}

export function CategoryTaxonomyTables({
  categories,
  brands,
  loading,
}: CategoryTaxonomyTablesProps) {
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-800">Product Categories</h3>
        <DataTable
          columns={categoryColumns}
          data={categories}
          loading={loading}
          emptyMessage="No categories defined."
        />
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-800">Brands & Manufacturers</h3>
        <DataTable
          columns={brandColumns}
          data={brands}
          loading={loading}
          emptyMessage="No brands defined."
        />
      </div>
    </div>
  );
}
