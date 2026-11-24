"use client";

import React, { useState } from "react";
import { X, Plus, Trash2, ShoppingCart, AlertCircle } from "lucide-react";

interface ProductOption {
  _id: string;
  name: string;
  sku: string;
  costPrice?: number;
}

interface PurchaseOrderFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  suppliers: Array<{ _id: string; name: string; companyName?: string }>;
  products: ProductOption[];
  dealerships?: Array<{ _id: string; name: string }>;
}

export function PurchaseOrderFormModal({
  isOpen,
  onClose,
  onSuccess,
  suppliers,
  products,
  dealerships = [],
}: PurchaseOrderFormModalProps) {
  const [supplierId, setSupplierId] = useState("");
  const [dealershipId, setDealershipId] = useState("");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Array<{ productId: string; name: string; quantity: number; unitPrice: number }>>([
    { productId: "", name: "", quantity: 1, unitPrice: 0 },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleProductSelect = (index: number, prodId: string) => {
    const prod = products.find((p) => p._id === prodId);
    if (!prod) return;
    const newItems = [...items];
    newItems[index] = { ...newItems[index], productId: prod._id, name: prod.name, unitPrice: prod.costPrice || 0 };
    setItems(newItems);
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    setItems(newItems);
  };

  const totalValue = items.reduce((sum, it) => sum + (it.quantity || 0) * (it.unitPrice || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) return setError("Please select a supplier.");
    const valid = items.filter((it) => it.productId && it.quantity > 0);
    if (!valid.length) return setError("Please add at least one line item.");

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/procurement/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          dealershipId: dealershipId || undefined,
          expectedDeliveryDate: expectedDeliveryDate || undefined,
          notes: notes.trim() || undefined,
          items: valid.map((it) => ({
            productId: it.productId,
            name: it.name,
            quantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice),
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.message || "Failed to create PO");
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-zinc-500" />
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">Create New Purchase Order</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Supplier *</label>
              <select
                required
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              >
                <option value="">Select supplier...</option>
                {suppliers.map((s) => (
                  <option key={s._id} value={s._id}>{s.companyName || s.name}</option>
                ))}
              </select>
            </div>

            {dealerships.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Target Dealership</label>
                <select
                  value={dealershipId}
                  onChange={(e) => setDealershipId(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                >
                  <option value="">Central / Unallocated</option>
                  {dealerships.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Expected Delivery</label>
              <input
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider font-mono">Order Items</span>
              <button
                type="button"
                onClick={() => setItems([...items, { productId: "", name: "", quantity: 1, unitPrice: 0 }])}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Add Item
              </button>
            </div>

            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-50 dark:bg-zinc-800/60 font-mono text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="py-2 px-3">Product</th>
                    <th className="py-2 px-3 w-20">Qty</th>
                    <th className="py-2 px-3 w-28">Unit Price</th>
                    <th className="py-2 px-3 w-28 text-right">Total</th>
                    <th className="py-2 px-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {items.map((it, idx) => (
                    <tr key={idx} className="bg-white dark:bg-zinc-900">
                      <td className="py-1.5 px-3">
                        <select
                          required
                          value={it.productId}
                          onChange={(e) => handleProductSelect(idx, e.target.value)}
                          className="w-full px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                        >
                          <option value="">Select product...</option>
                          {products.map((p) => (
                            <option key={p._id} value={p._id}>{p.name} ({p.sku})</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1.5 px-3">
                        <input
                          type="number"
                          min="1"
                          required
                          value={it.quantity}
                          onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))}
                          className="w-full px-2 py-1 text-xs font-mono text-right rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                        />
                      </td>
                      <td className="py-1.5 px-3">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={it.unitPrice}
                          onChange={(e) => updateItem(idx, "unitPrice", Number(e.target.value))}
                          className="w-full px-2 py-1 text-xs font-mono text-right rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                        />
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono font-medium">
                        {((it.quantity || 0) * (it.unitPrice || 0)).toFixed(2)}
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => items.length > 1 && setItems(items.filter((_, i) => i !== idx))}
                          disabled={items.length <= 1}
                          className="text-zinc-400 hover:text-rose-500 disabled:opacity-30"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-1">
              <span className="text-xs text-zinc-500 font-mono mr-2">Estimated Total:</span>
              <span className="text-xs font-bold font-mono text-zinc-900 dark:text-zinc-100">
                ৳{totalValue.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Notes / Instructions</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Inward dock delivery instructions..."
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3.5 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Purchase Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
