"use client";

import React from "react";
import { Building2, Calendar, Clock, Filter } from "lucide-react";

interface Props {
  title: string;
  subtitle: string;
  businessName?: string;
  dealershipName?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  periodPreset?: string;
  generatedAt?: string | Date;
  filtersApplied?: string[];
}

export function ReportHeader({
  title,
  subtitle,
  businessName = "Mother Distribution ERP",
  dealershipName,
  startDate,
  endDate,
  periodPreset,
  generatedAt,
  filtersApplied = [],
}: Props) {
  const formatDate = (d?: string | Date) => {
    if (!d) return "N/A";
    const dateObj = new Date(d);
    return isNaN(dateObj.getTime()) ? String(d) : dateObj.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  const formatTimestamp = (d?: string | Date) => {
    const dateObj = d ? new Date(d) : new Date();
    return dateObj.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="report-header print:block border-b-2 border-slate-800 pb-4 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Building2 className="w-3.5 h-3.5" />
            <span>{businessName}</span>
            {dealershipName && (
              <>
                <span>•</span>
                <span className="text-foreground">{dealershipName}</span>
              </>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mt-1">{title}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>

        <div className="text-left sm:text-right space-y-1 text-xs">
          <div className="inline-flex items-center gap-1.5 text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-md border border-border">
            <Calendar className="w-3.5 h-3.5 text-primary" />
            <span className="font-semibold text-foreground">
              {startDate && endDate ? `${formatDate(startDate)} — ${formatDate(endDate)}` : periodPreset || "Current Period"}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center sm:justify-end gap-1">
            <Clock className="w-3 h-3" /> Generated: {formatTimestamp(generatedAt)}
          </div>
        </div>
      </div>

      {filtersApplied.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground flex items-center gap-1">
            <Filter className="w-3 h-3" /> Active Filters:
          </span>
          {filtersApplied.map((f, i) => (
            <span key={i} className="px-2 py-0.5 rounded bg-muted/60 border border-border text-foreground font-medium">
              {f}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
