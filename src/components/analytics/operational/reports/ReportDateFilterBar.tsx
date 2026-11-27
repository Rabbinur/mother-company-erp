"use client";

import React, { useState } from "react";
import { Calendar, Printer, RotateCcw, AlertTriangle } from "lucide-react";

interface Props {
  startDate: string;
  endDate: string;
  dealershipId: string;
  dealerships: Array<{ _id: string; name: string }>;
  loading?: boolean;
  onApply: (params: { startDate: string; endDate: string; dealershipId: string }) => void;
  onReset: () => void;
  onPrint: () => void;
  reportLabel: string;
}

export function ReportDateFilterBar({
  startDate: initialStart,
  endDate: initialEnd,
  dealershipId: initialDealership,
  dealerships,
  loading = false,
  onApply,
  onReset,
  onPrint,
  reportLabel,
}: Props) {
  const [start, setStart] = useState<string>(initialStart);
  const [end, setEnd] = useState<string>(initialEnd);
  const [dId, setDId] = useState<string>(initialDealership);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleApply = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (start && end && new Date(end) < new Date(start)) {
      setValidationError("End date cannot be earlier than start date");
      return;
    }
    setValidationError(null);
    onApply({ startDate: start, endDate: end, dealershipId: dId });
  };

  const handleReset = () => {
    setValidationError(null);
    setStart("");
    setEnd("");
    setDId("all");
    onReset();
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-xs print:hidden space-y-3 mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-primary" />
            <span>Generate {reportLabel}</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select a custom date range and optional dealership scope to generate and print.
          </p>
        </div>

        <button
          type="button"
          onClick={onPrint}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Print / Save PDF</span>
        </button>
      </div>

      <form onSubmit={handleApply} className="flex flex-wrap items-end gap-3 pt-2 border-t border-border/60">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">Start Date</label>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground focus:ring-1 focus:ring-primary outline-hidden"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">End Date</label>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground focus:ring-1 focus:ring-primary outline-hidden"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">Dealership</label>
          <select
            value={dId}
            onChange={(e) => setDId(e.target.value)}
            className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground focus:ring-1 focus:ring-primary outline-hidden min-w-[150px]"
          >
            <option value="all">All Dealerships</option>
            {dealerships.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 mt-auto">
          <button
            type="submit"
            disabled={loading}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            {loading ? "Generating..." : "Apply Range"}
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="p-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted text-muted-foreground transition-colors"
            title="Reset Filters"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </form>

      {validationError && (
        <div className="text-xs text-rose-600 flex items-center gap-1.5 pt-1 font-medium">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>{validationError}</span>
        </div>
      )}
    </div>
  );
}
