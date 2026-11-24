"use client";

import React from "react";
import Link from "next/link";
import { ArrowRightLeft, SlidersHorizontal, Search, FileCheck2 } from "lucide-react";

interface OptionItem {
  _id: string;
  name: string;
  code?: string;
}

interface InventoryHeaderProps {
  dealerships: OptionItem[];
  warehouses: OptionItem[];
  selectedDealership: string;
  selectedWarehouse: string;
  onDealershipChange: (id: string) => void;
  onWarehouseChange: (id: string) => void;
  search: string;
  onSearchChange: (search: string) => void;
  onOpenAdjust: () => void;
  onOpenTransfer: () => void;
}

export function InventoryHeader({
  dealerships,
  warehouses,
  selectedDealership,
  selectedWarehouse,
  onDealershipChange,
  onWarehouseChange,
  search,
  onSearchChange,
  onOpenAdjust,
  onOpenTransfer,
}: InventoryHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Inventory & Warehouse Management
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Multi-dealership physical stock ledger, batch landed costs, and shared warehouse tracking
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/inventory/grn"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <FileCheck2 className="h-3.5 w-3.5 text-slate-500" />
            <span>Challan / GRN Receiving</span>
          </Link>
          <button
            type="button"
            onClick={onOpenTransfer}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <ArrowRightLeft className="h-3.5 w-3.5 text-slate-500" />
            <span>Warehouse Transfer</span>
          </button>
          <button
            type="button"
            onClick={onOpenAdjust}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-sky-600 transition-colors"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Stock Adjustment</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by product name, SKU, or barcode..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedDealership}
            onChange={(e) => onDealershipChange(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 focus:bg-white focus:outline-hidden"
          >
            <option value="">All Dealerships</option>
            {dealerships.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name} {d.code ? `(${d.code})` : ""}
              </option>
            ))}
          </select>

          <select
            value={selectedWarehouse}
            onChange={(e) => onWarehouseChange(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 focus:bg-white focus:outline-hidden"
          >
            <option value="">All Warehouses</option>
            {warehouses.map((w) => (
              <option key={w._id} value={w._id}>
                {w.name} {w.code ? `(${w.code})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
