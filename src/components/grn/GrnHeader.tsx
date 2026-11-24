"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Plus, RefreshCw, FileText } from "lucide-react";

interface GrnHeaderProps {
  title: string;
  subtitle?: string;
  grnNumber?: string;
  status?: string;
  isDetailPage?: boolean;
  onRefresh?: () => void;
  loading?: boolean;
}

export function GrnHeader({
  title,
  subtitle,
  grnNumber,
  status,
  isDetailPage = false,
  onRefresh,
  loading = false,
}: GrnHeaderProps) {
  const getStatusBadge = (st?: string) => {
    switch (st) {
      case "VERIFIED":
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
      case "READY_FOR_CONFIRMATION":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";
      case "NEEDS_REVIEW":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
      case "OCR_PROCESSING":
        return "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20";
      case "CANCELLED":
        return "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20";
      case "FAILED":
        return "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20";
      default:
        return "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/20";
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4 mb-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-700 dark:text-zinc-300">
          <Link href="/inventory" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
            Inventory
          </Link>
          <span>/</span>
          <Link href="/inventory/grn" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
            Goods Receipt Notes
          </Link>
          {grnNumber && (
            <>
              <span>/</span>
              <span className="text-zinc-900 dark:text-zinc-100 font-medium">{grnNumber}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isDetailPage && (
            <Link
              href="/inventory/grn"
              className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
          )}
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {title}
          </h1>
          {status && (
            <span
              className={`px-2 py-0.5 text-xs font-mono font-medium rounded border uppercase ${getStatusBadge(
                status
              )}`}
            >
              {status.replace(/_/g, " ")}
            </span>
          )}
        </div>

        {subtitle && (
          <p className="text-xs text-zinc-700 dark:text-zinc-300">
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-850 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        )}

        {!isDetailPage && (
          <Link
            href="/inventory/grn/new"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Create GRN
          </Link>
        )}
      </div>
    </div>
  );
}
