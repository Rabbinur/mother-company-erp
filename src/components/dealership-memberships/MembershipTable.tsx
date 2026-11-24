"use client";

import React from "react";
import { Edit2, Trash2, Shield, Star, User } from "lucide-react";

export interface DealershipMembershipItem {
  _id: string;
  businessId: string;
  dealershipId: { _id: string; name: string; code: string } | string;
  userId: { _id: string; name: string; email: string } | string;
  role: string;
  isPrimary: boolean;
  status: "active" | "suspended" | "inactive";
  employeeId?: string;
  designation?: string;
  department?: string;
  createdAt: string;
}

interface MembershipTableProps {
  memberships: DealershipMembershipItem[];
  loading: boolean;
  onEdit: (membership: DealershipMembershipItem) => void;
  onDelete: (id: string) => void;
}

export function MembershipTable({
  memberships,
  loading,
  onEdit,
  onDelete,
}: MembershipTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
        <thead className="bg-slate-50 dark:bg-slate-800/60">
          <tr>
            <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">
              Staff Member
            </th>
            <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">
              Assigned Dealership
            </th>
            <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">
              Branch Role & Scope
            </th>
            <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">
              Employee Details
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
                <p className="mt-2 text-xs">Loading staff memberships...</p>
              </td>
            </tr>
          ) : memberships.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                No dealership staff memberships found.
              </td>
            </tr>
          ) : (
            memberships.map((m) => {
              const userName =
                typeof m.userId === "object" && m.userId ? m.userId.name : "Unknown User";
              const userEmail =
                typeof m.userId === "object" && m.userId ? m.userId.email : "";
              const dealershipName =
                typeof m.dealershipId === "object" && m.dealershipId
                  ? m.dealershipId.name
                  : "Unknown Dealership";
              const dealershipCode =
                typeof m.dealershipId === "object" && m.dealershipId
                  ? m.dealershipId.code
                  : "";

              return (
                <tr key={m._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                      <User className="h-4 w-4 text-slate-400" />
                      {userName}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{userEmail}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900 dark:text-white">
                      {dealershipName}
                    </div>
                    <div className="text-xs text-slate-500">Code: {dealershipCode}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                        <Shield className="h-3 w-3 text-primary" />
                        {m.role.toUpperCase()}
                      </span>
                      {m.isPrimary && (
                        <span
                          className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                          title="Primary Dealership for this staff member"
                        >
                          <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                          Primary
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                    <div className="text-xs font-medium">
                      {m.designation || m.department ? `${m.designation || ""} ${m.department ? `(${m.department})` : ""}` : "—"}
                    </div>
                    {m.employeeId && (
                      <div className="text-xs text-slate-400">ID: {m.employeeId}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        m.status === "active"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : m.status === "suspended"
                          ? "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {m.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onEdit(m)}
                        className="rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        title="Edit Staff Assignment"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDelete(m._id)}
                        className="rounded p-1 text-red-400 hover:text-red-600"
                        title="Revoke Staff Assignment"
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
