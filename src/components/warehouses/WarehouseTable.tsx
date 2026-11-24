"use client";

import React from "react";
import { Edit2, Trash2, Layers, Store } from "lucide-react";
import { formatShortDate } from "@/lib/utils";

export interface WarehouseItem {
  _id: string;
  businessId: string;
  dealershipIds: Array<{ _id: string; name: string; code: string } | string>;
  name: string;
  code: string;
  isCentral: boolean;
  status: "active" | "inactive";
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  createdAt: string;
}

interface WarehouseTableProps {
  warehouses: WarehouseItem[];
  loading: boolean;
  onEdit: (warehouse: WarehouseItem) => void;
  onDelete: (id: string, name: string) => void;
}

export function WarehouseTable({
  warehouses,
  loading,
  onEdit,
  onDelete,
}: WarehouseTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
        <thead className="bg-slate-50 dark:bg-slate-800/60">
          <tr>
            <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">
              Warehouse Name & Code
            </th>
            <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">
              Storage Type & Scope
            </th>
            <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">
              Assigned Dealerships
            </th>
            <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">
              Contact & Location
            </th>
            <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">
              Status
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
                <p className="mt-2 text-xs">Loading warehouses...</p>
              </td>
            </tr>
          ) : warehouses.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                No warehouses found.
              </td>
            </tr>
          ) : (
            warehouses.map((w) => {
              const assignedNames = (w.dealershipIds || []).map((d) =>
                typeof d === "object" && d ? d.name : "Dealership"
              );

              return (
                <tr key={w._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900 dark:text-white">{w.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Code: {w.code}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {w.isCentral ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                        <Layers className="h-3 w-3" />
                        Central Enterprise Hub
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
                        <Store className="h-3 w-3" />
                        Dealership / Shared
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {w.isCentral ? (
                      <span className="text-xs text-slate-400 italic">Available to all dealerships</span>
                    ) : assignedNames.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {assignedNames.map((name, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        Unassigned (Private)
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                    <div className="text-xs">{w.contactPerson || "—"}</div>
                    <div className="text-xs text-slate-400">{w.phone || w.email || w.address?.city || "—"}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        w.status === "active"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {w.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onEdit(w)}
                        className="rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        title="Edit Warehouse"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDelete(w._id, w.name)}
                        className="rounded p-1 text-red-400 hover:text-red-600"
                        title="Delete Warehouse"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
