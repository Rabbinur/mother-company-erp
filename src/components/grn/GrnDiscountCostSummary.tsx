"use client";

import React from "react";
import { Lock } from "lucide-react";

interface GrnDiscountCostSummaryProps {
  grossTotal: number;
  totalLineDiscount: number;
  invoiceDiscount: number;
  invoiceDiscountType?: "fixed" | "percentage";
  cashDiscount: number;
  tradeDiscount: number;
  freightCharge: number;
  handlingCharge: number;
  otherCharges: number;
  taxTotal: number;
  netInvoiceTotal: number;
  canViewCost?: boolean;
  onUpdateDiscounts?: (updated: {
    invoiceDiscount?: number;
    cashDiscount?: number;
    tradeDiscount?: number;
    freightCharge?: number;
    handlingCharge?: number;
  }) => void;
  isReadOnly?: boolean;
}

export function GrnDiscountCostSummary({
  grossTotal,
  totalLineDiscount,
  invoiceDiscount,
  cashDiscount,
  tradeDiscount,
  freightCharge,
  handlingCharge,
  taxTotal,
  netInvoiceTotal,
  canViewCost = true,
  onUpdateDiscounts,
  isReadOnly = false,
}: GrnDiscountCostSummaryProps) {
  if (!canViewCost) {
    return (
      <div className="rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 p-4 mb-6">
        <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
          <Lock className="w-3.5 h-3.5 text-zinc-400" />
          <span>Purchase costs and supplier commercial terms are restricted to authorized roles.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 mb-6">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800 mb-4">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
            Commercial Terms, Discounts & Net Landed Cost
          </h3>
          <p className="text-xs text-zinc-700 dark:text-zinc-300">
            All discounts and freight are absorbed proportionally to compute historical landed unit cost.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left column: Expenses & invoice discount inputs */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-700 dark:text-zinc-300">Invoice Level Discount:</span>
            {isReadOnly ? (
              <span className="font-mono tabular-nums text-zinc-900 dark:text-zinc-100">৳{invoiceDiscount.toFixed(2)}</span>
            ) : (
              <input
                type="number"
                min="0"
                value={invoiceDiscount}
                onChange={(e) => onUpdateDiscounts?.({ invoiceDiscount: Number(e.target.value) })}
                className="w-28 text-xs font-mono text-right rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-zinc-900 dark:text-zinc-100"
              />
            )}
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-700 dark:text-zinc-300">Trade / Cash Discount:</span>
            {isReadOnly ? (
              <span className="font-mono tabular-nums text-zinc-900 dark:text-zinc-100">৳{(cashDiscount + tradeDiscount).toFixed(2)}</span>
            ) : (
              <input
                type="number"
                min="0"
                value={cashDiscount}
                onChange={(e) => onUpdateDiscounts?.({ cashDiscount: Number(e.target.value) })}
                className="w-28 text-xs font-mono text-right rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-zinc-900 dark:text-zinc-100"
              />
            )}
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-700 dark:text-zinc-300">Allocated Freight Charges:</span>
            {isReadOnly ? (
              <span className="font-mono tabular-nums text-zinc-900 dark:text-zinc-100">৳{freightCharge.toFixed(2)}</span>
            ) : (
              <input
                type="number"
                min="0"
                value={freightCharge}
                onChange={(e) => onUpdateDiscounts?.({ freightCharge: Number(e.target.value) })}
                className="w-28 text-xs font-mono text-right rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-zinc-900 dark:text-zinc-100"
              />
            )}
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-700 dark:text-zinc-300">Handling & Other Charges:</span>
            {isReadOnly ? (
              <span className="font-mono tabular-nums text-zinc-900 dark:text-zinc-100">৳{handlingCharge.toFixed(2)}</span>
            ) : (
              <input
                type="number"
                min="0"
                value={handlingCharge}
                onChange={(e) => onUpdateDiscounts?.({ handlingCharge: Number(e.target.value) })}
                className="w-28 text-xs font-mono text-right rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-zinc-900 dark:text-zinc-100"
              />
            )}
          </div>
        </div>

        {/* Right column: Summary breakdown */}
        <div className="p-4 rounded bg-zinc-50 dark:bg-zinc-850/60 border border-zinc-200/80 dark:border-zinc-800 space-y-2 text-xs">
          <div className="flex justify-between text-zinc-700 dark:text-zinc-300">
            <span>Gross Challan Value:</span>
            <span className="font-mono tabular-nums text-zinc-900 dark:text-zinc-100">৳{grossTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-zinc-700 dark:text-zinc-300">
            <span>Total Line Discounts:</span>
            <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">-৳{totalLineDiscount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-zinc-700 dark:text-zinc-300">
            <span>Invoice & Cash Discounts:</span>
            <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
              -৳{(invoiceDiscount + cashDiscount + tradeDiscount).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-zinc-700 dark:text-zinc-300">
            <span>Freight & Handling:</span>
            <span className="font-mono tabular-nums text-zinc-900 dark:text-zinc-100">+৳{(freightCharge + handlingCharge).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-zinc-700 dark:text-zinc-300">
            <span>Tax (VAT/AIT):</span>
            <span className="font-mono tabular-nums text-zinc-900 dark:text-zinc-100">+৳{taxTotal.toFixed(2)}</span>
          </div>
          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700 flex justify-between font-medium text-sm text-zinc-900 dark:text-zinc-100">
            <span>Net Payable / Receipt Total:</span>
            <span className="font-mono tabular-nums">৳{netInvoiceTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
