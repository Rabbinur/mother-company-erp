"use client";

import React, { useState, useMemo } from "react";
import { PricingHeader } from "@/components/pricing/PricingHeader";
import { PricingTable, FlattenedPricingItem } from "@/components/pricing/PricingTable";
import { PriceEditModal } from "@/components/pricing/PriceEditModal";
import { Pagination } from "@/components/shared";
import { useDataQuery } from "@/hooks/useDataQuery";

interface VariantItem {
  _id: string;
  sku: string;
  variantName?: string;
  purchasePrice?: number;
  customerPrice: number;
  retailPrice: number;
}

interface ProductWithVariants {
  _id: string;
  name: string;
  sku: string;
  variants: VariantItem[];
}

export default function PricingPage() {
  const [editingItem, setEditingItem] = useState<FlattenedPricingItem | null>(null);

  const {
    data: products,
    loading,
    page,
    totalPages,
    total,
    setPage,
    setParams,
    refetch,
  } = useDataQuery<ProductWithVariants>({
    url: "/api/v1/products",
  });

  const handleSearch = (searchVal: string) => {
    setPage(1);
    setParams((prev) => ({ ...prev, search: searchVal }));
  };

  const flattenedData: FlattenedPricingItem[] = useMemo(() => {
    const list: FlattenedPricingItem[] = [];
    products.forEach((p) => {
      (p.variants || []).forEach((v) => {
        const rp = v.retailPrice || 0;
        const cp = v.customerPrice || 0;
        const marginPct = rp > 0 ? ((rp - cp) / rp) * 100 : 0;

        list.push({
          productId: p._id,
          productName: p.name,
          variantId: v._id,
          sku: v.sku,
          variantName: v.variantName || "Standard",
          purchasePrice: v.purchasePrice,
          customerPrice: cp,
          retailPrice: rp,
          retailerMarginPercent: Math.round(marginPct * 10) / 10,
        });
      });
    });
    return list;
  }, [products]);

  return (
    <div className="space-y-6">
      <PricingHeader onSearch={handleSearch} />

      <PricingTable
        items={flattenedData}
        loading={loading}
        onEdit={(item) => setEditingItem(item)}
      />

      {totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          onPageChange={setPage}
        />
      )}

      {editingItem && (
        <PriceEditModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSuccess={refetch}
        />
      )}
    </div>
  );
}
