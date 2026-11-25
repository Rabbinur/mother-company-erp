"use client";

import React from "react";
import { format } from "date-fns";
import { ArrowLeftRight, CheckCircle2, Truck, ShieldCheck, XCircle, Clock } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export interface PurchaseReturnSummary {
  _id: string;
  returnNumber: string;
  grnNumber?: string;
  vendorName?: string;
  warehouseName?: string;
  status: string;
  totalDebitAmount: number;
  settledAmount: number;
  createdAt: string;
}

interface PurchaseReturnTableProps {
  returns: PurchaseReturnSummary[];
  isLoading?: boolean;
  onDispatch?: (ret: PurchaseReturnSummary) => void;
  onSettle?: (ret: PurchaseReturnSummary) => void;
}

export function PurchaseReturnTable({
  returns,
  isLoading = false,
  onDispatch,
  onSettle,
}: PurchaseReturnTableProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
      case "SUBMITTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 border border-amber-200/50">
            <Clock className="w-3 h-3" /> Submitted
          </span>
        );
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 border border-blue-200/50">
            <CheckCircle2 className="w-3 h-3" /> Approved
          </span>
        );
      case "DISPATCHED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-600 border border-indigo-200/50">
            <Truck className="w-3 h-3" /> Dispatched
          </span>
        );
      case "SUPPLIER_ACKNOWLEDGED":
      case "CREDIT_NOTE_RECEIVED":
      case "SETTLED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-200/50">
            <ShieldCheck className="w-3 h-3" /> Settled
          </span>
        );
      case "REJECTED":
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-600 border border-red-200/50">
            <XCircle className="w-3 h-3" /> Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-card text-card-foreground shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border/50 bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Return #</th>
              <th className="px-4 py-3">GRN #</th>
              <th className="px-4 py-3">Vendor / Supplier</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Debit Value</th>
              <th className="px-4 py-3 text-right">Settled Amount</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-xs text-muted-foreground">
                  Loading supplier returns...
                </td>
              </tr>
            ) : returns.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-xs text-muted-foreground">
                  No supplier purchase returns recorded.
                </td>
              </tr>
            ) : (
              returns.map((ret) => (
                <tr key={ret._id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-semibold text-foreground flex items-center gap-1.5">
                    <ArrowLeftRight className="w-3.5 h-3.5 text-blue-500" />
                    {ret.returnNumber}
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{ret.grnNumber || "—"}</td>
                  <td className="px-4 py-3 text-foreground font-medium">{ret.vendorName || "Supplier"}</td>
                  <td className="px-4 py-3">{getStatusBadge(ret.status)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground">
                    {formatCurrency(ret.totalDebitAmount)}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground font-medium">
                    {formatCurrency(ret.settledAmount)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {format(new Date(ret.createdAt), "MMM d, yyyy")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {(ret.status === "SUBMITTED" || ret.status === "APPROVED") && onDispatch && (
                        <button
                          onClick={() => onDispatch(ret)}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 transition-colors"
                        >
                          Dispatch Stock
                        </button>
                      )}
                      {ret.status === "DISPATCHED" && onSettle && (
                        <button
                          onClick={() => onSettle(ret)}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors"
                        >
                          Settle Credit
                        </button>
                      )}
                    </div>
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
