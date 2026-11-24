"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Save, Loader2 } from "lucide-react";

interface Option {
  _id: string;
  name: string;
  companyName?: string;
  code?: string;
}

interface GrnManualEntryFormProps {
  suppliers: Option[];
  warehouses: Option[];
  principalCompanies?: Option[];
  currentDealershipId?: string;
  currentBusinessId?: string;
}

export function GrnManualEntryForm({
  suppliers,
  warehouses,
  principalCompanies = [],
  currentDealershipId,
  currentBusinessId,
}: GrnManualEntryFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [supplierId, setSupplierId] = useState(suppliers[0]?._id || "");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?._id || "");
  const [principalCompanyId, setPrincipalCompanyId] = useState("");
  const [challanNumber, setChallanNumber] = useState("");
  const [challanDate, setChallanDate] = useState(new Date().toISOString().slice(0, 10));
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || !warehouseId || !challanNumber.trim() || !challanDate) {
      setError("Please fill in all required fields (Supplier, Warehouse, Challan #, Challan Date)");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/grn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: currentBusinessId,
          dealershipId: currentDealershipId,
          supplierId,
          warehouseId,
          principalCompanyId: principalCompanyId || undefined,
          challanNumber: challanNumber.trim(),
          challanDate,
          invoiceNumber: invoiceNumber.trim() || undefined,
          invoiceDate: invoiceDate || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create GRN");
      }

      router.push(`/inventory/grn/${data.data._id}`);
    } catch (err: any) {
      setError(err.message || "Error creating GRN");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
      <div>
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Challan Details & Metadata (Primary Manual Entry)
        </h3>
        <p className="text-xs text-zinc-700 dark:text-zinc-300 mt-0.5">
          Create the initial Goods Receipt Note. You can add items manually and optionally attach scanned copies.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Supplier */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Supplier (Vendor) <span className="text-rose-500">*</span>
          </label>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            required
            className="w-full text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          >
            <option value="">Select Supplier...</option>
            {suppliers.map((s) => (
              <option key={s._id} value={s._id}>
                {s.companyName ? `${s.companyName} (${s.name})` : s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Warehouse */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Receiving Warehouse <span className="text-rose-500">*</span>
          </label>
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            required
            className="w-full text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          >
            <option value="">Select Warehouse...</option>
            {warehouses.map((w) => (
              <option key={w._id} value={w._id}>
                {w.name} {w.code ? `(${w.code})` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Principal Company */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Principal Company (Optional)
          </label>
          <select
            value={principalCompanyId}
            onChange={(e) => setPrincipalCompanyId(e.target.value)}
            className="w-full text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          >
            <option value="">None / Direct</option>
            {principalCompanies.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name} {p.code ? `(${p.code})` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Challan Number */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Supplier Challan No <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={challanNumber}
            onChange={(e) => setChallanNumber(e.target.value)}
            placeholder="e.g. CH-2026-9021"
            className="w-full text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-500 font-mono"
          />
        </div>

        {/* Challan Date */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Challan Date <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            required
            value={challanDate}
            onChange={(e) => setChallanDate(e.target.value)}
            className="w-full text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-500 font-mono"
          />
        </div>

        {/* Invoice Number */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Invoice No (Optional)
          </label>
          <input
            type="text"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            placeholder="e.g. INV-9812"
            className="w-full text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-500 font-mono"
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Receiving Notes / Truck Info
        </label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Driver name, vehicle number, delivery remarks..."
          className="w-full text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow-sm disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Create GRN & Add Items
        </button>
      </div>
    </form>
  );
}
