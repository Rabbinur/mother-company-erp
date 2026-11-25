"use client";

import React, { useState } from "react";
import { X, ShieldAlert, AlertCircle } from "lucide-react";

interface CreateClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  dealershipId?: string;
}

export function CreateClaimModal({
  isOpen,
  onClose,
  onSuccess,
  dealershipId,
}: CreateClaimModalProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("delivery_transit_damage");
  const [claimedAgainstType, setClaimedAgainstType] = useState<
    "supplier" | "transporter" | "principal" | "internal" | "insurance"
  >("transporter");
  const [claimedAmount, setClaimedAmount] = useState("");
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().split("T")[0]);
  const [calculationBasis, setCalculationBasis] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Claim title is required");
      return;
    }
    const amt = Number(claimedAmount);
    if (isNaN(amt) || amt <= 0) {
      setError("Claimed amount must be greater than zero");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/v1/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          category,
          claimedAgainstType,
          claimedAmount: amt,
          incidentDate: new Date(incidentDate),
          calculationBasis: calculationBasis.trim() || undefined,
          dealershipId: dealershipId || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Failed to submit claim");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to submit claim");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-xl border border-border/50 bg-card p-6 shadow-xl text-card-foreground">
        <div className="flex items-center justify-between border-b border-border/40 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-destructive/10 text-destructive">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">File Loss / Damage Claim</h3>
              <p className="text-xs text-muted-foreground">Supplier shortage, transit breakages or warranties</p>
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
              Claim Title <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Transit bottle breakage on Route 102"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:ring-1 focus:ring-primary"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:ring-1 focus:ring-primary"
              >
                <option value="delivery_transit_damage">Transit Damage</option>
                <option value="supplier_damage">Supplier Damage</option>
                <option value="supplier_shortage">Supplier Shortage</option>
                <option value="warehouse_damage">Warehouse Spoilage</option>
                <option value="principal_reimbursement">Principal Warranty</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Target Party</label>
              <select
                value={claimedAgainstType}
                onChange={(e) => setClaimedAgainstType(e.target.value as any)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:ring-1 focus:ring-primary"
              >
                <option value="transporter">Transporter / Logistics</option>
                <option value="supplier">Supplier / Vendor</option>
                <option value="principal">Principal Manufacturer</option>
                <option value="internal">Internal Warehouse</option>
                <option value="insurance">Insurance Company</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Claimed Amount ($) <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={claimedAmount}
                onChange={(e) => setClaimedAmount(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:ring-1 focus:ring-primary font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Incident Date</label>
              <input
                type="date"
                value={incidentDate}
                onChange={(e) => setIncidentDate(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Basis of Loss Calculation</label>
            <textarea
              rows={2}
              value={calculationBasis}
              onChange={(e) => setCalculationBasis(e.target.value)}
              placeholder="e.g. 5 cases damaged @ $20.00 landed cost each..."
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
              {loading ? "Submitting..." : "File Claim"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
