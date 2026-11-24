"use client";

import React, { useState } from "react";
import { Modal, FormField, Input, Textarea } from "@/components/shared";

interface CategoryModalsProps {
  showCatModal: boolean;
  onCloseCatModal: () => void;
  onCategoryCreated: () => void;
  showBrandModal: boolean;
  onCloseBrandModal: () => void;
  onBrandCreated: () => void;
}

export function CategoryModals({
  showCatModal,
  onCloseCatModal,
  onCategoryCreated,
  showBrandModal,
  onCloseBrandModal,
  onBrandCreated,
}: CategoryModalsProps) {
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [brandName, setBrandName] = useState("");
  const [brandDesc, setBrandDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    try {
      const res = await fetch("/api/v1/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: catName, description: catDesc }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to create category");
      }

      setCatName("");
      setCatDesc("");
      onCategoryCreated();
      onCloseCatModal();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Error creating category");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    try {
      const res = await fetch("/api/v1/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: brandName, description: brandDesc }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to create brand");
      }

      setBrandName("");
      setBrandDesc("");
      onBrandCreated();
      onCloseBrandModal();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Error creating brand");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={showCatModal}
        onClose={onCloseCatModal}
        title="Add Category"
        description="Create a new classification category for products"
      >
        <form onSubmit={handleCreateCategory} className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
              {formError}
            </div>
          )}
          <FormField label="Category Name" required>
            <Input
              required
              placeholder="e.g. Refrigerators, Televisions..."
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
            />
          </FormField>
          <FormField label="Description">
            <Textarea
              rows={2}
              placeholder="Optional notes or details..."
              value={catDesc}
              onChange={(e) => setCatDesc(e.target.value)}
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onCloseCatModal}
              className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-sky-600 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Category"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showBrandModal}
        onClose={onCloseBrandModal}
        title="Add Brand"
        description="Create a new manufacturer or brand label"
      >
        <form onSubmit={handleCreateBrand} className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
              {formError}
            </div>
          )}
          <FormField label="Brand Name" required>
            <Input
              required
              placeholder="e.g. Walton, Marcel, Haier..."
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
            />
          </FormField>
          <FormField label="Description">
            <Textarea
              rows={2}
              placeholder="Brand information..."
              value={brandDesc}
              onChange={(e) => setBrandDesc(e.target.value)}
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onCloseBrandModal}
              className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-sky-600 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Brand"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
