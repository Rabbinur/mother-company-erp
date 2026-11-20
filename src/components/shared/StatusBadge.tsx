"use client";

import React from "react";
import { StatusVariant } from "@/types/common";

export interface StatusBadgeProps {
  status?: string;
  variant?: StatusVariant;
  label?: string;
  className?: string;
}

const STATUS_MAP: Record<string, { variant: StatusVariant; label: string }> = {
  // Positive / Success
  active: { variant: "success", label: "Active" },
  confirmed: { variant: "success", label: "Confirmed" },
  fulfilled: { variant: "success", label: "Fulfilled" },
  received: { variant: "success", label: "Received" },
  paid: { variant: "success", label: "Paid" },
  approved: { variant: "success", label: "Approved" },
  completed: { variant: "success", label: "Completed" },

  // Warning / Attention
  pending: { variant: "warning", label: "Pending" },
  draft: { variant: "warning", label: "Draft" },
  ordered: { variant: "info", label: "Ordered" },
  partially_received: { variant: "warning", label: "Partially Received" },
  partial: { variant: "warning", label: "Partial" },
  reserved: { variant: "warning", label: "Reserved" },

  // Danger / Alert
  cancelled: { variant: "danger", label: "Cancelled" },
  inactive: { variant: "danger", label: "Inactive" },
  suspended: { variant: "danger", label: "Suspended" },
  damaged: { variant: "danger", label: "Damaged" },
  rejected: { variant: "danger", label: "Rejected" },
  overdue: { variant: "danger", label: "Overdue" },
  out_of_stock: { variant: "danger", label: "Out of Stock" },

  // Info / Processing
  in_transit: { variant: "info", label: "In Transit" },
  processing: { variant: "info", label: "Processing" },
  new: { variant: "info", label: "New" },
};

const VARIANT_STYLES: Record<StatusVariant, string> = {
  success: "bg-emerald-50 text-emerald-700 border-emerald-200/60 ring-emerald-500/10",
  warning: "bg-amber-50 text-amber-700 border-amber-200/60 ring-amber-500/10",
  danger: "bg-red-50 text-red-700 border-red-200/60 ring-red-500/10",
  info: "bg-sky-50 text-sky-700 border-sky-200/60 ring-sky-500/10",
  neutral: "bg-slate-50 text-slate-700 border-slate-200/60 ring-slate-500/10",
  primary: "bg-blue-50 text-blue-700 border-blue-200/60 ring-blue-500/10",
};

/**
 * Reusable StatusBadge Component (Open/Closed: Maps statuses to consistent semantic UI)
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status = "",
  variant,
  label,
  className = "",
}) => {
  const normalizedKey = status.toLowerCase().trim();
  const matched = STATUS_MAP[normalizedKey];

  const effectiveVariant: StatusVariant = variant || matched?.variant || "neutral";
  const effectiveLabel = label || matched?.label || status.replace(/_/g, " ") || "Unknown";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize shadow-2xs ${VARIANT_STYLES[effectiveVariant]} ${className}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          effectiveVariant === "success"
            ? "bg-emerald-500"
            : effectiveVariant === "warning"
            ? "bg-amber-500"
            : effectiveVariant === "danger"
            ? "bg-red-500"
            : effectiveVariant === "info"
            ? "bg-sky-500"
            : "bg-slate-400"
        }`}
      />
      {effectiveLabel}
    </span>
  );
};
