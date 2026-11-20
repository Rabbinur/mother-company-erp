"use client";

import React, { ReactNode } from "react";
import { FolderOpen } from "lucide-react";

export interface ColumnDef<T> {
  header: ReactNode;
  accessorKey?: keyof T;
  cell?: (item: T, index: number) => ReactNode;
  align?: "left" | "center" | "right";
  className?: string;
  headerClassName?: string;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  emptyIcon?: ReactNode;
  onRowClick?: (item: T) => void;
  keyExtractor?: (item: T, index: number) => string;
  className?: string;
}

/**
 * Reusable Generic DataTable Component (Open/Closed & Liskov Substitution Principle)
 * Fully decoupled from specific domain entities.
 */
export function DataTable<T>({
  columns,
  data,
  loading = false,
  emptyMessage = "No records found.",
  emptyIcon,
  onRowClick,
  keyExtractor,
  className = "",
}: DataTableProps<T>) {
  const getRowKey = (item: T, idx: number): string => {
    if (keyExtractor) return keyExtractor(item, idx);
    const candidate = item as { _id?: string; id?: string };
    return candidate._id || candidate.id || String(idx);
  };

  const getAlignClass = (align?: "left" | "center" | "right") => {
    if (align === "right") return "text-right";
    if (align === "center") return "text-center";
    return "text-left";
  };

  return (
    <div
      className={`overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs transition-all ${className}`}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          {/* Table Header */}
          <thead className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className={`px-4 py-3.5 ${getAlignClass(col.align)} ${
                    col.headerClassName || col.className || ""
                  }`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              // Skeleton loading states
              Array.from({ length: 5 }).map((_, rIdx) => (
                <tr key={`skeleton-${rIdx}`} className="animate-pulse">
                  {columns.map((col, cIdx) => (
                    <td key={`skeleton-col-${cIdx}`} className="px-4 py-4">
                      <div className="h-3.5 w-3/4 rounded-md bg-slate-100" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              // Empty State
              <tr>
                <td colSpan={columns.length} className="py-14 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                    {emptyIcon || <FolderOpen className="h-8 w-8 stroke-1 text-slate-300" />}
                    <p className="text-xs font-medium text-slate-500">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              // Data Rows
              data.map((item, rowIdx) => (
                <tr
                  key={getRowKey(item, rowIdx)}
                  onClick={() => onRowClick && onRowClick(item)}
                  className={`transition-colors hover:bg-slate-50/60 ${
                    onRowClick ? "cursor-pointer" : ""
                  }`}
                >
                  {columns.map((col, colIdx) => (
                    <td
                      key={colIdx}
                      className={`px-4 py-3.5 text-slate-700 ${getAlignClass(col.align)} ${
                        col.className || ""
                      }`}
                    >
                      {col.cell
                        ? col.cell(item, rowIdx)
                        : col.accessorKey
                        ? (item[col.accessorKey] as unknown as ReactNode)
                        : null}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
