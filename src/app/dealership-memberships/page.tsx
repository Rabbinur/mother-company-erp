"use client";

import React, { useState, useEffect } from "react";
import { Network, Plus, Search, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  MembershipTable,
  type DealershipMembershipItem,
} from "@/components/dealership-memberships/MembershipTable";
import {
  MembershipModal,
  type MembershipFormData,
  type UserOption,
  type DealershipOption,
  ROLES,
} from "@/components/dealership-memberships/MembershipModal";

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
  const [selectedMembership, setSelectedMembership] = useState<DealershipMembershipItem | null>(null);
  const [saving, setSaving] = useState(false);

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

  const handleOpenCreate = () => {
    setIsEditing(false);
    setSelectedMembership(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (m: DealershipMembershipItem) => {
    setIsEditing(true);
    setSelectedMembership(m);
    setModalOpen(true);
  };

  const handleSave = async (payload: MembershipFormData) => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const url = isEditing && selectedMembership
        ? `/api/v1/dealership-memberships/${selectedMembership._id}`
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

  // Client search filtering
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
          onClick={handleOpenCreate}
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

      {/* Table Component */}
      <MembershipTable
        memberships={filteredMemberships}
        loading={loading}
        onEdit={handleOpenEdit}
        onDelete={handleDelete}
      />

      {/* Modal Component */}
      <MembershipModal
        isOpen={modalOpen}
        isEditing={isEditing}
        initialData={selectedMembership}
        users={users}
        dealerships={dealerships}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
