"use client";

import React from "react";
import { Users, CheckCircle, Clock, Info, PackageCheck } from "lucide-react";
import type { WorkerIntelligenceData } from "@/services/analytics/operational/types";

interface Props {
  data: WorkerIntelligenceData;
}

export function WorkerIntelligenceSection({ data }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Worker & Loading/Unloading Intelligence
          </h3>
          <p className="text-xs text-muted-foreground">
            Worker task assignments, unique cargo volume handled, and verified loading compensation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-full bg-muted border border-border font-medium text-muted-foreground flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            Recorded Work Duration: <span className="font-semibold text-foreground">{data.recordedWorkDuration}</span>
          </span>
        </div>
      </div>

      {/* Assignment & Cargo Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="text-xs text-muted-foreground">Total Assignments</div>
          <div className="text-lg font-bold text-foreground mt-1">{data.totalWorkerAssignments}</div>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <PackageCheck className="w-3.5 h-3.5 text-primary" /> Unique Cargo Handled
          </div>
          <div className="text-lg font-bold text-foreground mt-1">{data.totalUniqueCargoHandled.toLocaleString()} u</div>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="text-xs text-muted-foreground">Loading / Unloading</div>
          <div className="text-lg font-bold text-foreground mt-1">
            {data.loadingTasksCount} / {data.unloadingTasksCount}
          </div>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="text-xs text-muted-foreground flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <CheckCircle className="w-3.5 h-3.5" /> Completed Tasks
          </div>
          <div className="text-lg font-bold text-foreground mt-1">{data.completedAssignmentsCount}</div>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="text-xs text-muted-foreground flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <Clock className="w-3.5 h-3.5" /> Pending Settlement
          </div>
          <div className="text-lg font-bold text-foreground mt-1">{data.pendingAssignmentsCount}</div>
        </div>
      </div>

      {/* Worker Overview Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-3 border-b border-border bg-muted/40 font-semibold text-xs text-foreground">
          Worker Handling Summary
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/20 text-muted-foreground uppercase text-[10px]">
              <tr>
                <th className="p-2.5">Worker Name</th>
                <th className="p-2.5 text-right">Assignments</th>
                <th className="p-2.5 text-right">Loading</th>
                <th className="p-2.5 text-right">Unloading</th>
                <th className="p-2.5 text-right">Recorded Qty Handled</th>
                <th className="p-2.5 text-right">Total Compensation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.workerOverview.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">No worker task records found</td>
                </tr>
              ) : (
                data.workerOverview.map((w) => (
                  <tr key={w.workerName} className="hover:bg-muted/30">
                    <td className="p-2.5 font-medium text-foreground">{w.workerName}</td>
                    <td className="p-2.5 text-right font-semibold">{w.assignmentsCount}</td>
                    <td className="p-2.5 text-right">{w.loadingCount}</td>
                    <td className="p-2.5 text-right">{w.unloadingCount}</td>
                    <td className="p-2.5 text-right">
                      {typeof w.totalQuantityHandled === "number" ? (
                        <span>{w.totalQuantityHandled.toLocaleString()}</span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                          {w.totalQuantityHandled}
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 text-right font-medium">
                      {w.totalCompensationEarned !== null ? `৳${w.totalCompensationEarned.toLocaleString()}` : <span className="text-muted-foreground italic">Masked</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
