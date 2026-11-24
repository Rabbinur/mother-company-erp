"use client";

import React, { useState, useEffect, useCallback, use } from "react";
import { GrnHeader } from "@/components/grn/GrnHeader";
import { GrnOcrStatusBanner } from "@/components/grn/GrnOcrStatusBanner";
import { GrnDocumentUpload } from "@/components/grn/GrnDocumentUpload";
import { GrnProductMatchingTable, GrnItemRow } from "@/components/grn/GrnProductMatchingTable";
import { GrnPhysicalReceivingTable } from "@/components/grn/GrnPhysicalReceivingTable";
import { GrnDiscountCostSummary } from "@/components/grn/GrnDiscountCostSummary";
import { GrnConfirmationModal } from "@/components/grn/GrnConfirmationModal";
import { ProductPickerModal } from "@/components/grn/ProductPickerModal";
import { Save, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export default function GrnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [grn, setGrn] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"matching" | "receiving" | "costs">("matching");

  // Modal states
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [pickerItemIndex, setPickerItemIndex] = useState<number | null>(null);

  const fetchGrn = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/grn/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load GRN");
      setGrn(data.data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch GRN");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchGrn();
  }, [fetchGrn]);

  const handleItemChange = (index: number, updated: Partial<GrnItemRow>) => {
    if (!grn) return;
    const newItems = [...grn.items];
    newItems[index] = { ...newItems[index], ...updated };
    setGrn({ ...grn, items: newItems });
  };

  const handleProductSelect = (selected: any) => {
    if (pickerItemIndex === null || !grn) return;
    const newItems = [...grn.items];
    newItems[pickerItemIndex] = {
      ...newItems[pickerItemIndex],
      productId: selected.productId,
      variantId: selected.variantId,
      productName: selected.productName,
      matchedVariantName: selected.variantName,
      sku: selected.sku,
      barcode: selected.barcode,
      matchStatus: "manual",
      matchConfidence: 1.0,
      unitPurchasePrice: newItems[pickerItemIndex].unitPurchasePrice || selected.purchasePrice || 0,
    };
    setGrn({ ...grn, items: newItems });
    setPickerItemIndex(null);
  };

  const handleTriggerOcr = async () => {
    try {
      const res = await fetch(`/api/v1/grn/${id}/ocr`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "OCR extraction failed");
      fetchGrn();
    } catch (err: any) {
      setError(err.message || "Failed to trigger OCR");
    }
  };

  const handleSaveGrn = async () => {
    if (!grn) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/grn/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: grn.items,
          invoiceDiscount: grn.invoiceDiscount,
          cashDiscount: grn.cashDiscount,
          tradeDiscount: grn.tradeDiscount,
          freightCharge: grn.freightCharge,
          handlingCharge: grn.handlingCharge,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save GRN");
      setGrn(data.data);
    } catch (err: any) {
      setError(err.message || "Save error");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmVerified = async (idempotencyKey: string) => {
    const res = await fetch(`/api/v1/grn/${id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idempotencyKey }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to confirm GRN");
    fetchGrn();
  };

  if (loading) {
    return <div className="p-8 text-center text-xs font-mono text-zinc-400">Loading GRN #{id}...</div>;
  }

  if (!grn) {
    return <div className="p-8 text-center text-xs text-rose-500 font-mono">GRN not found or unauthorized.</div>;
  }

  const isReadOnly = grn.status === "VERIFIED" || grn.status === "CANCELLED";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <GrnHeader
        title={`GRN ${grn.grnNumber}`}
        subtitle={`Supplier: ${grn.supplierId?.companyName || grn.supplierId?.name || "Direct"} • Challan: ${grn.challanNumber}`}
        grnNumber={grn.grnNumber}
        status={grn.status}
        isDetailPage
        onRefresh={fetchGrn}
        loading={loading}
      />

      <GrnOcrStatusBanner
        ocrStatus={grn.ocrStatus || "NOT_RUN"}
        confidence={grn.ocrMetadata?.overallConfidence}
        provider={grn.ocrMetadata?.provider}
        onTriggerOcr={handleTriggerOcr}
        hasDocument={!!grn.document}
      />

      <GrnDocumentUpload
        grnId={grn._id}
        document={grn.document}
        onUploadSuccess={fetchGrn}
        disabled={isReadOnly}
      />

      {error && (
        <div className="flex items-center gap-2 p-3 mb-6 rounded bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 mb-4 text-xs font-medium">
        <button
          onClick={() => setActiveTab("matching")}
          className={`py-2 px-3 border-b-2 transition-colors ${
            activeTab === "matching"
              ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100 font-semibold"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          1. Catalog Matching ({grn.items?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("receiving")}
          className={`py-2 px-3 border-b-2 transition-colors ${
            activeTab === "receiving"
              ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100 font-semibold"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          2. Physical Receiving & Discrepancies
        </button>
        <button
          onClick={() => setActiveTab("costs")}
          className={`py-2 px-3 border-b-2 transition-colors ${
            activeTab === "costs"
              ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100 font-semibold"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          3. Discounts & Net Landed Cost
        </button>
      </div>

      {activeTab === "matching" && (
        <GrnProductMatchingTable
          items={grn.items || []}
          canViewCost={grn.grossTotal !== undefined}
          onItemChange={handleItemChange}
          onOpenProductPicker={(idx) => setPickerItemIndex(idx)}
          isReadOnly={isReadOnly}
        />
      )}

      {activeTab === "receiving" && (
        <GrnPhysicalReceivingTable
          items={grn.items || []}
          onItemChange={handleItemChange}
          isReadOnly={isReadOnly}
        />
      )}

      {activeTab === "costs" && (
        <GrnDiscountCostSummary
          grossTotal={grn.grossTotal || 0}
          totalLineDiscount={grn.totalLineDiscount || 0}
          invoiceDiscount={grn.invoiceDiscount || 0}
          cashDiscount={grn.cashDiscount || 0}
          tradeDiscount={grn.tradeDiscount || 0}
          freightCharge={grn.freightCharge || 0}
          handlingCharge={grn.handlingCharge || 0}
          otherCharges={grn.otherCharges || 0}
          taxTotal={grn.taxTotal || 0}
          netInvoiceTotal={grn.netInvoiceTotal || 0}
          canViewCost={grn.grossTotal !== undefined}
          onUpdateDiscounts={(disc) => setGrn({ ...grn, ...disc })}
          isReadOnly={isReadOnly}
        />
      )}

      {/* Action Footer */}
      {!isReadOnly && (
        <div className="flex items-center justify-between p-4 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
          <button
            onClick={handleSaveGrn}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Progress
          </button>

          <button
            onClick={() => setIsConfirmModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Verify & Update Inventory
          </button>
        </div>
      )}

      {/* Confirmation Dialog */}
      <GrnConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmVerified}
        grnNumber={grn.grnNumber}
        challanNumber={grn.challanNumber}
        warehouseName={grn.warehouseId?.name || "Warehouse"}
        items={grn.items || []}
        netInvoiceTotal={grn.netInvoiceTotal || 0}
        canViewCost={grn.grossTotal !== undefined}
      />

      {/* Catalog Search Picker Modal */}
      <ProductPickerModal
        isOpen={pickerItemIndex !== null}
        onClose={() => setPickerItemIndex(null)}
        onSelect={handleProductSelect}
        initialQuery={pickerItemIndex !== null ? grn.items?.[pickerItemIndex]?.productName : ""}
      />
    </div>
  );
}
