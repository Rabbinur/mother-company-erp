"use client";

import React, { useState, useEffect } from "react";
import {
  Warehouse as WarehouseIcon,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Layers,
  Store,
  X,
} from "lucide-react";
import { formatShortDate } from "@/lib/utils";

interface WarehouseItem {
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

interface DealershipOption {
  _id: string;
  name: string;
  code: string;
}

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [dealerships, setDealerships] = useState<DealershipOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
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
  const [isCentral, setIsCentral] = useState(false);
  const [selectedDealershipIds, setSelectedDealershipIds] = useState<string[]>([]);
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  useEffect(() => {
    fetchDealershipOptions();
  }, []);

  useEffect(() => {
    fetchWarehouses();
  }, [search, statusFilter, typeFilter]);

  const fetchDealershipOptions = async () => {
    try {
      const res = await fetch("/api/v1/dealerships?limit=100");
      const json = await res.json();
      if (json.success) {
        setDealerships(json.data || []);
      }
    } catch {
      // ignore
    }
  };

  const fetchWarehouses = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (typeFilter === "central") params.append("isCentral", "true");
      if (typeFilter === "dealership") params.append("isCentral", "false");

      const res = await fetch(`/api/v1/warehouses?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load warehouses");
      }
      setWarehouses(json.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error fetching warehouses");
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setIsEditing(false);
    setSelectedId(null);
    setName("");
    setCode("");
    setIsCentral(false);
    setSelectedDealershipIds([]);
    setStatus("active");
    setContactPerson("");
    setPhone("");
    setEmail("");
    setStreet("");
    setCity("");
    setState("");
    setModalOpen(true);
  };

  const openEditModal = (w: WarehouseItem) => {
    setIsEditing(true);
    setSelectedId(w._id);
    setName(w.name);
    setCode(w.code);
    setIsCentral(w.isCentral);
    const dIds = (w.dealershipIds || []).map((d) =>
      typeof d === "object" && d ? d._id : (d as string)
    );
    setSelectedDealershipIds(dIds);
    setStatus(w.status);
    setContactPerson(w.contactPerson || "");
    setPhone(w.phone || "");
    setEmail(w.email || "");
    setStreet(w.address?.street || "");
    setCity(w.address?.city || "");
    setState(w.address?.state || "");
    setModalOpen(true);
  };

  const toggleDealershipSelection = (id: string) => {
    setSelectedDealershipIds((prev) =>
      prev.includes(id) ? prev.filter((dId) => dId !== id) : [...prev, id]
    );
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
        isCentral,
        dealershipIds: isCentral ? [] : selectedDealershipIds,
        status,
        contactPerson,
        phone,
        email,
        address: {
          street,
          city,
          state,
          country: "Bangladesh",
        },
      };

      const url = isEditing ? `/api/v1/warehouses/${selectedId}` : "/api/v1/warehouses";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || `Failed to ${isEditing ? "update" : "create"} warehouse`);
      }

      setSuccess(`Warehouse ${isEditing ? "updated" : "created"} successfully`);
      setModalOpen(false);
      fetchWarehouses();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error saving warehouse");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, warehouseName: string) => {
    if (!confirm(`Are you sure you want to deactivate warehouse "${warehouseName}"?`)) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      const res = await fetch(`/api/v1/warehouses/${id}`, {
        method: "DELETE",
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to delete warehouse");
      }

      setSuccess("Warehouse removed successfully");
      fetchWarehouses();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error deleting warehouse");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <WarehouseIcon className="h-7 w-7 text-primary" />
            Warehouses & Stock Storage
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Central distribution hubs and physical storage locations serving one or multiple dealerships.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 focus:outline-none"
        >
          <Plus className="h-4 w-4" />
          Add Warehouse
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
            placeholder="Search warehouse by name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-4 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <option value="all">All Storage Types</option>
            <option value="central">Central Hubs Only</option>
            <option value="dealership">Dealership / Shared Locations</option>
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
                          onClick={() => openEditModal(w)}
                          className="rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          title="Edit Warehouse"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(w._id, w.name)}
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

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {isEditing ? "Edit Warehouse" : "Add Warehouse"}
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
                    Warehouse Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Central Depot 1"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Warehouse Code *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isEditing}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. WH-01"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:disabled:bg-slate-800/50"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-850">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isCentral}
                    onChange={(e) => setIsCentral(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      Central Enterprise Hub
                    </span>
                    <p className="text-xs text-slate-500">
                      When enabled, this physical warehouse can supply stock to all dealerships.
                    </p>
                  </div>
                </label>
              </div>

              {!isCentral && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Assigned Dealerships (Shared Access)
                  </label>
                  <p className="text-xs text-slate-500 mb-2">
                    Select dealerships that have storage inventory allocated in this warehouse:
                  </p>
                  <div className="max-h-36 overflow-y-auto space-y-1 rounded-md border border-slate-200 p-2 dark:border-slate-800">
                    {dealerships.length === 0 ? (
                      <p className="text-xs text-slate-400">No dealerships available</p>
                    ) : (
                      dealerships.map((d) => (
                        <label
                          key={d._id}
                          className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 p-1 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedDealershipIds.includes(d._id)}
                            onChange={() => toggleDealershipSelection(d._id)}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-primary"
                          />
                          <span>{d.name} ({d.code})</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}

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
                    Phone
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    City / Location
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
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
                  {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Warehouse"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
