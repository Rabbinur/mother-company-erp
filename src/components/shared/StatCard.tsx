"use client";

import React, { ReactNode } from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

export interface StatCardProps {
  title: string;
  value: ReactNode;
  icon: ReactNode;
  description?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  accentColor?: "blue" | "emerald" | "amber" | "violet" | "rose";
  className?: string;
}

const ACCENT_STYLES = {
  blue: "bg-blue-50 text-blue-600 border-blue-100",
  emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
  amber: "bg-amber-50 text-amber-600 border-amber-100",
  violet: "bg-violet-50 text-violet-600 border-violet-100",
  rose: "bg-rose-50 text-rose-600 border-rose-100",
};

/**
 * Reusable StatCard Component (Single Responsibility: Executive KPI visualization)
 */
export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  description,
  trend,
  trendValue,
  accentColor = "blue",
  className = "",
}) => {
  return (
    <div
      className={`rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-md ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </span>
        <div className={`rounded-lg border p-2.5 ${ACCENT_STYLES[accentColor]}`}>
          {icon}
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <div className="text-2xl font-bold tracking-tight text-slate-900">{value}</div>
      </div>

      {(description || trendValue) && (
        <div className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-500">
          {trend === "up" && (
            <span className="inline-flex items-center font-medium text-emerald-600">
              <ArrowUpRight className="h-3.5 w-3.5" />
              {trendValue}
            </span>
          )}
          {trend === "down" && (
            <span className="inline-flex items-center font-medium text-red-600">
              <ArrowDownRight className="h-3.5 w-3.5" />
              {trendValue}
            </span>
          )}
          {trend === "neutral" && (
            <span className="inline-flex items-center font-medium text-slate-500">
              <Minus className="h-3.5 w-3.5" />
              {trendValue}
            </span>
          )}
          {description && <span className="text-slate-400">{description}</span>}
        </div>
      )}
    </div>
  );
};
