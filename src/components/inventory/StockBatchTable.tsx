"use client";

import React from "react";
import { formatCurrency } from "@/lib/utils";

export interface BatchItem {
  _id: string;
  batchNumber?: string;
  purchaseInvoiceRef?: string;
  challanNumber?: string;
  productId?: { name: string; sku: string };
  variantId?: { variantName: string; sku: string };
  warehouseId?: { name: string };
  principalCompanyId?: { name: string };
  receiptDate: string;
  expiryDate?: string | null;
  totalReceivedQuantity: number;
  remainingQuantity: number;
  netLandedUnitCost: number;
  grossPurchasePrice: number;
  status: string;
}

interface StockBatchTableProps {
  batches: BatchItem[];
  loading: boolean;
}

export function StockBatchTable({ batches, loading }: StockBatchTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Batch / Lot #</th>
              <th className="px-4 py-3">Product / SKU</th>
              <th className="px-4 py-3">Challan / Invoice</th>
              <th className="px-4 py-3">Receipt Date</th>
              <th className="px-4 py-3 text-right">Received Qty</th>
              <th className="px-4 py-3 text-right">Remaining Qty</th>
              <th className="px-4 py-3 text-right">Net Landed Cost</th>
              <th className="px-4 py-3">Expiry Date</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-xs text-slate-400">
                  Loading stock batches...
                </td>
              </tr>
            ) : batches.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-xs text-slate-400">
                  No active stock batches found.
                </td>
              </tr>
            ) : (
              batches.map((b) => (
                <tr key={b._id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold text-slate-800">
                    {b.batchNumber || "STANDARD-LOT"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{b.productId?.name}</div>
                    <div className="text-[10px] font-mono text-slate-400">{b.variantId?.sku}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600">
                    {b.challanNumber || b.purchaseInvoiceRef || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(b.receiptDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {b.totalReceivedQuantity}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-700">
                    {b.remainingQuantity}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-primary">
                    {formatCurrency(b.netLandedUnitCost)}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {b.expiryDate ? new Date(b.expiryDate).toLocaleDateString() : "No Expiry"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                        b.status === "active"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
