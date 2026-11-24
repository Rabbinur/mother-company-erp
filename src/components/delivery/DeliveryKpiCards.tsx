"use client";

import React from "react";
import { Truck, PackageCheck, AlertCircle, Clock } from "lucide-react";

interface DeliveryKpiCardsProps {
  totalTrips?: number;
  inTransitCount?: number;
  deliveredCount?: number;
  pendingCount?: number;
}

export function DeliveryKpiCards({
  totalTrips = 0,
  inTransitCount = 0,
  deliveredCount = 0,
  pendingCount = 0,
}: DeliveryKpiCardsProps) {
  const cards = [
    {
      title: "Active Trips",
      value: totalTrips,
      subtitle: "Total scheduled dispatches",
      icon: Truck,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      title: "In Transit",
      value: inTransitCount,
      subtitle: "On road in vehicle custody",
      icon: Clock,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      title: "Completed Deliveries",
      value: deliveredCount,
      subtitle: "Delivered & reconciled",
      icon: PackageCheck,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      title: "Pending Dispatch",
      value: pendingCount,
      subtitle: "Awaiting loading & departure",
      icon: AlertCircle,
      color: "text-indigo-500",
      bg: "bg-indigo-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div
            key={i}
            className="p-4 rounded-xl border border-border/50 bg-card text-card-foreground shadow-xs flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{c.title}</span>
              <div className={`p-2 rounded-lg ${c.bg}`}>
                <Icon className={`w-4 h-4 ${c.color}`} />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold tracking-tight text-foreground">{c.value}</div>
              <p className="text-xs text-muted-foreground mt-0.5">{c.subtitle}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
