"use client";

import React, { useState, useEffect } from "react";
import { Warehouse as WarehouseIcon, Plus, Search, AlertCircle, CheckCircle2 } from "lucide-react";
import { WarehouseTable, type WarehouseItem } from "@/components/warehouses/WarehouseTable";
import {
  WarehouseModal,
  type WarehouseFormData,
  type DealershipOption,
} from "@/components/warehouses/WarehouseModal";

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
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseItem | null>(null);
  const [saving, setSaving] = useState(false);

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

  const handleOpenCreate = () => {
    setIsEditing(false);
    setSelectedWarehouse(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (warehouse: WarehouseItem) => {
    setIsEditing(true);
    setSelectedWarehouse(warehouse);
    setModalOpen(true);
  };

  const handleSave = async (payload: WarehouseFormData) => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const url = isEditing && selectedWarehouse
        ? `/api/v1/warehouses/${selectedWarehouse._id}`
        : "/api/v1/warehouses";
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
          onClick={handleOpenCreate}
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

      {/* Table Component */}
      <WarehouseTable
        warehouses={warehouses}
        loading={loading}
        onEdit={handleOpenEdit}
        onDelete={handleDelete}
      />

      {/* Modal Component */}
      <WarehouseModal
        isOpen={modalOpen}
        isEditing={isEditing}
        initialData={selectedWarehouse}
        dealerships={dealerships}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
