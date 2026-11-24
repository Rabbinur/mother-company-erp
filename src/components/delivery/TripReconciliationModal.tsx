"use client";

import React, { useState } from "react";
import { X, CheckCircle2, AlertCircle, DollarSign, Package } from "lucide-react";

interface TripReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  dispatch: any;
  onSuccess: (updatedDispatch: any) => void;
}

export function TripReconciliationModal({
  isOpen,
  onClose,
  dispatch,
  onSuccess,
}: TripReconciliationModalProps) {
  const [cashDeposited, setCashDeposited] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !dispatch) return null;

  const totalCollected = (dispatch.orders || []).reduce(
    (sum: number, o: any) => sum + (o.cashCollected || 0),
    0
  );
  const totalLoaded = (dispatch.items || []).reduce(
    (sum: number, it: any) => sum + (it.loadedQuantity || 0),
    0
  );
  const totalDelivered = (dispatch.items || []).reduce(
    (sum: number, it: any) => sum + (it.deliveredQuantity || 0),
    0
  );
  const totalReturned = (dispatch.items || []).reduce(
    (sum: number, it: any) => sum + (it.returnedQuantity || 0),
    0
  );
  const totalDamaged = (dispatch.items || []).reduce(
    (sum: number, it: any) => sum + (it.damagedQuantity || 0),
    0
  );
  const totalUndelivered = Math.max(0, totalLoaded - (totalDelivered + totalReturned + totalDamaged));

  const cashDiff = cashDeposited - totalCollected;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/delivery/dispatches/${dispatch._id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cashDeposited,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to reconcile trip");

      onSuccess(data.data);
      onClose();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-lg flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-base font-semibold text-foreground">Trip Close & Stock Reconciliation</h2>
            <p className="text-xs text-muted-foreground">{dispatch.dispatchNumber}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-muted-foreground hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-2.5 text-xs text-red-600 bg-red-500/10 border border-red-200 rounded-md">
              {error}
            </div>
          )}

          {/* Stock Formula Breakdown */}
          <div className="p-3 rounded-lg border bg-muted/20 space-y-2 text-xs">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-primary" />
              Stock Custody Reconciliation Formula
            </div>
            <div className="grid grid-cols-2 gap-2 text-muted-foreground pt-1">
              <div>Loaded: <strong className="text-foreground">{totalLoaded}</strong></div>
              <div>Delivered: <strong className="text-emerald-600">{totalDelivered}</strong></div>
              <div>Returns: <strong className="text-blue-600">{totalReturned}</strong></div>
              <div>Damaged: <strong className="text-red-600">{totalDamaged}</strong></div>
              <div className="col-span-2 pt-1 border-t text-foreground font-medium">
                Undelivered to Shelf: <strong>{totalUndelivered}</strong>
              </div>
            </div>
          </div>

          {/* Cash Reconciliation */}
          <div className="p-3 rounded-lg border bg-muted/20 space-y-2.5">
            <div className="font-semibold text-xs text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-primary" /> Cash Collections
              </span>
              <span className="font-mono text-sm">৳{totalCollected.toLocaleString()}</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Cash Deposited by Driver (৳)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={cashDeposited}
                onChange={(e) => setCashDeposited(Number(e.target.value))}
                className="w-full text-xs rounded-md border border-input bg-background p-2 font-mono"
                placeholder="0.00"
                required
              />
            </div>

            <div className="flex justify-between items-center text-xs pt-1 border-t">
              <span className="text-muted-foreground">Variance:</span>
              <span
                className={`font-mono font-semibold ${
                  cashDiff === 0
                    ? "text-emerald-600"
                    : cashDiff < 0
                    ? "text-red-600"
                    : "text-blue-600"
                }`}
              >
                {cashDiff === 0 ? "৳0 (Balanced)" : `৳${cashDiff.toLocaleString()}`}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Reconciliation Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs rounded-md border border-input bg-background p-2 text-foreground"
              placeholder="Driver remarks, discrepancy explanations, etc."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium rounded-md border border-input hover:bg-muted text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? "Reconciling..." : "Close & Reconcile Trip"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
