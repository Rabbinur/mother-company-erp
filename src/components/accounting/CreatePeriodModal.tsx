"use client";

import React, { useState } from "react";
import { X, Calendar } from "lucide-react";

interface CreatePeriodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (periodData: {
    periodName: string;
    startDate: string;
    endDate: string;
  }) => Promise<void>;
  isLoading?: boolean;
}

export function CreatePeriodModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: CreatePeriodModalProps) {
  const [periodName, setPeriodName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await onSubmit({ periodName, startDate, endDate });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create accounting period");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-xl space-y-4 p-5">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-emerald-600" />
            <h3 className="font-bold text-foreground text-sm">Create Accounting Period</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-600 dark:text-rose-400">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-medium text-foreground block mb-1">Period Name</label>
            <input
              type="text"
              required
              placeholder="e.g. FY 2026-Q4 or November 2026"
              value={periodName}
              onChange={(e) => setPeriodName(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-medium text-foreground block mb-1">Start Date</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-foreground"
              />
            </div>
            <div>
              <label className="font-medium text-foreground block mb-1">End Date</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-foreground"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border/30">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-input px-3.5 py-1.5 font-medium text-foreground hover:bg-muted/50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {isLoading ? "Creating..." : "Create Period"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
