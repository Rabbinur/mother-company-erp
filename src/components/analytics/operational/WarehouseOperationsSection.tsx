"use client";

import React from "react";
import { Warehouse, CheckCircle2, Clock, AlertTriangle, Info } from "lucide-react";
import type { WarehouseOperationsData } from "@/services/analytics/operational/types";

interface Props {
  data: WarehouseOperationsData;
}

export function WarehouseOperationsSection({ data }: Props) {
  const { grnReceiving: grn, dispatchReadiness: dr } = data;

  const reconBadgeColor =
    data.reconciliationStatus === "CONFIGURED"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200"
      : data.reconciliationStatus === "INCOMPLETE"
      ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200"
      : "bg-muted text-muted-foreground border-border";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Warehouse className="w-4 h-4 text-primary" /> Warehouse Operational Intelligence
          </h3>
          <p className="text-xs text-muted-foreground">
            Challan receiving, GRN verification latency, dispatch staging, transfers, and day-end reconciliation evidence.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-xs px-2.5 py-1 rounded-full border font-medium flex items-center gap-1.5 ${reconBadgeColor}`}>
            <Info className="w-3.5 h-3.5" />
            Reconciliation Evidence: <span className="font-semibold">{data.reconciliationStatus}</span>
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-muted border border-border font-medium text-muted-foreground flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            Put-Away / Picking: <span className="font-semibold text-foreground">NOT_CONFIGURED</span>
          </span>
        </div>
      </div>

      {/* GRN Receiving & Verification */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="text-xs text-muted-foreground">Inbound GRNs</div>
          <div className="text-lg font-bold text-foreground mt-1">{grn.totalGrnsReceived}</div>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="text-xs text-muted-foreground flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Verified GRNs
          </div>
          <div className="text-lg font-bold text-foreground mt-1">{grn.verifiedGrnsCount}</div>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="text-xs text-muted-foreground flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <Clock className="w-3.5 h-3.5" /> Pending Verification
          </div>
          <div className="text-lg font-bold text-foreground mt-1">{grn.pendingVerificationCount}</div>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="text-xs text-muted-foreground flex items-center gap-1 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-3.5 h-3.5" /> Needs Review
          </div>
          <div className="text-lg font-bold text-foreground mt-1">{grn.needsReviewCount}</div>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="text-xs text-muted-foreground">Avg Verification Time</div>
          <div className="text-lg font-bold text-foreground mt-1">
            {grn.averageVerificationHours !== null ? `${grn.averageVerificationHours}h` : "N/A"}
          </div>
        </div>
      </div>

      {/* Dispatch Readiness & Stock Movements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Dispatch Staging & Loading */}
        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Dispatch Staging & Readiness Status
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 rounded bg-muted/40 text-center">
              <div className="text-sm font-bold text-foreground">{dr.pendingDispatchCount}</div>
              <div className="text-[10px] text-muted-foreground">Pending Staging</div>
            </div>
            <div className="p-2.5 rounded bg-blue-50 dark:bg-blue-950/40 text-center">
              <div className="text-sm font-bold text-blue-600 dark:text-blue-400">{dr.readyForDispatchCount}</div>
              <div className="text-[10px] text-muted-foreground">Ready for Dispatch</div>
            </div>
            <div className="p-2.5 rounded bg-amber-50 dark:bg-amber-950/40 text-center">
              <div className="text-sm font-bold text-amber-600 dark:text-amber-400">{dr.loadedCount}</div>
              <div className="text-[10px] text-muted-foreground">Loaded on Vehicle</div>
            </div>
            <div className="p-2.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-center">
              <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{dr.inTransitCount}</div>
              <div className="text-[10px] text-muted-foreground">In Transit</div>
            </div>
          </div>
        </div>

        {/* Transfers, Adjustments & Quarantined Batches */}
        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>Inventory Controls & Integrity</span>
            {data.dispatchesWithVarianceCount > 0 && (
              <span className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {data.dispatchesWithVarianceCount} Confirmed Variances
              </span>
            )}
          </h4>
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 rounded bg-muted/40 text-center">
              <div className="text-sm font-bold text-foreground">{data.warehouseTransfersCount}</div>
              <div className="text-[10px] text-muted-foreground">Transfers ({data.totalQuantityTransferred.toLocaleString()} u)</div>
            </div>
            <div className="p-2.5 rounded bg-muted/40 text-center">
              <div className="text-sm font-bold text-foreground">{data.stockAdjustmentsCount}</div>
              <div className="text-[10px] text-muted-foreground">Adjustments ({data.netAdjustmentQuantity > 0 ? `+${data.netAdjustmentQuantity}` : data.netAdjustmentQuantity} u)</div>
            </div>
            <div className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/40 text-center">
              <div className="text-sm font-bold text-rose-600 dark:text-rose-400">{data.quarantinedBatchesCount}</div>
              <div className="text-[10px] text-muted-foreground">Quarantined ({data.quarantinedQuantity.toLocaleString()} u)</div>
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1 border-t border-border/40">
            <span>Day-End Reconciliations: {data.dayEndReconciliationsCount} evaluated ({data.completedReconciliationsCount} complete, {data.incompleteReconciliationsCount} incomplete)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
