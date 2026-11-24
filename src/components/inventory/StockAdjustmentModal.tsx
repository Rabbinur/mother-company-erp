"use client";

import React, { useState } from "react";
import { Modal, FormField, Input, Textarea } from "@/components/shared";

interface OptionItem {
  _id: string;
  name: string;
}

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  dealerships: OptionItem[];
  warehouses: OptionItem[];
  onSuccess: () => void;
}

export function StockAdjustmentModal({
  isOpen,
  onClose,
  dealerships,
  warehouses,
  onSuccess,
}: StockAdjustmentModalProps) {
  const [dealershipId, setDealershipId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [adjustmentQty, setAdjustmentQty] = useState("");
  const [isDamage, setIsDamage] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/v1/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealershipId,
          warehouseId,
          productId,
          variantId,
          adjustmentQty: parseFloat(adjustmentQty) || 0,
          isDamage,
          reason,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to adjust stock");
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error executing adjustment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Stock Adjustment & Damage Recording"
      description="Record quantity variance, shortage, excess, or damage with full audit tracking"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Dealership Owner" required>
            <select
              required
              value={dealershipId}
              onChange={(e) => setDealershipId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:outline-hidden focus:border-primary"
            >
              <option value="">Select Dealership</option>
              {dealerships.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Warehouse" required>
            <select
              required
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:outline-hidden focus:border-primary"
            >
              <option value="">Select Warehouse</option>
              {warehouses.map((w) => (
                <option key={w._id} value={w._id}>
                  {w.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Product ID" required>
            <Input
              required
              placeholder="Target Product ID"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            />
          </FormField>

          <FormField label="Variant ID" required>
            <Input
              required
              placeholder="Target Variant ID"
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
            />
          </FormField>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
          <input
            type="checkbox"
            id="isDamageCheck"
            checked={isDamage}
            onChange={(e) => setIsDamage(e.target.checked)}
            className="rounded border-slate-300 text-primary focus:ring-primary"
          />
          <label htmlFor="isDamageCheck" className="text-xs font-medium text-slate-700">
            Mark as Damaged Stock (Moves from available to damaged quarantine)
          </label>
        </div>

        <FormField label={isDamage ? "Damaged Quantity" : "Adjustment Quantity (Use '-' for shortage)"} required>
          <Input
            type="number"
            step="1"
            required
            value={adjustmentQty}
            onChange={(e) => setAdjustmentQty(e.target.value)}
            placeholder="e.g. 5 or -2"
          />
        </FormField>

        <FormField label="Audit Reason" required>
          <Textarea
            required
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Provide specific business justification for this inventory delta..."
          />
        </FormField>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-sky-600 disabled:opacity-50"
          >
            {saving ? "Processing..." : "Commit Adjustment"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
