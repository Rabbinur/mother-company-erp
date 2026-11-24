"use client";

import React from "react";
import { Edit2, Trash2 } from "lucide-react";
import { formatShortDate } from "@/lib/utils";

export interface PrincipalCompany {
  _id: string;
  businessId: string;
  name: string;
  code: string;
  status: "active" | "inactive";
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  createdAt: string;
}

interface PrincipalCompanyTableProps {
  companies: PrincipalCompany[];
  loading: boolean;
  onEdit: (company: PrincipalCompany) => void;
  onDelete: (id: string, name: string) => void;
}

export function PrincipalCompanyTable({
  companies,
  loading,
  onEdit,
  onDelete,
}: PrincipalCompanyTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
        <thead className="bg-slate-50 dark:bg-slate-800/60">
          <tr>
            <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">
              Company Name & Code
            </th>
            <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">
              Contact Person
            </th>
            <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">
              Phone & Email
            </th>
            <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">
              Status
            </th>
            <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">
              Created
            </th>
            <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-600 dark:text-slate-300">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
          {loading ? (
            <tr>
              <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="mt-2 text-xs">Loading companies...</p>
              </td>
            </tr>
          ) : companies.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                No principal companies found.
              </td>
            </tr>
          ) : (
            companies.map((c) => (
              <tr key={c._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-900 dark:text-white">{c.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Code: {c.code}</div>
                </td>
                <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                  {c.contactPerson || "—"}
                </td>
                <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                  <div className="text-xs">{c.contactPhone || "—"}</div>
                  <div className="text-xs text-slate-400">{c.contactEmail || "—"}</div>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      c.status === "active"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {c.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                  {formatShortDate(c.createdAt)}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onEdit(c)}
                      className="rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      title="Edit Company"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDelete(c._id, c.name)}
                      className="rounded p-1 text-red-400 hover:text-red-600"
                      title="Delete Company"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
