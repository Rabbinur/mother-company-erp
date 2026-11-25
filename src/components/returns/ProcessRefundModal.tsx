"use client";

import React, { useState } from "react";
import { X, DollarSign, AlertCircle, ShieldCheck } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface ProcessRefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  returnId: string;
  returnNumber: string;
  maxRefundAmount: number;
}

export function ProcessRefundModal({
  isOpen,
  onClose,
  onSuccess,
  returnId,
  returnNumber,
  maxRefundAmount,
}: ProcessRefundModalProps) {
  const [refundMethod, setRefundMethod] = useState<"credit_note" | "cash_refund" | "bank_refund">(
    "credit_note"
  );
  const [amount, setAmount] = useState(String(maxRefundAmount || 0));
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const refundAmt = Number(amount);
    if (isNaN(refundAmt) || refundAmt <= 0) {
      setError("Refund amount must be greater than zero");
      return;
    }
    if (refundAmt > maxRefundAmount) {
      setError(`Refund amount cannot exceed approved amount (${formatCurrency(maxRefundAmount)})`);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/v1/returns/sales/${returnId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refundMethod,
          refundAmount: refundAmt,
          refundReference: reference.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Failed to process refund");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to process refund");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-xl border border-border/50 bg-card p-6 shadow-xl text-card-foreground">
        <div className="flex items-center justify-between border-b border-border/40 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Issue Customer Refund / Credit</h3>
              <p className="text-xs text-muted-foreground">{returnNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg bg-muted/40 p-3 border border-border/40 flex justify-between items-center text-xs">
            <span className="text-muted-foreground">Max Eligible Refund:</span>
            <span className="font-semibold text-foreground">{formatCurrency(maxRefundAmount)}</span>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Settlement Method</label>
            <select
              value={refundMethod}
              onChange={(e) => setRefundMethod(e.target.value as any)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:ring-1 focus:ring-primary"
            >
              <option value="credit_note">Credit Note (Reduces Customer Due Balance)</option>
              <option value="cash_refund">Cash Refund</option>
              <option value="bank_refund">Bank Transfer / Cheque</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Refund Amount ($) <span className="text-destructive">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              max={maxRefundAmount}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:ring-1 focus:ring-primary font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Payment / Credit Reference
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. CRN-2026-001 or Cheque #"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium rounded-md border border-input bg-background hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-3.5 py-2 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Processing..." : "Confirm Settlement"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
