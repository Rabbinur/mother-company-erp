"use client";

import React, { useState } from "react";
import { Modal, FormField, Input } from "@/components/shared";
import { FlattenedPricingItem } from "./PricingTable";

interface PriceEditModalProps {
  item: FlattenedPricingItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function PriceEditModal({ item, onClose, onSuccess }: PriceEditModalProps) {
  const [purchasePrice, setPurchasePrice] = useState(
    item?.purchasePrice !== undefined ? String(item.purchasePrice) : "0"
  );
  const [customerPrice, setCustomerPrice] = useState(String(item?.customerPrice || "0"));
  const [retailPrice, setRetailPrice] = useState(String(item?.retailPrice || "0"));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  if (!item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    try {
      const res = await fetch("/api/v1/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: item.productId,
          variantId: item.variantId,
          newPurchasePrice: parseFloat(purchasePrice) || 0,
          newCustomerPrice: parseFloat(customerPrice) || 0,
          newRetailPrice: parseFloat(retailPrice) || 0,
          reason: reason || "Catalog price adjustment",
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to update price");
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Error updating price");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Update Pricing: ${item.productName}`}
      description={`SKU: ${item.sku} (${item.variantName})`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
            {formError}
          </div>
        )}

        {item.purchasePrice !== undefined ? (
          <FormField label="1. Purchase Price (Cost to Company)" required>
            <Input
              type="number"
              step="0.01"
              min="0"
              required
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
            />
          </FormField>
        ) : (
          <div className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-500 border border-slate-200">
            Purchase price modification is restricted to authorized financial management.
          </div>
        )}

        <FormField label="2. Customer Price (Wholesale Selling Price)" required>
          <Input
            type="number"
            step="0.01"
            min="0"
            required
            value={customerPrice}
            onChange={(e) => setCustomerPrice(e.target.value)}
          />
        </FormField>

        <FormField label="3. Retail Price (Suggested Retail Price / MSRP)" required>
          <Input
            type="number"
            step="0.01"
            min="0"
            required
            value={retailPrice}
            onChange={(e) => setRetailPrice(e.target.value)}
          />
        </FormField>

        <FormField label="Reason for Revision">
          <Input
            placeholder="e.g. Seasonal price revision, supplier cost increase..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
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
            {saving ? "Saving..." : "Save Revision"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
