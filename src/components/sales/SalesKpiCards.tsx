"use client";

import React from "react";
import { ShoppingCart, Clock, CheckCircle2, DollarSign, Activity } from "lucide-react";

interface SalesKpis {
  totalOrders: number;
  draftOrders: number;
  confirmedOrders: number;
  fulfilledOrders: number;
  totalSalesValue: number;
  fulfillmentRate: number;
}

interface SalesKpiCardsProps {
  kpis: SalesKpis;
  loading?: boolean;
}

export function SalesKpiCards({ kpis, loading = false }: SalesKpiCardsProps) {
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
      title: "Total Sales Orders",
      value: kpis.totalOrders.toLocaleString(),
      subtext: `${kpis.draftOrders} draft, ${kpis.confirmedOrders} confirmed`,
      icon: ShoppingCart,
    },
    {
      title: "Confirmed (Reserved)",
      value: kpis.confirmedOrders.toLocaleString(),
      subtext: "Stock reserved in warehouse",
      icon: CheckCircle2,
    },
    {
      title: "Total Order Value",
      value: `৳${kpis.totalSalesValue.toLocaleString("en-BD", { minimumFractionDigits: 2 })}`,
      subtext: "Active confirmed & draft bookings",
      icon: DollarSign,
    },
    {
      title: "Order Fulfillment Rate",
      value: `${kpis.fulfillmentRate}%`,
      subtext: `${kpis.fulfilledOrders} orders delivered`,
      icon: Activity,
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
