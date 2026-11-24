"use client";

import React, { useState, useEffect } from "react";
import { X, Plus, Trash2, ShoppingCart, AlertCircle, AlertTriangle, ShieldCheck } from "lucide-react";

interface CustomerOption {
  _id: string;
  name: string;
  shopName?: string;
  phone?: string;
}

interface ProductVariantOption {
  _id: string;
  variantName: string;
  sku: string;
  customerPrice: number;
  available: number;
}

interface ProductOption {
  _id: string;
  name: string;
  sku: string;
  variants: ProductVariantOption[];
}

interface SalesOrderFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customers: CustomerOption[];
  warehouses: Array<{ _id: string; name: string }>;
  dealershipId?: string;
}

export function SalesOrderFormModal({
  isOpen,
  onClose,
  onSuccess,
  customers,
  warehouses,
  dealershipId,
}: SalesOrderFormModalProps) {
  const [customerId, setCustomerId] = useState("");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?._id || "");
  const [customerAccount, setCustomerAccount] = useState<any>(null);
  const [availableProducts, setAvailableProducts] = useState<ProductOption[]>([]);
  const [items, setItems] = useState<
    Array<{
      productId: string;
      variantId: string;
      quantity: number;
      price: number;
      available: number;
    }>
  >([{ productId: "", variantId: "", quantity: 1, price: 0, available: 0 }]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (warehouseId) {
      const q = dealershipId ? `?dealershipId=${dealershipId}&warehouseId=${warehouseId}` : `?warehouseId=${warehouseId}`;
      fetch(`/api/v1/sales/products/available${q}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.data) setAvailableProducts(json.data);
        })
        .catch(console.error);
    }
  }, [warehouseId, dealershipId]);

  useEffect(() => {
    if (customerId) {
      const q = dealershipId ? `?dealershipId=${dealershipId}` : "";
      fetch(`/api/v1/sales/customers/${customerId}/account${q}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.data) setCustomerAccount(json.data);
        })
        .catch(console.error);
    } else {
      setCustomerAccount(null);
    }
  }, [customerId, dealershipId]);

  if (!isOpen) return null;

  const handleProductSelect = (index: number, pId: string) => {
    const prod = availableProducts.find((p) => p._id === pId);
    if (!prod || !prod.variants.length) return;
    const firstVar = prod.variants[0];
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      productId: prod._id,
      variantId: firstVar._id,
      price: firstVar.customerPrice,
      available: firstVar.available,
    };
    setItems(newItems);
  };

  const handleVariantSelect = (index: number, vId: string) => {
    const item = items[index];
    const prod = availableProducts.find((p) => p._id === item.productId);
    if (!prod) return;
    const variant = prod.variants.find((v) => v._id === vId);
    if (!variant) return;

    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      variantId: variant._id,
      price: variant.customerPrice,
      available: variant.available,
    };
    setItems(newItems);
  };

  const handleQtyChange = (index: number, qty: number) => {
    const newItems = [...items];
    newItems[index].quantity = Math.max(1, qty);
    setItems(newItems);
  };

  const orderTotal = items.reduce((sum, it) => sum + (it.quantity || 0) * (it.price || 0), 0);
  const projectedBalance = (customerAccount?.currentBalance || 0) + orderTotal;
  const isOverCredit =
    customerAccount?.creditLimit > 0 && projectedBalance > customerAccount.creditLimit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) return setError("Please select a customer.");
    if (!warehouseId) return setError("Please select a warehouse.");
    const valid = items.filter((it) => it.productId && it.variantId && it.quantity > 0);
    if (!valid.length) return setError("Please add at least one line item.");

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/sales/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          warehouseId,
          dealershipId: dealershipId || undefined,
          notes: notes.trim() || undefined,
          items: valid.map((it) => ({
            productId: it.productId,
            variantId: it.variantId,
            quantity: it.quantity,
          })),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.message || "Failed to create order");

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
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
              Create New Sales Order (Draft)
            </h3>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Customer / Shop *
              </label>
              <select
                required
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              >
                <option value="">Select customer...</option>
                {customers.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.shopName ? `${c.shopName} (${c.name})` : c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Dispatch Warehouse *
              </label>
              <select
                required
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              >
                {warehouses.map((w) => (
                  <option key={w._id} value={w._id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Customer Dealership Account Summary Banner */}
          {customerAccount && (
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 p-3 space-y-1 text-xs">
              <div className="flex items-center justify-between font-mono">
                <span className="text-zinc-500">Dealership Credit Limit:</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {customerAccount.creditLimit > 0 ? `৳${customerAccount.creditLimit.toLocaleString("en-BD", { minimumFractionDigits: 2 })}` : "No Limit (Cash)"}
                </span>
              </div>
              <div className="flex items-center justify-between font-mono">
                <span className="text-zinc-500">Current Outstanding Receivable:</span>
                <span className="font-medium text-rose-600 dark:text-rose-400">
                  ৳{(customerAccount.currentBalance || 0).toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                </span>
              </div>
              {isOverCredit && (
                <div className="mt-1 pt-1 border-t border-rose-200 dark:border-rose-900/50 flex items-center gap-1.5 text-rose-600 dark:text-rose-400 text-[11px] font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Warning: Projected order total exceeds customer dealership credit limit. Order cannot be confirmed until settled.</span>
                </div>
              )}
            </div>
          )}

          {/* Line Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider font-mono text-zinc-700 dark:text-zinc-300">Order Lines</span>
              <button
                type="button"
                onClick={() => setItems([...items, { productId: "", variantId: "", quantity: 1, price: 0, available: 0 }])}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Add Product
              </button>
            </div>

            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-50 dark:bg-zinc-800/60 font-mono text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="py-2 px-3">Product</th>
                    <th className="py-2 px-3 w-36">Variant</th>
                    <th className="py-2 px-3 w-20 text-center">Avail</th>
                    <th className="py-2 px-3 w-20">Qty</th>
                    <th className="py-2 px-3 w-24 text-right">Price (৳)</th>
                    <th className="py-2 px-3 w-24 text-right">Total (৳)</th>
                    <th className="py-2 px-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {items.map((it, idx) => {
                    const selProd = availableProducts.find((p) => p._id === it.productId);
                    const variants = selProd?.variants || [];
                    return (
                      <tr key={idx} className="bg-white dark:bg-zinc-900">
                        <td className="py-1.5 px-3">
                          <select
                            required
                            value={it.productId}
                            onChange={(e) => handleProductSelect(idx, e.target.value)}
                            className="w-full px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                          >
                            <option value="">Select product...</option>
                            {availableProducts.map((p) => (
                              <option key={p._id} value={p._id}>{p.name} ({p.sku})</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-1.5 px-3">
                          <select
                            required
                            value={it.variantId}
                            onChange={(e) => handleVariantSelect(idx, e.target.value)}
                            disabled={!variants.length}
                            className="w-full px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                          >
                            {variants.map((v) => (
                              <option key={v._id} value={v._id}>{v.variantName}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-1.5 px-3 text-center font-mono">
                          <span className={it.available > 0 ? "text-emerald-600 font-medium" : "text-zinc-400"}>
                            {it.available}
                          </span>
                        </td>
                        <td className="py-1.5 px-3">
                          <input
                            type="number"
                            min="1"
                            required
                            value={it.quantity}
                            onChange={(e) => handleQtyChange(idx, Number(e.target.value))}
                            className="w-full px-2 py-1 text-xs font-mono text-right rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                          />
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono text-zinc-600 dark:text-zinc-400">
                          {it.price.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono font-medium text-zinc-900 dark:text-zinc-100">
                          {((it.quantity || 0) * (it.price || 0)).toFixed(2)}
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
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-1">
              <span className="text-xs text-zinc-500 font-mono mr-2">Order Subtotal:</span>
              <span className="text-xs font-bold font-mono text-zinc-900 dark:text-zinc-100">
                ৳{orderTotal.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Order Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Retailer requested delivery by tomorrow afternoon..."
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
              {loading ? "Creating..." : "Save Draft Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
