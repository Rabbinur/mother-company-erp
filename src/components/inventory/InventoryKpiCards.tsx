"use client";

import React from "react";
import { Package, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface InventoryKpiCardsProps {
  totalOnHand: number;
  totalAvailable: number;
  totalReserved: number;
  totalDamaged: number;
  valuationAmount?: number;
}

export function InventoryKpiCards({
  totalOnHand,
  totalAvailable,
  totalReserved,
  totalDamaged,
  valuationAmount,
}: InventoryKpiCardsProps) {
  const cards = [
    {
      title: "Total On-Hand Stock",
      value: totalOnHand.toLocaleString(),
      subtext: "Physical warehouse count",
      icon: Package,
      textColor: "text-slate-900",
      accentBg: "bg-slate-50",
    },
    {
      title: "Available for Sale",
      value: totalAvailable.toLocaleString(),
      subtext: "OnHand - Reserved",
      icon: CheckCircle2,
      textColor: "text-emerald-700",
      accentBg: "bg-emerald-50/60",
    },
    {
      title: "Reserved in Orders",
      value: totalReserved.toLocaleString(),
      subtext: "Awaiting shipment fulfillment",
      icon: Clock,
      textColor: "text-amber-700",
      accentBg: "bg-amber-50/60",
    },
    {
      title: "Damaged / Quarantine",
      value: totalDamaged.toLocaleString(),
      subtext: "Excluded from sales",
      icon: AlertTriangle,
      textColor: "text-red-700",
      accentBg: "bg-red-50/60",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div
            key={i}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs transition-shadow hover:shadow-xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {c.title}
              </span>
              <div className={`rounded-lg p-1.5 ${c.accentBg}`}>
                <Icon className={`h-4 w-4 ${c.textColor}`} />
              </div>
            </div>
            <div className={`mt-2 text-2xl font-bold tracking-tight ${c.textColor}`}>
              {c.value}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">{c.subtext}</div>
          </div>
        );
      })}
    </div>
  );
}
