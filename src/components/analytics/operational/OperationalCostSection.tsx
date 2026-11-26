"use client";

import React from "react";
import { DollarSign, ShieldAlert, PieChart, FileText, CheckCircle2 } from "lucide-react";
import type { OperationalCostData } from "@/services/analytics/operational/types";

interface Props {
  data: OperationalCostData;
}

export function OperationalCostSection({ data }: Props) {
  if (data.totalDeliveryExpenses === null) {
    return (
      <div className="p-6 rounded-xl border border-dashed border-border bg-card text-center space-y-2">
        <ShieldAlert className="w-8 h-8 text-muted-foreground mx-auto" />
        <h3 className="text-sm font-semibold text-foreground">Operational Cost Data Masked</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Financial cost analytics (freight, trip expenses, and principal claims) require elevated executive/financial permissions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-primary" /> Operational Cost Intelligence
        </h3>
        <p className="text-xs text-muted-foreground">
          Delivery expenses, cost efficiency ratios, and principal reimbursement claim settlements.
        </p>
      </div>

      {/* Cost Efficiency KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="text-xs text-muted-foreground">Total Delivery Expenses</div>
          <div className="text-lg font-bold text-foreground mt-1">
            ৳{data.totalDeliveryExpenses.toLocaleString()}
          </div>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="text-xs text-muted-foreground">Cost / Fulfilled Order</div>
          <div className="text-lg font-bold text-foreground mt-1">
            {data.costPerFulfilledOrder !== null ? `৳${data.costPerFulfilledOrder.toLocaleString()}` : "N/A"}
          </div>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="text-xs text-muted-foreground">Cost / Delivered Unit</div>
          <div className="text-lg font-bold text-foreground mt-1">
            {data.costPerDeliveredUnit !== null ? `৳${data.costPerDeliveredUnit.toLocaleString()}` : "N/A"}
          </div>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="text-xs text-muted-foreground">Worker Handling Cost</div>
          <div className="text-lg font-bold text-foreground mt-1">
            {data.workerHandlingCostTotal !== null ? `৳${data.workerHandlingCostTotal.toLocaleString()}` : "N/A"}
          </div>
        </div>
      </div>

      {/* Principal Reimbursement Claims Breakdown */}
      <div className="p-4 rounded-xl border border-border bg-card">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-primary" /> Principal Brand Reimbursement Tracking
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <div className="text-xs text-muted-foreground">Pending Claims ({data.pendingPrincipalReimbursementClaimsCount})</div>
            <div className="text-base font-bold text-foreground mt-1">
              ৳{(data.pendingPrincipalReimbursementAmount || 0).toLocaleString()}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Submitted / Under Review</div>
          </div>
          <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40">
            <div className="text-xs text-blue-700 dark:text-blue-300">Principal Receivable</div>
            <div className="text-base font-bold text-blue-800 dark:text-blue-200 mt-1">
              ৳{(data.principalReceivableAmount || 0).toLocaleString()}
            </div>
            <div className="text-[10px] text-blue-600/80 dark:text-blue-400 mt-0.5">Approved, awaiting inflow</div>
          </div>
          <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40">
            <div className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Settled Reimbursements
            </div>
            <div className="text-base font-bold text-emerald-800 dark:text-emerald-200 mt-1">
              ৳{(data.settledReimbursementAmount || 0).toLocaleString()}
            </div>
            <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400 mt-0.5">Total collected</div>
          </div>
        </div>
      </div>

      {/* Dealership Cost Allocations */}
      {data.allocatedDeliveryCostByDealership.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-3 border-b border-border bg-muted/40 font-semibold text-xs text-foreground">
            Dealership Delivery Expense Allocations
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/20 text-muted-foreground uppercase text-[10px]">
                <tr>
                  <th className="p-2.5">Dealership</th>
                  <th className="p-2.5 text-right">Allocated Expense</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.allocatedDeliveryCostByDealership.map((alloc) => (
                  <tr key={alloc.dealershipId} className="hover:bg-muted/30">
                    <td className="p-2.5 font-medium text-foreground">{alloc.dealershipName}</td>
                    <td className="p-2.5 text-right font-semibold">৳{alloc.allocatedAmount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
