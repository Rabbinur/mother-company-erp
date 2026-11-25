"use client";

import React, { useState } from "react";
import { X, CheckCircle2, AlertCircle } from "lucide-react";

interface InspectReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  returnId: string;
  returnNumber: string;
}

export function InspectReturnModal({
  isOpen,
  onClose,
  onSuccess,
  returnId,
  returnNumber,
}: InspectReturnModalProps) {
  const [classification, setClassification] = useState("GOOD_RESTOCKABLE");
  const [conditionNotes, setConditionNotes] = useState("");
  const [approveNow, setApproveNow] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError(null);

      // Step 1: Submit inspection
      const inspectRes = await fetch(`/api/v1/returns/sales/${returnId}/inspect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspectionNotes: conditionNotes.trim() || "Item inspected and classified",
          itemClassifications: [
            {
              itemIndex: 0,
              classification,
              conditionNotes: conditionNotes.trim() || undefined,
            },
          ],
        }),
      });

      const inspectJson = await inspectRes.json();
      if (!inspectRes.ok) {
        throw new Error(inspectJson.message || "Failed to submit inspection");
      }

      // Step 2: If requested, immediately approve and restock
      if (approveNow) {
        const approveRes = await fetch(`/api/v1/returns/sales/${returnId}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "APPROVE",
            notes: "Approved after inspection",
          }),
        });

        const approveJson = await approveRes.json();
        if (!approveRes.ok) {
          throw new Error(approveJson.message || "Failed to approve return");
        }
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to process inspection");
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
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">QA & Return Inspection</h3>
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
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Item Physical Classification
            </label>
            <select
              value={classification}
              onChange={(e) => setClassification(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:ring-1 focus:ring-primary"
            >
              <option value="GOOD_RESTOCKABLE">Good Condition (Restock to Available)</option>
              <option value="DAMAGED">Damaged Goods (Quarantine to Damaged Stock)</option>
              <option value="EXPIRED">Expired Goods (Quarantine to Damaged Stock)</option>
              <option value="WRONG_PRODUCT">Wrong Product Delivered</option>
              <option value="REJECTED">Customer Rejection / No Fault</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Inspection Notes</label>
            <textarea
              rows={3}
              value={conditionNotes}
              onChange={(e) => setConditionNotes(e.target.value)}
              placeholder="Record packaging state, seals, serials or damage..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="approveNow"
              checked={approveNow}
              onChange={(e) => setApproveNow(e.target.checked)}
              className="rounded border-input text-primary focus:ring-primary"
            />
            <label htmlFor="approveNow" className="text-xs text-foreground cursor-pointer">
              Automatically approve and restock inventory upon saving
            </label>
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
              {loading ? "Processing..." : approveNow ? "Save & Restock" : "Record Inspection"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
