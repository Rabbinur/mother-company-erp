"use client";

import React, { useState, useEffect } from "react";
import {
  Store,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Briefcase,
  X,
} from "lucide-react";
import { formatShortDate } from "@/lib/utils";

interface Dealership {
  _id: string;
  businessId: string;
  principalCompanyId?: { _id: string; name: string; code: string } | string;
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

interface PrincipalOption {
  _id: string;
  name: string;
  code: string;
}

export default function DealershipsPage() {
  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [principals, setPrincipals] = useState<PrincipalOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [principalFilter, setPrincipalFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [principalCompanyId, setPrincipalCompanyId] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [contactPerson, setContactPerson] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("Bangladesh");

  useEffect(() => {
    fetchPrincipals();
  }, []);

  useEffect(() => {
    fetchDealerships();
  }, [search, statusFilter, principalFilter]);

  const fetchPrincipals = async () => {
    try {
      const res = await fetch("/api/v1/principal-companies?limit=100");
      const json = await res.json();
      if (json.success) {
        setPrincipals(json.data || []);
      }
    } catch {
      // ignore
    }
  };

  const fetchDealerships = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (principalFilter !== "all") params.append("principalCompanyId", principalFilter);

      const res = await fetch(`/api/v1/dealerships?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load dealerships");
      }
      setDealerships(json.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error fetching dealerships");
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setIsEditing(false);
    setSelectedId(null);
    setName("");
    setCode("");
    setPrincipalCompanyId("");
    setStatus("active");
    setContactPerson("");
    setContactPhone("");
    setContactEmail("");
    setStreet("");
    setCity("");
    setState("");
    setCountry("Bangladesh");
    setModalOpen(true);
  };

  const openEditModal = (d: Dealership) => {
    setIsEditing(true);
    setSelectedId(d._id);
    setName(d.name);
    setCode(d.code);
    const pId = typeof d.principalCompanyId === "object" && d.principalCompanyId
      ? d.principalCompanyId._id
      : (d.principalCompanyId as string) || "";
    setPrincipalCompanyId(pId);
    setStatus(d.status);
    setContactPerson(d.contactPerson || "");
    setContactPhone(d.contactPhone || "");
    setContactEmail(d.contactEmail || "");
    setStreet(d.address?.street || "");
    setCity(d.address?.city || "");
    setState(d.address?.state || "");
    setCountry(d.address?.country || "Bangladesh");
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const payload = {
        name,
        code,
        principalCompanyId: principalCompanyId || null,
        status,
        contactPerson,
        contactPhone,
        contactEmail,
        address: {
          street,
          city,
          state,
          country,
        },
      };

      const url = isEditing ? `/api/v1/dealerships/${selectedId}` : "/api/v1/dealerships";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || `Failed to ${isEditing ? "update" : "create"} dealership`);
      }

      setSuccess(`Dealership ${isEditing ? "updated" : "created"} successfully`);
      setModalOpen(false);
      fetchDealerships();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error saving dealership");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, dealershipName: string) => {
    if (!confirm(`Are you sure you want to deactivate and remove dealership "${dealershipName}"?`)) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      const res = await fetch(`/api/v1/dealerships/${id}`, {
        method: "DELETE",
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to delete dealership");
      }

      setSuccess("Dealership removed successfully");
      fetchDealerships();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error deleting dealership");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Store className="h-7 w-7 text-primary" />
            Dealership Network Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Multi-dealership retail and distribution outlets operating under the mother company.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 focus:outline-none"
        >
          <Plus className="h-4 w-4" />
          Add Dealership
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
            placeholder="Search dealership name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-4 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <select
            value={principalFilter}
            onChange={(e) => setPrincipalFilter(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <option value="all">All Principals</option>
            {principals.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">
                Dealership Name & Code
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">
                Principal Company
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">
                Contact Person & Phone
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
                  <p className="mt-2 text-xs">Loading dealerships...</p>
                </td>
              </tr>
            ) : dealerships.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                  No dealerships found.
                </td>
              </tr>
            ) : (
              dealerships.map((d) => {
                const principalName =
                  typeof d.principalCompanyId === "object" && d.principalCompanyId
                    ? d.principalCompanyId.name
                    : "—";

                return (
                  <tr key={d._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900 dark:text-white">{d.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Code: {d.code}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {principalName !== "—" ? (
                        <span className="inline-flex items-center gap-1.5 rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                          <Briefcase className="h-3 w-3" />
                          {principalName}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Independent</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                      <div>{d.contactPerson || "—"}</div>
                      <div className="text-xs text-slate-400">{d.contactPhone || d.contactEmail || "—"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          d.status === "active"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {d.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                      {formatShortDate(d.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(d)}
                          className="rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          title="Edit Dealership"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(d._id, d.name)}
                          className="rounded p-1 text-red-400 hover:text-red-600"
                          title="Delete Dealership"
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
                {isEditing ? "Edit Dealership" : "Add Dealership"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Dealership Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Uttara Motors"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Dealership Code *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isEditing}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. DLR-001"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:disabled:bg-slate-800/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Principal Company
                  </label>
                  <select
                    value={principalCompanyId}
                    onChange={(e) => setPrincipalCompanyId(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="">None / Independent</option>
                    {principals.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} ({p.code})
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
                    onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    placeholder="City"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Street Address
                  </label>
                  <input
                    type="text"
                    placeholder="Address"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
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
                  {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Dealership"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
