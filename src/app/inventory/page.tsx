"use client";

import React, { useState, useEffect } from "react";
import {
  Warehouse,
  History,
  Sliders,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Plus,
  X,
  Search,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface InventoryBalanceItem {
  _id: string;
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  damagedQuantity: number;
  productId?: { _id: string; name: string; sku: string; unit: string };
  variantId?: { _id: string; variantName: string; sku: string };
  warehouseId?: { _id: string; name: string; code: string };
}

interface StockMovementItem {
  _id: string;
  movementNumber: string;
  type: string;
  quantity: number;
  previousOnHand: number;
  newOnHand: number;
  previousReserved: number;
  newReserved: number;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  createdAt: string;
  productId?: { name: string; sku: string };
  variantId?: { variantName: string; sku: string };
  createdBy?: { name: string; email: string };
}

export default function InventoryPage() {
  const [tab, setTab] = useState<"balances" | "movements">("balances");
  const [balances, setBalances] = useState<InventoryBalanceItem[]>([]);
  const [movements, setMovements] = useState<StockMovementItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Adjustment Modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedBalance, setSelectedBalance] = useState<InventoryBalanceItem | null>(null);
  const [adjustmentQty, setAdjustmentQty] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  useEffect(() => {
    fetchData();
  }, [tab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/inventory?tab=${tab}`);
      const json = await res.json();
      if (json.success) {
        if (tab === "balances") setBalances(json.data || []);
        else setMovements(json.data || []);
      }
    } catch (err) {
      console.error("Inventory fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBalance) return;
    setSaving(true);
    setModalError("");

    try {
      const res = await fetch("/api/v1/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedBalance.productId?._id,
          variantId: selectedBalance.variantId?._id,
          adjustmentQty: parseFloat(adjustmentQty) || 0,
          reason,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to adjust stock");
      }

      setShowAdjustModal(false);
      setAdjustmentQty("");
      setReason("");
      setSelectedBalance(null);
      fetchData();
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Adjustment error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Central Warehouse Inventory
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time physical On-Hand, active Reservations, and auditable Stock Ledger
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex rounded-lg border border-slate-200 bg-white p-1">
          <button
            onClick={() => setTab("balances")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === "balances"
                ? "bg-primary text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Warehouse className="h-3.5 w-3.5" />
            <span>Stock Balances</span>
          </button>
          <button
            onClick={() => setTab("movements")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === "movements"
                ? "bg-primary text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>Stock Movement Ledger</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      {tab === "balances" ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Product & SKU</th>
                  <th className="px-4 py-3.5">Warehouse</th>
                  <th className="px-4 py-3.5">Physical On-Hand</th>
                  <th className="px-4 py-3.5">Reserved</th>
                  <th className="px-4 py-3.5">Available (Sellable)</th>
                  <th className="px-4 py-3.5">Damaged</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                      Loading inventory records...
                    </td>
                  </tr>
                ) : balances.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                      No stock records found. Receive purchases to populate central warehouse stock.
                    </td>
                  </tr>
                ) : (
                  balances.map((b) => (
                    <tr key={b._id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-900">
                          {b.productId?.name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {b.variantId?.variantName} ({b.variantId?.sku})
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {b.warehouseId?.name || "Central Warehouse"}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-800">
                        {b.onHandQuantity} {b.productId?.unit}
                      </td>
                      <td className="px-4 py-3.5 text-amber-600 font-semibold">
                        {b.reservedQuantity} {b.productId?.unit}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="rounded-md bg-emerald-50 px-2 py-1 font-bold text-emerald-700 border border-emerald-200">
                          {b.availableQuantity} {b.productId?.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-400">
                        {b.damagedQuantity || 0}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => {
                            setSelectedBalance(b);
                            setShowAdjustModal(true);
                          }}
                          className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                        >
                          <Sliders className="h-3 w-3" />
                          <span>Adjust</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Movements Ledger Table */
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Movement #</th>
                  <th className="px-4 py-3.5">Type</th>
                  <th className="px-4 py-3.5">Product Item</th>
                  <th className="px-4 py-3.5">Delta Qty</th>
                  <th className="px-4 py-3.5">New On-Hand</th>
                  <th className="px-4 py-3.5">Reference</th>
                  <th className="px-4 py-3.5">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                      Loading stock ledger movements...
                    </td>
                  </tr>
                ) : movements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                      No stock movement entries recorded yet.
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => (
                    <tr key={m._id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3.5 font-mono text-slate-700 font-medium">
                        {m.movementNumber}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            m.type.includes("receive") || m.type.includes("return")
                              ? "bg-emerald-50 text-emerald-700"
                              : m.type.includes("fulfillment")
                              ? "bg-blue-50 text-blue-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {m.type.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-800">
                        {m.productId?.name} - {m.variantId?.variantName}
                      </td>
                      <td className="px-4 py-3.5 font-bold">
                        <span className={m.quantity > 0 ? "text-emerald-600" : "text-red-600"}>
                          {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-700 font-semibold">{m.newOnHand}</td>
                      <td className="px-4 py-3.5 text-slate-500 font-mono text-[11px]">
                        {m.referenceId || "N/A"}
                      </td>
                      <td className="px-4 py-3.5 text-slate-400 text-[11px]">
                        {formatDate(m.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {showAdjustModal && selectedBalance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Adjust Physical Stock Quantity
              </h3>
              <button
                onClick={() => setShowAdjustModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-700 space-y-1">
              <p className="font-semibold">{selectedBalance.productId?.name}</p>
              <p className="text-slate-500">
                Current On-Hand: {selectedBalance.onHandQuantity} | Available:{" "}
                {selectedBalance.availableQuantity}
              </p>
            </div>

            {modalError && (
              <div className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700 border border-red-200">
                {modalError}
              </div>
            )}

            <form onSubmit={handleAdjustSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Adjustment Quantity (+ to add, - to deduct)
                </label>
                <input
                  type="number"
                  required
                  step="1"
                  value={adjustmentQty}
                  onChange={(e) => setAdjustmentQty(e.target.value)}
                  placeholder="e.g. +10 or -5"
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs focus:outline-hidden focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Audit Reason</label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Physical inventory reconciliation cycle count"
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs focus:outline-hidden focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
                >
                  {saving ? "Posting..." : "Confirm Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
