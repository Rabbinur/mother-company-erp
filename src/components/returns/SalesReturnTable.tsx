"use client";

import React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { RotateCcw, CheckCircle2, AlertTriangle, XCircle, Clock, ShieldCheck, Eye } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export interface SalesReturnSummary {
  _id: string;
  returnNumber: string;
  orderNumber?: string;
  customerName?: string;
  dealershipName?: string;
  status: string;
  refundStatus: string;
  totalReturnedAmount: number;
  netRefundAmount?: number;
  returnReason?: string;
  createdAt: string;
}

interface SalesReturnTableProps {
  returns: SalesReturnSummary[];
  isLoading?: boolean;
  onInspect?: (ret: SalesReturnSummary) => void;
  onRefund?: (ret: SalesReturnSummary) => void;
}

export function SalesReturnTable({
  returns,
  isLoading = false,
  onInspect,
  onRefund,
}: SalesReturnTableProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "REQUESTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 border border-amber-200/50">
            <Clock className="w-3 h-3" /> Requested
          </span>
        );
      case "RECEIVED":
      case "UNDER_INSPECTION":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 border border-blue-200/50">
            <Clock className="w-3 h-3" /> Inspecting
          </span>
        );
      case "APPROVED":
      case "RESTOCKED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-200/50">
            <CheckCircle2 className="w-3 h-3" /> Restocked
          </span>
        );
      case "REFUNDED":
      case "CREDIT_NOTE_ISSUED":
      case "CLOSED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-700 border border-slate-200/50">
            <ShieldCheck className="w-3 h-3" /> Settled
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-600 border border-red-200/50">
            <XCircle className="w-3 h-3" /> Rejected
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

  const getRefundBadge = (refundStatus: string) => {
    switch (refundStatus) {
      case "PENDING":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600">
            Pending
          </span>
        );
      case "CREDIT_NOTE_ISSUED":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-600">
            Credit Note
          </span>
        );
      case "REFUNDED":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600">
            Paid
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground">
            {refundStatus || "N/A"}
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
              <th className="px-4 py-3">Order #</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Refund Status</th>
              <th className="px-4 py-3 text-right">Return Amount</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-xs text-muted-foreground">
                  Loading customer returns...
                </td>
              </tr>
            ) : returns.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-xs text-muted-foreground">
                  No customer sales returns recorded.
                </td>
              </tr>
            ) : (
              returns.map((ret) => (
                <tr key={ret._id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-semibold text-foreground">
                    <Link
                      href={`/returns/sales/${ret._id}`}
                      className="hover:underline flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-primary" />
                      {ret.returnNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">
                    {ret.orderNumber || "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground font-medium">
                    {ret.customerName || "Customer"}
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(ret.status)}</td>
                  <td className="px-4 py-3">{getRefundBadge(ret.refundStatus)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground">
                    {formatCurrency(ret.netRefundAmount ?? ret.totalReturnedAmount)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {format(new Date(ret.createdAt), "MMM d, yyyy")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {(ret.status === "REQUESTED" || ret.status === "UNDER_INSPECTION") && onInspect && (
                        <button
                          onClick={() => onInspect(ret)}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors"
                        >
                          Inspect
                        </button>
                      )}
                      {(ret.status === "APPROVED" || ret.status === "RESTOCKED") &&
                        ret.refundStatus === "PENDING" &&
                        onRefund && (
                          <button
                            onClick={() => onRefund(ret)}
                            className="px-2.5 py-1 text-[11px] font-semibold rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                          >
                            Refund / Credit
                          </button>
                        )}
                      <Link
                        href={`/returns/sales/${ret._id}`}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
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
