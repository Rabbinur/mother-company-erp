"use client";

import React, { useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Search, Edit3 } from "lucide-react";

export interface GrnItemRow {
  lineItemNumber: number;
  productName: string;
  productId?: string | null;
  variantId?: string | null;
  sku?: string;
  barcode?: string;
  uom?: string;
  matchStatus: "matched" | "ambiguous" | "unmatched" | "manual";
  matchConfidence?: number;
  matchedVariantName?: string;
  challanQuantity: number;
  supplierSchemeFreeQuantity: number;
  manualFreeQuantity: number;
  receivedQuantity: number;
  shortageQuantity: number;
  damagedQuantity: number;
  rejectedQuantity: number;
  batchNumber?: string;
  expiryDate?: string | Date | null;
  unitPurchasePrice: number;
  lineDiscount: number;
  netLandedUnitCost: number;
  lineTotal: number;
}

interface GrnProductMatchingTableProps {
  items: GrnItemRow[];
  canViewCost?: boolean;
  onItemChange: (index: number, updated: Partial<GrnItemRow>) => void;
  onOpenProductPicker?: (index: number) => void;
  isReadOnly?: boolean;
}

export function GrnProductMatchingTable({
  items,
  canViewCost = true,
  onItemChange,
  onOpenProductPicker,
  isReadOnly = false,
}: GrnProductMatchingTableProps) {
  const getMatchBadge = (status: string, conf?: number) => {
    switch (status) {
      case "matched":
      case "manual":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono font-medium rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3" /> Matched {conf ? `(${Math.round(conf * 100)}%)` : ""}
          </span>
        );
      case "ambiguous":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono font-medium rounded bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-3 h-3" /> Ambiguous
          </span>
        );
      case "unmatched":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono font-medium rounded bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
            <XCircle className="w-3 h-3" /> Unmatched
          </span>
        );
    }
  };

  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden mb-6">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
            Product Catalog Matching ({items.length} lines)
          </h3>
          <p className="text-xs text-zinc-700 dark:text-zinc-300">
            Every item must map to a verified central catalog product before confirmation.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850/50 text-zinc-600 dark:text-zinc-400 font-medium">
              <th className="py-2.5 px-3 w-10 text-center font-mono">#</th>
              <th className="py-2.5 px-3 min-w-[200px]">Challan Line Item</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3 min-w-[180px]">Matched Catalog Product</th>
              <th className="py-2.5 px-3 font-mono text-right">Challan Qty</th>
              <th className="py-2.5 px-3 font-mono text-right">Scheme Free</th>
              {canViewCost && (
                <>
                  <th className="py-2.5 px-3 font-mono text-right">Rate</th>
                  <th className="py-2.5 px-3 font-mono text-right">Line Disc</th>
                  <th className="py-2.5 px-3 font-mono text-right">Line Total</th>
                </>
              )}
              {!isReadOnly && <th className="py-2.5 px-3 text-right">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {items.length === 0 ? (
              <tr>
                <td colSpan={canViewCost ? 10 : 7} className="py-8 text-center text-zinc-400 font-mono">
                  No line items. Add manually or scan challan document.
                </td>
              </tr>
            ) : (
              items.map((item, idx) => (
                <tr key={idx} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-850/30 transition-colors">
                  <td className="py-2.5 px-3 text-center font-mono text-zinc-700 dark:text-zinc-300">
                    {item.lineItemNumber}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">{item.productName}</div>
                    {(item.sku || item.barcode) && (
                      <div className="text-xs font-mono text-zinc-700 dark:text-zinc-300">
                        {item.sku ? `SKU: ${item.sku}` : ""} {item.barcode ? `| Barcode: ${item.barcode}` : ""}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3">{getMatchBadge(item.matchStatus, item.matchConfidence)}</td>
                  <td className="py-2.5 px-3">
                    {item.productId ? (
                      <div>
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">
                          {item.productName}
                        </div>
                        {item.matchedVariantName && (
                          <div className="text-xs font-mono text-zinc-700 dark:text-zinc-300">
                            Variant: {item.matchedVariantName}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-zinc-700 dark:text-zinc-300 italic">Not matched yet</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                    {item.challanQuantity} {item.uom || "pcs"}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                    {item.supplierSchemeFreeQuantity > 0 ? `+${item.supplierSchemeFreeQuantity}` : "-"}
                  </td>
                  {canViewCost && (
                    <>
                      <td className="py-2.5 px-3 font-mono text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                        ৳{item.unitPurchasePrice.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                        {item.lineDiscount > 0 ? `৳${item.lineDiscount.toFixed(2)}` : "-"}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-right tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                        ৳{item.lineTotal.toFixed(2)}
                      </td>
                    </>
                  )}
                  {!isReadOnly && (
                    <td className="py-2.5 px-3 text-right">
                      {onOpenProductPicker && (
                        <button
                          type="button"
                          onClick={() => onOpenProductPicker(idx)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
                        >
                          <Search className="w-3 h-3" /> Assign
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
