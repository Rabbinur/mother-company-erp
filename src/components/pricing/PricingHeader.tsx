"use client";

import React from "react";
import { PageHeader, SearchInput } from "@/components/shared";

interface PricingHeaderProps {
  onSearch: (value: string) => void;
}

export function PricingHeader({ onSearch }: PricingHeaderProps) {
  return (
    <div className="space-y-4">
      <PageHeader
        title="3-Level Price Governance"
        description="Manage purchase costs, wholesale dealer prices, and suggested retail prices"
      />
      <div className="flex items-center justify-between">
        <div className="w-full max-w-sm">
          <SearchInput
            placeholder="Search products by name or SKU..."
            onChange={onSearch}
          />
        </div>
      </div>
    </div>
  );
}
