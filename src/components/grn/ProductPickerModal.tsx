"use client";

import React, { useState } from "react";
import { Search, Check, X, Loader2 } from "lucide-react";

interface ProductOption {
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  barcode?: string;
  purchasePrice?: number;
}

interface ProductPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (selected: ProductOption) => void;
  initialQuery?: string;
}

export function ProductPickerModal({
  isOpen,
  onClose,
  onSelect,
  initialQuery = "",
}: ProductPickerModalProps) {
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ProductOption[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  if (!isOpen) return null;

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setHasSearched(true);

    try {
      const res = await fetch("/api/v1/grn/match-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawName: query.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.data?.candidates) {
        setResults(data.data.candidates);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Map Line Item to Catalog Product
          </h2>
          <button onClick={onClose} className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-400" />
              <input
                type="text"
                autoFocus
                placeholder="Search catalog by name, SKU or barcode..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-500 font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-3 py-1.5 text-xs font-medium rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Search"}
            </button>
          </form>

          <div className="max-h-60 overflow-y-auto divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded">
            {loading ? (
              <div className="p-6 text-center text-xs text-zinc-400 font-mono">Searching catalog...</div>
            ) : results.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-400 font-mono">
                {hasSearched ? "No matching products found in catalog." : "Type a query and press Search."}
              </div>
            ) : (
              results.map((r, i) => (
                <div
                  key={i}
                  onClick={() => {
                    onSelect(r);
                    onClose();
                  }}
                  className="p-3 hover:bg-zinc-50 dark:hover:bg-zinc-850/60 cursor-pointer flex items-center justify-between transition-colors text-xs"
                >
                  <div>
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">{r.productName}</div>
                    <div className="text-xs font-mono text-zinc-700 dark:text-zinc-300">
                      Variant: {r.variantName || "Default"} • SKU: {r.sku}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                  >
                    <Check className="w-3 h-3 text-emerald-600" /> Select
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
