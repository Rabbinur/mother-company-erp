"use client";

import React from "react";
import Link from "next/link";
import { Eye, FileText, CheckCircle2, Clock, AlertTriangle, XCircle } from "lucide-react";

export interface GrnSummary {
  _id: string;
  grnNumber: string;
  challanNumber: string;
  challanDate: string | Date;
  status: string;
  supplierId?: { name: string; companyName?: string };
  warehouseId?: { name: string; code?: string };
  items?: any[];
  netInvoiceTotal?: number;
  document?: { originalName: string };
  createdAt: string | Date;
}

interface GrnHistoryTableProps {
  grns: GrnSummary[];
  loading?: boolean;
  canViewCost?: boolean;
}

export function GrnHistoryTable({
  grns,
  loading = false,
  canViewCost = true,
}: GrnHistoryTableProps) {
  const getStatusBadge = (st: string) => {
    switch (st) {
      case "VERIFIED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono font-medium rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> VERIFIED
          </span>
        );
      case "READY_FOR_CONFIRMATION":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono font-medium rounded bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
            <Clock className="w-3 h-3" /> READY
          </span>
        );
      case "NEEDS_REVIEW":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono font-medium rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3 h-3" /> REVIEW
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono font-medium rounded bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20">
            <XCircle className="w-3 h-3" /> CANCELLED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono font-medium rounded bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border border-zinc-500/20">
            {st}
          </span>
        );
    }
  };

  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850/50 text-zinc-600 dark:text-zinc-400 font-medium">
              <th className="py-2.5 px-3">GRN #</th>
              <th className="py-2.5 px-3">Challan #</th>
              <th className="py-2.5 px-3">Supplier</th>
              <th className="py-2.5 px-3">Warehouse</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3 font-mono text-right">Items</th>
              {canViewCost && <th className="py-2.5 px-3 font-mono text-right">Net Value</th>}
              <th className="py-2.5 px-3">Date</th>
              <th className="py-2.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {loading ? (
              <tr>
                <td colSpan={canViewCost ? 9 : 8} className="py-8 text-center text-zinc-400 font-mono">
                  Loading Goods Receipt Notes...
                </td>
              </tr>
            ) : grns.length === 0 ? (
              <tr>
                <td colSpan={canViewCost ? 9 : 8} className="py-8 text-center text-zinc-400 font-mono">
                  No GRN records found. Click &quot;Create GRN&quot; to begin.
                </td>
              </tr>
            ) : (
              grns.map((g) => (
                <tr key={g._id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-850/30 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-medium text-zinc-900 dark:text-zinc-100">
                    <Link href={`/inventory/grn/${g._id}`} className="hover:underline">
                      {g.grnNumber}
                    </Link>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-zinc-700 dark:text-zinc-300">{g.challanNumber}</td>
                  <td className="py-2.5 px-3 font-medium text-zinc-900 dark:text-zinc-100">
                    {g.supplierId?.companyName || g.supplierId?.name || "Direct Supplier"}
                  </td>
                  <td className="py-2.5 px-3 text-zinc-700 dark:text-zinc-300">
                    {g.warehouseId?.name || "Warehouse"}
                  </td>
                  <td className="py-2.5 px-3">{getStatusBadge(g.status)}</td>
                  <td className="py-2.5 px-3 font-mono text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                    {g.items?.length || 0}
                  </td>
                  {canViewCost && (
                    <td className="py-2.5 px-3 font-mono text-right tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                      {g.netInvoiceTotal !== undefined ? `৳${g.netInvoiceTotal.toFixed(2)}` : "-"}
                    </td>
                  )}
                  <td className="py-2.5 px-3 font-mono text-zinc-700 dark:text-zinc-300">
                    {new Date(g.challanDate).toLocaleDateString()}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <Link
                      href={`/inventory/grn/${g._id}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" /> Review
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
