"use client";

import React, { useState, useEffect } from "react";
import {
  Network,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Shield,
  Star,
  User,
  X,
} from "lucide-react";
import { formatShortDate } from "@/lib/utils";

interface DealershipMembershipItem {
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

interface UserOption {
  _id: string;
  name: string;
  email: string;
}

interface DealershipOption {
  _id: string;
  name: string;
  code: string;
}

const ROLES = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "manager", label: "General Manager" },
  { value: "accountant", label: "Accountant / Finance" },
  { value: "warehouse_manager", label: "Warehouse Manager" },
  { value: "cashier", label: "Cashier" },
  { value: "sales_rep", label: "Sales Representative" },
  { value: "staff", label: "General Staff" },
];

export default function DealershipMembershipsPage() {
  const [memberships, setMemberships] = useState<DealershipMembershipItem[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [dealerships, setDealerships] = useState<DealershipOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dealershipFilter, setDealershipFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedDealershipId, setSelectedDealershipId] = useState("");
  const [role, setRole] = useState("sales_rep");
  const [isPrimary, setIsPrimary] = useState(false);
  const [status, setStatus] = useState<"active" | "suspended" | "inactive">("active");
  const [employeeId, setEmployeeId] = useState("");
  const [designation, setDesignation] = useState("");
  const [department, setDepartment] = useState("");

  useEffect(() => {
    fetchAuxiliaryData();
  }, []);

  useEffect(() => {
    fetchMemberships();
  }, [dealershipFilter, roleFilter, statusFilter]);

  const fetchAuxiliaryData = async () => {
    try {
      const [uRes, dRes] = await Promise.all([
        fetch("/api/v1/users?limit=100"),
        fetch("/api/v1/dealerships?limit=100"),
      ]);
      const [uJson, dJson] = await Promise.all([uRes.json(), dRes.json()]);
      if (uJson.success) setUsers(uJson.data || []);
      if (dJson.success) setDealerships(dJson.data || []);
    } catch {
      // ignore
    }
  };

  const fetchMemberships = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (dealershipFilter !== "all") params.append("dealershipId", dealershipFilter);
      if (roleFilter !== "all") params.append("role", roleFilter);
      if (statusFilter !== "all") params.append("status", statusFilter);

      const res = await fetch(`/api/v1/dealership-memberships?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load staff memberships");
      }
      setMemberships(json.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error fetching memberships");
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setIsEditing(false);
    setSelectedId(null);
    setSelectedUserId(users[0]?._id || "");
    setSelectedDealershipId(dealerships[0]?._id || "");
    setRole("sales_rep");
    setIsPrimary(false);
    setStatus("active");
    setEmployeeId("");
    setDesignation("");
    setDepartment("");
    setModalOpen(true);
  };

  const openEditModal = (m: DealershipMembershipItem) => {
    setIsEditing(true);
    setSelectedId(m._id);
    const uId = typeof m.userId === "object" && m.userId ? m.userId._id : (m.userId as string);
    const dId =
      typeof m.dealershipId === "object" && m.dealershipId
        ? m.dealershipId._id
        : (m.dealershipId as string);
    setSelectedUserId(uId);
    setSelectedDealershipId(dId);
    setRole(m.role);
    setIsPrimary(m.isPrimary);
    setStatus(m.status);
    setEmployeeId(m.employeeId || "");
    setDesignation(m.designation || "");
    setDepartment(m.department || "");
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const payload = isEditing
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
          };

      const url = isEditing
        ? `/api/v1/dealership-memberships/${selectedId}`
        : "/api/v1/dealership-memberships";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || `Failed to ${isEditing ? "update" : "assign"} membership`);
      }

      setSuccess(`Dealership staff allocation ${isEditing ? "updated" : "assigned"} successfully`);
      setModalOpen(false);
      fetchMemberships();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error saving dealership membership");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this staff member's dealership allocation?")) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      const res = await fetch(`/api/v1/dealership-memberships/${id}`, {
        method: "DELETE",
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to revoke membership");
      }

      setSuccess("Membership revoked successfully");
      fetchMemberships();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error revoking membership");
    }
  };

  // Client side search filter over joined user / dealership names
  const filteredMemberships = memberships.filter((m) => {
    if (!search) return true;
    const s = search.toLowerCase();
    const uName = typeof m.userId === "object" && m.userId ? m.userId.name : "";
    const uEmail = typeof m.userId === "object" && m.userId ? m.userId.email : "";
    const dName = typeof m.dealershipId === "object" && m.dealershipId ? m.dealershipId.name : "";
    const empId = m.employeeId || "";
    return (
      uName.toLowerCase().includes(s) ||
      uEmail.toLowerCase().includes(s) ||
      dName.toLowerCase().includes(s) ||
      empId.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Network className="h-7 w-7 text-primary" />
            Dealership Staff & Memberships
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Multi-dealership staff assignments, role-based branch security, and primary dealership allocations.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 focus:outline-none"
        >
          <Plus className="h-4 w-4" />
          Assign Staff to Dealership
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search staff, email, employee ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-4 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <select
            value={dealershipFilter}
            onChange={(e) => setDealershipFilter(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <option value="all">All Dealerships</option>
            {dealerships.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <option value="all">All Roles</option>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Table */}
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
            ) : filteredMemberships.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                  No dealership staff memberships found.
                </td>
              </tr>
            ) : (
              filteredMemberships.map((m) => {
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
                          onClick={() => openEditModal(m)}
                          className="rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          title="Edit Staff Assignment"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(m._id)}
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

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {isEditing ? "Edit Dealership Staff Assignment" : "Assign Staff to Dealership"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-4">
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
                  onClick={() => setModalOpen(false)}
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
      )}
    </div>
  );
}
