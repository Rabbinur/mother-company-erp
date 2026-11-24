"use client";

import React, { useState } from "react";
import { Modal, FormField, Input, Textarea } from "@/components/shared";

interface OptionItem {
  _id: string;
  name: string;
}

interface StockTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  dealerships: OptionItem[];
  warehouses: OptionItem[];
  onSuccess: () => void;
}

export function StockTransferModal({
  isOpen,
  onClose,
  dealerships,
  warehouses,
  onSuccess,
}: StockTransferModalProps) {
  const [dealershipId, setDealershipId] = useState("");
  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    if (fromWarehouseId === toWarehouseId) {
      setError("Source and destination warehouses cannot be the same");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/v1/inventory/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealershipId,
          fromWarehouseId,
          toWarehouseId,
          productId,
          variantId,
          quantity: parseFloat(quantity) || 0,
          notes,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to transfer stock");
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error executing transfer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Warehouse Stock Transfer"
      description="Transfer stock between physical warehouses for the SAME dealership"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <FormField label="Dealership Owner (Cannot cross boundaries)" required>
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

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Source Warehouse" required>
            <select
              required
              value={fromWarehouseId}
              onChange={(e) => setFromWarehouseId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:outline-hidden focus:border-primary"
            >
              <option value="">From Warehouse</option>
              {warehouses.map((w) => (
                <option key={w._id} value={w._id}>
                  {w.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Destination Warehouse" required>
            <select
              required
              value={toWarehouseId}
              onChange={(e) => setToWarehouseId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:outline-hidden focus:border-primary"
            >
              <option value="">To Warehouse</option>
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
              placeholder="Product ObjectId"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            />
          </FormField>

          <FormField label="Variant ID" required>
            <Input
              required
              placeholder="Variant ObjectId"
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
            />
          </FormField>
        </div>

        <FormField label="Transfer Quantity" required>
          <Input
            type="number"
            step="1"
            min="1"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Units to transfer"
          />
        </FormField>

        <FormField label="Transfer Notes">
          <Textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Vehicle details, challan, or driver info..."
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
            {saving ? "Transferring..." : "Execute Transfer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
