"use client";

import React, { useState } from "react";
import { Clock, Power, AlertCircle, Calendar, Info } from "lucide-react";

interface SchedulerControlCardProps {
  enabled: boolean;
  canToggle: boolean;
  lastToggledAt?: string | null;
  toggledByEmail?: string | null;
  lastExecution?: any;
  nextScheduledExecution?: string | null;
  onToggle: (enabled: boolean) => Promise<void>;
  loading?: boolean;
}

export function SchedulerControlCard({
  enabled,
  canToggle,
  lastToggledAt,
  toggledByEmail,
  lastExecution,
  nextScheduledExecution,
  onToggle,
  loading = false,
}: SchedulerControlCardProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleConfirmToggle = async () => {
    setSubmitting(true);
    try {
      await onToggle(!enabled);
      setShowConfirm(false);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return "Not recorded";
    try {
      const d = new Date(dateStr);
      return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    } catch {
      return String(dateStr);
    }
  };

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div
              className={`rounded-xl p-3 ${
                enabled
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                  : "bg-slate-100 text-slate-500 border border-slate-200"
              }`}
            >
              <Power className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-slate-900 tracking-tight">Scheduled Automation</h2>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                    enabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {enabled ? "Active (ON)" : "Paused (OFF)"}
                </span>
                {!canToggle && (
                  <span className="text-[10px] font-semibold text-slate-400 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
                    Admin / Owner Only
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {enabled
                  ? "Evaluates all active business rules automatically every morning via Vercel Cron at 00:00 UTC (06:00 AM BST)."
                  : "Scheduled runs are paused by the business owner. Automated daily evaluations are skipped until re-enabled."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            <button
              type="button"
              disabled={!canToggle || loading || submitting}
              onClick={() => setShowConfirm(true)}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-40 disabled:cursor-not-allowed ${
                enabled ? "bg-emerald-600" : "bg-slate-300"
              }`}
              title={canToggle ? "Toggle Scheduled Automation" : "Only Business Owner/Admin can change this setting"}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
            <span className="text-xs font-bold text-slate-700 min-w-[32px]">{enabled ? "ON" : "OFF"}</span>
          </div>
        </div>

        {/* Status Subgrid */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 border-t border-slate-100 pt-3 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <Clock className="h-4 w-4 text-slate-400 shrink-0" />
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Last Scheduled Run</span>
              <span className="font-semibold text-slate-800">
                {lastExecution ? `${formatDateTime(lastExecution.startedAt)} (${lastExecution.status})` : "Never run"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-600">
            <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Next Scheduled Run</span>
              <span className="font-semibold text-slate-800">
                {enabled ? formatDateTime(nextScheduledExecution) : "Paused (Will not run)"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-600">
            <Info className="h-4 w-4 text-slate-400 shrink-0" />
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Control Audit</span>
              <span className="font-medium text-slate-700 text-[11px]">
                {toggledByEmail ? `By ${toggledByEmail} on ${formatDateTime(lastToggledAt)}` : "Default active"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`rounded-xl p-2.5 ${
                  enabled ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                }`}
              >
                <AlertCircle className="h-5 w-5" />
              </div>
              <h3 className="text-base font-black text-slate-900">
                {enabled ? "Disable Scheduled Automation?" : "Enable Scheduled Automation?"}
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {enabled
                ? "Future scheduled cron runs will be skipped until re-enabled. Any automation evaluation currently in progress will complete normally, and manual 'Evaluate Rules Now' remains available."
                : "Scheduled daily rule evaluation will resume at 00:00 UTC (06:00 AM BST). Automated alerts and decision-support events will be generated according to active rule configurations."}
            </p>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowConfirm(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmToggle}
                className={`rounded-xl px-4 py-2 text-xs font-bold text-white transition disabled:opacity-50 ${
                  enabled ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {submitting ? "Updating..." : enabled ? "Confirm & Pause Scheduler" : "Confirm & Enable"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
