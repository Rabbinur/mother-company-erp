"use client";

import React from "react";
import { ShoppingBag, Truck, DollarSign, Users, AlertCircle } from "lucide-react";

interface ProcurementKpis {
  totalOrders: number;
  pendingOrders: number;
  totalPayableAmount: number | null;
  overduePayableCount: number;
  activeSuppliersCount: number;
  receivedFulfillmentRate: number; // percentage
}

interface ProcurementKpiCardsProps {
  kpis: ProcurementKpis;
  loading?: boolean;
}

export function ProcurementKpiCards({ kpis, loading = false }: ProcurementKpiCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 p-4 animate-pulse"
          />
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Active Purchase Orders",
      value: kpis.totalOrders.toLocaleString(),
      subtext: `${kpis.pendingOrders} pending delivery`,
      icon: ShoppingBag,
      tone: "blue",
    },
    {
      title: "Delivery Fulfillment",
      value: `${kpis.receivedFulfillmentRate}%`,
      subtext: "Order-to-receipt conversion",
      icon: Truck,
      tone: "emerald",
    },
    {
      title: "Outstanding Payables",
      value:
        kpis.totalPayableAmount !== null
          ? `৳${kpis.totalPayableAmount.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : "Confidential",
      subtext:
        kpis.overduePayableCount > 0
          ? `${kpis.overduePayableCount} overdue bills`
          : "All bills within payment terms",
      icon: DollarSign,
      tone: kpis.overduePayableCount > 0 ? "amber" : "zinc",
    },
    {
      title: "Active Suppliers",
      value: kpis.activeSuppliersCount.toLocaleString(),
      subtext: "Principal & trade vendors",
      icon: Users,
      tone: "purple",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {card.title}
              </span>
              <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 font-mono">
                {card.value}
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {card.subtext}
            </p>
          </div>
        );
      })}
    </div>
  );
}
