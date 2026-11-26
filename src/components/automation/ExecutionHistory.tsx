"use client";

import React from "react";
import { Activity, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { formatShortDate } from "@/lib/utils";

interface ExecutionHistoryProps {
  executions: any[];
}

export function ExecutionHistory({ executions }: ExecutionHistoryProps) {
  if (executions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center text-xs text-slate-400">
        No engine execution runs recorded yet. Click &apos;Evaluate Rules Now&apos; to trigger an evaluation.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Engine Execution History
        </h3>
        <span className="text-xs text-slate-400">{executions.length} runs logged</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-600 font-semibold border-y border-slate-200">
            <tr>
              <th className="py-2.5 px-3">Execution Key</th>
              <th className="py-2.5 px-3">Trigger</th>
              <th className="py-2.5 px-3">Timestamp</th>
              <th className="py-2.5 px-3 text-center">Rules Evaluated</th>
              <th className="py-2.5 px-3 text-center">Alerts Detected</th>
              <th className="py-2.5 px-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {executions.map((ex) => (
              <tr key={ex.executionKey} className="hover:bg-slate-50/50">
                <td className="py-2 px-3 font-mono text-[11px] text-slate-700">{ex.executionKey}</td>
                <td className="py-2 px-3 text-slate-600">{ex.triggeredBy}</td>
                <td className="py-2 px-3 text-slate-500">{formatShortDate(ex.startedAt)}</td>
                <td className="py-2 px-3 text-center font-semibold text-slate-800">{ex.rulesEvaluated}</td>
                <td className="py-2 px-3 text-center font-semibold text-amber-600">{ex.eventsGenerated}</td>
                <td className="py-2 px-3 text-right">
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                      ex.status === "COMPLETED"
                        ? "bg-emerald-100 text-emerald-800"
                        : ex.status === "RUNNING"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {ex.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
