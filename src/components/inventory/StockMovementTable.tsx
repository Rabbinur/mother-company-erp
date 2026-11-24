"use client";

import React from "react";
import { formatCurrency } from "@/lib/utils";

export interface MovementItem {
  _id: string;
  movementNumber: string;
  type: string;
  productId?: { name: string; sku: string };
  variantId?: { variantName: string; sku: string };
  warehouseId?: { name: string };
  batchNumber?: string;
  quantity: number;
  unitCost?: number;
  previousOnHand: number;
  newOnHand: number;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  createdAt: string;
}

interface StockMovementTableProps {
  movements: MovementItem[];
  loading: boolean;
}

const TYPE_BADGES: Record<string, { label: string; className: string }> = {
  purchase_receive: { label: "Purchase In", className: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  sales_fulfillment: { label: "Fulfillment", className: "bg-sky-50 text-sky-700 border-sky-100" },
  reservation: { label: "Reserved", className: "bg-amber-50 text-amber-700 border-amber-100" },
  reservation_release: { label: "Released", className: "bg-slate-100 text-slate-700 border-slate-200" },
  manual_adjustment: { label: "Adjustment", className: "bg-purple-50 text-purple-700 border-purple-100" },
  damage: { label: "Damage", className: "bg-red-50 text-red-700 border-red-100" },
  warehouse_transfer_in: { label: "Transfer In", className: "bg-blue-50 text-blue-700 border-blue-100" },
  warehouse_transfer_out: { label: "Transfer Out", className: "bg-orange-50 text-orange-700 border-orange-100" },
  physical_count_adjustment: { label: "Stock Count", className: "bg-indigo-50 text-indigo-700 border-indigo-100" },
};

export function StockMovementTable({ movements, loading }: StockMovementTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Movement #</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Product / SKU</th>
              <th className="px-4 py-3">Batch #</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Unit Cost</th>
              <th className="px-4 py-3 text-right">OnHand Step</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-xs text-slate-400">
                  Loading movement ledger...
                </td>
              </tr>
            ) : movements.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-xs text-slate-400">
                  No stock movements recorded yet.
                </td>
              </tr>
            ) : (
              movements.map((m) => {
                const badge = TYPE_BADGES[m.type] || {
                  label: m.type,
                  className: "bg-slate-100 text-slate-600 border-slate-200",
                };
                const isPositive = m.quantity > 0;
                return (
                  <tr key={m._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-slate-800">
                      {m.movementNumber}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{m.productId?.name || "Product"}</div>
                      <div className="text-[10px] font-mono text-slate-400">{m.variantId?.sku}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">
                      {m.batchNumber || "—"}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${isPositive ? "text-emerald-600" : "text-slate-800"}`}>
                      {isPositive ? `+${m.quantity}` : m.quantity}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {m.unitCost !== undefined ? formatCurrency(m.unitCost) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[11px] text-slate-500">
                      {m.previousOnHand} → {m.newOnHand}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>{m.referenceId || "—"}</div>
                      <div className="text-[10px] text-slate-400">{m.notes}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-[11px]">
                      {new Date(m.createdAt).toLocaleString()}
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
