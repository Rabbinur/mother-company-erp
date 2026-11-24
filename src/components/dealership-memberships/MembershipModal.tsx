"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { DealershipMembershipItem } from "./MembershipTable";

export interface MembershipFormData {
  userId?: string;
  dealershipId?: string;
  role: string;
  isPrimary: boolean;
  status: "active" | "suspended" | "inactive";
  employeeId?: string;
  designation?: string;
  department?: string;
}

export interface UserOption {
  _id: string;
  name: string;
  email: string;
}

export interface DealershipOption {
  _id: string;
  name: string;
  code: string;
}

export const ROLES = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "manager", label: "General Manager" },
  { value: "accountant", label: "Accountant / Finance" },
  { value: "warehouse_manager", label: "Warehouse Manager" },
  { value: "cashier", label: "Cashier" },
  { value: "sales_rep", label: "Sales Representative" },
  { value: "staff", label: "General Staff" },
];

interface MembershipModalProps {
  isOpen: boolean;
  isEditing: boolean;
  initialData?: DealershipMembershipItem | null;
  users: UserOption[];
  dealerships: DealershipOption[];
  saving: boolean;
  onClose: () => void;
  onSave: (data: MembershipFormData) => Promise<void>;
}

export function MembershipModal({
  isOpen,
  isEditing,
  initialData,
  users,
  dealerships,
  saving,
  onClose,
  onSave,
}: MembershipModalProps) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedDealershipId, setSelectedDealershipId] = useState("");
  const [role, setRole] = useState("sales_rep");
  const [isPrimary, setIsPrimary] = useState(false);
  const [status, setStatus] = useState<"active" | "suspended" | "inactive">("active");
  const [employeeId, setEmployeeId] = useState("");
  const [designation, setDesignation] = useState("");
  const [department, setDepartment] = useState("");

  useEffect(() => {
    if (initialData && isEditing) {
      const uId =
        typeof initialData.userId === "object" && initialData.userId
          ? initialData.userId._id
          : (initialData.userId as string);
      const dId =
        typeof initialData.dealershipId === "object" && initialData.dealershipId
          ? initialData.dealershipId._id
          : (initialData.dealershipId as string);
      setSelectedUserId(uId);
      setSelectedDealershipId(dId);
      setRole(initialData.role || "sales_rep");
      setIsPrimary(initialData.isPrimary || false);
      setStatus(initialData.status || "active");
      setEmployeeId(initialData.employeeId || "");
      setDesignation(initialData.designation || "");
      setDepartment(initialData.department || "");
    } else {
      setSelectedUserId(users[0]?._id || "");
      setSelectedDealershipId(dealerships[0]?._id || "");
      setRole("sales_rep");
      setIsPrimary(false);
      setStatus("active");
      setEmployeeId("");
      setDesignation("");
      setDepartment("");
    }
  }, [initialData, isEditing, isOpen, users, dealerships]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(
      isEditing
        ? {
            role,
            isPrimary,
            status,
            employeeId: employeeId || undefined,
            designation: designation || undefined,
            department: department || undefined,
          }
        : {
            userId: selectedUserId,
            dealershipId: selectedDealershipId,
            role,
            isPrimary,
            status,
            employeeId: employeeId || undefined,
            designation: designation || undefined,
            department: department || undefined,
          }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {isEditing ? "Edit Dealership Staff Assignment" : "Assign Staff to Dealership"}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {!isEditing && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Staff User Account *
                </label>
                <select
                  required
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  {users.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Dealership *
                </label>
                <select
                  required
                  value={selectedDealershipId}
                  onChange={(e) => setSelectedDealershipId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  {dealerships.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Dealership Role *
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as "active" | "suspended" | "inactive")
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary"
              />
              <div>
                <span className="text-xs font-medium text-slate-900 dark:text-white">
                  Set as Primary Dealership
                </span>
                <p className="text-[11px] text-slate-500">
                  When enabled, this branch will be the default working outlet for this staff member.
                </p>
              </div>
            </label>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Employee ID
              </label>
              <input
                type="text"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="EMP-1001"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Designation
              </label>
              <input
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="Sr. Sales Rep"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Department
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Commercial"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Saving..." : isEditing ? "Save Changes" : "Assign Staff"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
