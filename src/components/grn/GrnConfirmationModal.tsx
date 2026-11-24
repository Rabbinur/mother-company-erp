"use client";

import React, { useState } from "react";
import { CheckCircle2, AlertTriangle, ShieldCheck, Loader2 } from "lucide-react";
import { GrnItemRow } from "./GrnProductMatchingTable";

interface GrnConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (idempotencyKey: string) => Promise<void>;
  grnNumber: string;
  challanNumber: string;
  warehouseName: string;
  items: GrnItemRow[];
  netInvoiceTotal: number;
  canViewCost?: boolean;
}

export function GrnConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  grnNumber,
  challanNumber,
  warehouseName,
  items,
  netInvoiceTotal,
  canViewCost = true,
}: GrnConfirmationModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalReceived = items.reduce((sum, i) => sum + (i.receivedQuantity || 0), 0);
  const totalDamaged = items.reduce((sum, i) => sum + (i.damagedQuantity || 0), 0);
  const totalSchemeFree = items.reduce((sum, i) => sum + (i.supplierSchemeFreeQuantity || 0), 0);
  const netGoodStock = Math.max(0, totalReceived - totalDamaged) + totalSchemeFree;

  const handleConfirmClick = async () => {
    setLoading(true);
    setError(null);
    try {
      const idempotencyKey = `grn_verify_${grnNumber}_${Date.now()}`;
      await onConfirm(idempotencyKey);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to confirm GRN");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
          <div className="p-2 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Confirm & Verify Goods Receipt
            </h2>
            <p className="text-xs text-zinc-700 dark:text-zinc-300">
              Verify GRN <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">{grnNumber}</span> (Challan: {challanNumber})
            </p>
          </div>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-400">
              {error}
            </div>
          )}

          <div className="p-3.5 rounded bg-zinc-50 dark:bg-zinc-850/60 border border-zinc-200/80 dark:border-zinc-800 space-y-2">
            <div className="flex justify-between text-zinc-700 dark:text-zinc-300">
              <span>Receiving Warehouse:</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{warehouseName}</span>
            </div>
            <div className="flex justify-between text-zinc-700 dark:text-zinc-300">
              <span>Total Physically Counted:</span>
              <span className="font-mono tabular-nums text-zinc-900 dark:text-zinc-100">{totalReceived} units</span>
            </div>
            {totalSchemeFree > 0 && (
              <div className="flex justify-between text-zinc-700 dark:text-zinc-300">
                <span>Supplier Scheme Free Units:</span>
                <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">+{totalSchemeFree} units</span>
              </div>
            )}
            {totalDamaged > 0 && (
              <div className="flex justify-between text-zinc-700 dark:text-zinc-300">
                <span>Damaged Units (Segregated):</span>
                <span className="font-mono tabular-nums text-rose-600 dark:text-rose-400">{totalDamaged} units</span>
              </div>
            )}
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700 flex justify-between font-medium text-zinc-900 dark:text-zinc-100">
              <span>Net Stock to Add to Dealership:</span>
              <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">{netGoodStock} units</span>
            </div>
            {canViewCost && (
              <div className="flex justify-between text-zinc-700 dark:text-zinc-300 pt-1">
                <span>Total Net Receipt Value:</span>
                <span className="font-mono tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">
                  ৳{netInvoiceTotal.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p>
              This action is permanent and creates immutable batch cost layers. Physical inventory for this dealership will increase immediately.
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850/30 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium rounded border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmClick}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Confirm Receipt & Update Stock
          </button>
        </div>
      </div>
    </div>
  );
}
