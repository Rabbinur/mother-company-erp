"use client";

import React from "react";
import { Lock, Layers } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export interface VariantItem {
  _id: string;
  variantName: string;
  sku: string;
  purchasePrice?: number;
  customerPrice: number;
  retailPrice: number;
  potentialMarginPercentage?: number;
  status: string;
}

export interface ProductItem {
  _id: string;
  name: string;
  sku: string;
  unit: string;
  productType: string;
  hasVariants: boolean;
  status: string;
  categoryId?: { _id: string; name: string };
  brandId?: { _id: string; name: string };
  variants: VariantItem[];
  inventory: {
    onHand: number;
    reserved: number;
    available: number;
  };
}

interface ProductTableProps {
  products: ProductItem[];
  loading: boolean;
}

export function ProductTable({ products, loading }: ProductTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3.5">Product Name & SKU</th>
              <th className="px-4 py-3.5">Category</th>
              <th className="px-4 py-3.5">Purchase Price</th>
              <th className="px-4 py-3.5">Customer Price</th>
              <th className="px-4 py-3.5">Retail Price</th>
              <th className="px-4 py-3.5">Potential Margin</th>
              <th className="px-4 py-3.5">Available Stock</th>
              <th className="px-4 py-3.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-xs text-slate-400">
                  Loading catalog items...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-xs text-slate-400">
                  No products found. Click &apos;Add New Product&apos; to create one.
                </td>
              </tr>
            ) : (
              products.map((p) => {
                const mainVariant = p.variants?.[0];
                return (
                  <tr key={p._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900">{p.name}</div>
                      <div className="text-[11px] text-slate-400">SKU: {p.sku}</div>
                      {p.variants && p.variants.length > 1 && (
                        <span className="mt-1 inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                          <Layers className="h-3 w-3" />
                          {p.variants.length} Variants
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      {p.categoryId?.name || "General"}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-700">
                      {mainVariant?.purchasePrice !== undefined ? (
                        formatCurrency(mainVariant.purchasePrice)
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                          <Lock className="h-3 w-3" /> Confidential
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-primary">
                      {formatCurrency(mainVariant?.customerPrice || 0)}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      {formatCurrency(mainVariant?.retailPrice || 0)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-100">
                        +{mainVariant?.potentialMarginPercentage || 0}%
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-800">
                        {p.inventory.available} {p.unit}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        On Hand: {p.inventory.onHand} | Res: {p.inventory.reserved}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          p.status === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
