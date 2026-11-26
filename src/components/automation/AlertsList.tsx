"use client";

import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, XCircle, Clock, ShieldAlert, ArrowRight } from "lucide-react";
import { formatShortDate } from "@/lib/utils";

interface AlertsListProps {
  events: any[];
  onAction: (eventId: string, action: "ACKNOWLEDGE" | "RESOLVE" | "DISMISS") => Promise<void>;
  loadingActionId?: string | null;
}

export function AlertsList({ events, onAction, loadingActionId }: AlertsListProps) {
  const [filterSeverity, setFilterSeverity] = useState<string>("ALL");

  const filtered = events.filter((e) => {
    if (filterSeverity !== "ALL" && e.severity !== filterSeverity) return false;
    return true;
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-rose-100 text-rose-800 border-rose-200";
      case "HIGH":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "MEDIUM":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="space-y-4">
      {/* Severity Filter Pills */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-400 font-medium">Filter Severity:</span>
        {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((s) => (
          <button
            key={s}
            onClick={() => setFilterSeverity(s)}
            className={`rounded-full px-3 py-1 font-semibold transition ${
              filterSeverity === s
                ? "bg-primary text-white shadow-xs"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
          <h3 className="text-sm font-bold text-slate-800">All Clear — No Open Alerts</h3>
          <p className="text-xs text-slate-400 mt-1">Operational condition monitors detected no unacknowledged breaches.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={item._id}
              className={`rounded-xl border bg-white p-4 shadow-xs transition hover:shadow-sm ${
                item.severity === "CRITICAL" ? "border-rose-300" : "border-slate-200"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${getSeverityBadge(item.severity)}`}>
                      {item.severity}
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      {item.category}
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatShortDate(item.detectedAt)}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mt-1">{item.title}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.message}</p>
                  <div className="text-[11px] text-slate-400 pt-1">
                    Source: <span className="font-mono text-slate-700">{item.sourceEntityType}</span>
                    {item.sourceEntityId && <span> ({item.sourceEntityId})</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {item.status === "OPEN" && (
                    <button
                      disabled={loadingActionId === item._id}
                      onClick={() => onAction(item._id, "ACKNOWLEDGE")}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      Acknowledge
                    </button>
                  )}
                  <button
                    disabled={loadingActionId === item._id}
                    onClick={() => onAction(item._id, "RESOLVE")}
                    className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                  >
                    Resolve
                  </button>
                  <button
                    disabled={loadingActionId === item._id}
                    onClick={() => onAction(item._id, "DISMISS")}
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition"
                    title="Dismiss alert"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
