"use client";

import React, { useMemo } from "react";
import { Edit3, Lock, ArrowUpRight } from "lucide-react";
import { DataTable, ColumnDef, CurrencyDisplay } from "@/components/shared";

export interface FlattenedPricingItem {
  productId: string;
  productName: string;
  variantId: string;
  sku: string;
  variantName: string;
  purchasePrice?: number;
  customerPrice: number;
  retailPrice: number;
  retailerMarginPercent: number;
}

interface PricingTableProps {
  items: FlattenedPricingItem[];
  loading: boolean;
  onEdit: (item: FlattenedPricingItem) => void;
}

export function PricingTable({ items, loading, onEdit }: PricingTableProps) {
  const columns: ColumnDef<FlattenedPricingItem>[] = useMemo(
    () => [
      {
        header: "Product & Variant SKU",
        cell: (item) => (
          <div>
            <div className="font-semibold text-slate-900">{item.productName}</div>
            <div className="text-[10px] text-slate-400 font-mono">
              SKU: {item.sku} ({item.variantName})
            </div>
          </div>
        ),
      },
      {
        header: "1. Purchase Price (Cost)",
        align: "right",
        cell: (item) =>
          item.purchasePrice !== undefined ? (
            <CurrencyDisplay amount={item.purchasePrice} />
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
              <Lock className="h-3 w-3 text-slate-300" />
              Confidential
            </span>
          ),
      },
      {
        header: "2. Customer Price (Wholesale)",
        align: "right",
        cell: (item) => <CurrencyDisplay amount={item.customerPrice} />,
      },
      {
        header: "3. Retail Price (MSRP)",
        align: "right",
        cell: (item) => <CurrencyDisplay amount={item.retailPrice} />,
      },
      {
        header: "Retailer Margin",
        align: "right",
        cell: (item) => (
          <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600">
            <ArrowUpRight className="h-3 w-3" />
            {item.retailerMarginPercent}%
          </span>
        ),
      },
      {
        header: "Action",
        align: "center",
        cell: (item) => (
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Edit3 className="h-3.5 w-3.5 text-slate-500" />
            <span>Update</span>
          </button>
        ),
      },
    ],
    [onEdit]
  );

  return (
    <DataTable
      columns={columns}
      data={items}
      loading={loading}
      emptyMessage="No catalog items found matching criteria."
    />
  );
}
