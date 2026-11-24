"use client";

import React from "react";
import { Layers } from "lucide-react";

export interface BalanceItem {
  _id: string;
  dealershipId?: { _id: string; name: string; code?: string };
  warehouseId?: { _id: string; name: string; code?: string };
  productId?: { _id: string; name: string; sku: string; unit?: string };
  variantId?: { _id: string; variantName: string; sku: string };
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  damagedQuantity: number;
  lastUpdated: string;
}

interface InventoryTableProps {
  balances: BalanceItem[];
  loading: boolean;
}

export function InventoryTable({ balances, loading }: InventoryTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Product & Variant</th>
              <th className="px-4 py-3">Dealership Owner</th>
              <th className="px-4 py-3">Warehouse</th>
              <th className="px-4 py-3 text-right">On Hand</th>
              <th className="px-4 py-3 text-right">Reserved</th>
              <th className="px-4 py-3 text-right">Available</th>
              <th className="px-4 py-3 text-right">Damaged</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-xs text-slate-400">
                  Loading inventory balances...
                </td>
              </tr>
            ) : balances.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-xs text-slate-400">
                  No inventory balances found for this selection.
                </td>
              </tr>
            ) : (
              balances.map((b) => {
                const isOutOfStock = b.availableQuantity <= 0;
                return (
                  <tr key={b._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{b.productId?.name || "Product"}</div>
                      <div className="text-[11px] font-mono text-slate-400">
                        SKU: {b.variantId?.sku || b.productId?.sku} ({b.variantId?.variantName || "Standard"})
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {b.dealershipId ? (
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                          {b.dealershipId.name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200">
                          Quarantined / Unassigned
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {b.warehouseId?.name || "Central Warehouse"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">
                      {b.onHandQuantity}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-amber-600">
                      {b.reservedQuantity}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700">
                      {b.availableQuantity}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-red-600">
                      {b.damagedQuantity || 0}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          isOutOfStock
                            ? "bg-red-50 text-red-700 border border-red-100"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                        }`}
                      >
                        {isOutOfStock ? "Out of Stock" : "In Stock"}
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
  );
}
