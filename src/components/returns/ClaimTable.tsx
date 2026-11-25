"use client";

import React from "react";
import { format } from "date-fns";
import { ShieldAlert, CheckCircle2, XCircle, Clock, ShieldCheck } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export interface ClaimSummary {
  _id: string;
  claimNumber: string;
  title: string;
  category: string;
  claimedAgainstType: string;
  status: string;
  claimedAmount: number;
  approvedAmount?: number;
  settledAmount?: number;
  createdAt: string;
}

interface ClaimTableProps {
  claims: ClaimSummary[];
  isLoading?: boolean;
  onApprove?: (claim: ClaimSummary) => void;
  onSettle?: (claim: ClaimSummary) => void;
}

export function ClaimTable({
  claims,
  isLoading = false,
  onApprove,
  onSettle,
}: ClaimTableProps) {
  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "supplier_shortage":
        return "Supplier Shortage";
      case "supplier_damage":
        return "Supplier Inward Damage";
      case "delivery_transit_damage":
        return "Transit Damage";
      case "warehouse_damage":
        return "Warehouse Spoilage";
      case "principal_reimbursement":
        return "Principal Warranty";
      default:
        return category.replace(/_/g, " ");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUBMITTED":
      case "UNDER_REVIEW":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 border border-amber-200/50">
            <Clock className="w-3 h-3" /> Under Review
          </span>
        );
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 border border-blue-200/50">
            <CheckCircle2 className="w-3 h-3" /> Approved
          </span>
        );
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

  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-card text-card-foreground shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border/50 bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Claim #</th>
              <th className="px-4 py-3">Title & Category</th>
              <th className="px-4 py-3">Claim Target</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Claimed Amount</th>
              <th className="px-4 py-3 text-right">Approved Amount</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-xs text-muted-foreground">
                  Loading claims...
                </td>
              </tr>
            ) : claims.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-xs text-muted-foreground">
                  No claims recorded.
                </td>
              </tr>
            ) : (
              claims.map((claim) => (
                <tr key={claim._id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-semibold text-foreground flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-purple-500" />
                    {claim.claimNumber}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{claim.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {getCategoryLabel(claim.category)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">
                    {claim.claimedAgainstType}
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(claim.status)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground">
                    {formatCurrency(claim.claimedAmount)}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground font-medium">
                    {claim.approvedAmount ? formatCurrency(claim.approvedAmount) : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {format(new Date(claim.createdAt), "MMM d, yyyy")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {(claim.status === "SUBMITTED" || claim.status === "UNDER_REVIEW") && onApprove && (
                        <button
                          onClick={() => onApprove(claim)}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors"
                        >
                          Review / Approve
                        </button>
                      )}
                      {claim.status === "APPROVED" && onSettle && (
                        <button
                          onClick={() => onSettle(claim)}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors"
                        >
                          Settle Payout
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
