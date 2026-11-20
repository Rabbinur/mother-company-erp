"use client";

import React from "react";
import { formatCurrency } from "@/lib/utils";

export interface CurrencyDisplayProps {
  amount: number | string;
  currency?: string;
  colorScheme?: "default" | "receivable" | "payable" | "profit";
  className?: string;
}

export const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({
  amount,
  colorScheme = "default",
  className = "",
}) => {
  const num = typeof amount === "string" ? parseFloat(amount) || 0 : amount;
  const formatted = formatCurrency(num);

  let colorClass = "text-slate-900";
  if (colorScheme === "receivable") {
    colorClass = num > 0 ? "text-red-600 font-semibold" : "text-slate-600";
  } else if (colorScheme === "payable") {
    colorClass = num > 0 ? "text-amber-600 font-semibold" : "text-slate-600";
  } else if (colorScheme === "profit") {
    colorClass = num >= 0 ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold";
  }

  return <span className={`font-mono ${colorClass} ${className}`}>{formatted}</span>;
};
