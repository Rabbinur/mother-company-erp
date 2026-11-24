"use client";

import React from "react";
import { Plus } from "lucide-react";

interface ProductHeaderProps {
  onAddNew: () => void;
}

export function ProductHeader({ onAddNew }: ProductHeaderProps) {
  return (
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
        onClick={onAddNew}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-sky-600 transition-colors"
      >
        <Plus className="h-4 w-4" />
        <span>Add New Product</span>
      </button>
    </div>
  );
}
