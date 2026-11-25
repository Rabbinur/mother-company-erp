"use client";

import React from "react";
import { RotateCcw, Clock, CheckCircle2, ShieldAlert } from "lucide-react";

interface ReturnsKpiCardsProps {
  pendingInspectionCount?: number;
  approvedRestockedCount?: number;
  pendingRefundCount?: number;
  activeClaimsCount?: number;
}

export function ReturnsKpiCards({
  pendingInspectionCount = 0,
  approvedRestockedCount = 0,
  pendingRefundCount = 0,
  activeClaimsCount = 0,
}: ReturnsKpiCardsProps) {
  const cards = [
    {
      title: "Pending Inspection",
      value: pendingInspectionCount,
      subtitle: "Awaiting QA & condition checks",
      icon: Clock,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      title: "Restocked & Approved",
      value: approvedRestockedCount,
      subtitle: "Returned to sellable/quarantine",
      icon: CheckCircle2,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      title: "Refunds / Credits Pending",
      value: pendingRefundCount,
      subtitle: "Awaiting ledger settlement",
      icon: RotateCcw,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      title: "Active Claims",
      value: activeClaimsCount,
      subtitle: "Transit & supplier claims",
      icon: ShieldAlert,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
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
