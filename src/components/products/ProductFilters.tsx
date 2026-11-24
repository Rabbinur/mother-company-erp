"use client";

import React from "react";
import { Search } from "lucide-react";

interface CategoryOption {
  _id: string;
  name: string;
}

interface ProductFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
  categories: CategoryOption[];
}

export function ProductFilters({
  search,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  categories,
}: ProductFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name, SKU, or barcode..."
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden"
        />
      </div>

      <div className="flex items-center gap-3">
        <select
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
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
  );
}
