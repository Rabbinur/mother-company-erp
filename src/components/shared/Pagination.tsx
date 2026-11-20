"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PaginationProps {
  page: number;
  totalPages: number;
  total?: number;
  limit?: number;
  onPageChange: (newPage: number) => void;
  className?: string;
}

/**
 * Reusable Pagination Bar Component (Single Responsibility: Page navigation controls)
 */
export const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  total,
  limit = 20,
  onPageChange,
  className = "",
}) => {
  if (totalPages <= 1 && !total) return null;

  const startItem = (page - 1) * limit + 1;
  const endItem = total ? Math.min(page * limit, total) : page * limit;

  return (
    <div
      className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-1 py-2 text-xs text-slate-500 ${className}`}
    >
      <div>
        {total !== undefined ? (
          <span>
            Showing <strong className="font-semibold text-slate-700">{startItem}</strong> to{" "}
            <strong className="font-semibold text-slate-700">{endItem}</strong> of{" "}
            <strong className="font-semibold text-slate-700">{total}</strong> records
          </span>
        ) : (
          <span>
            Page <strong className="font-semibold text-slate-700">{page}</strong> of{" "}
            <strong className="font-semibold text-slate-700">{totalPages}</strong>
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white shadow-2xs transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span>Previous</span>
        </button>

        <div className="flex items-center gap-1 px-1">
          {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
            const pageNum = i + 1;
            const isActive = pageNum === page;
            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => onPageChange(pageNum)}
                className={`h-7 w-7 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-white shadow-xs font-bold"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {pageNum}
              </button>
            );
          })}
          {totalPages > 5 && <span className="text-slate-400 px-0.5">...</span>}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white shadow-2xs transition-colors"
        >
          <span>Next</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
