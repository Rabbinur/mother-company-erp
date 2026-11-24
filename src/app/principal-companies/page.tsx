"use client";

import React, { useState, useEffect } from "react";
import { Briefcase, Plus, Search, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  PrincipalCompanyTable,
  type PrincipalCompany,
} from "@/components/principal-companies/PrincipalCompanyTable";
import {
  PrincipalCompanyModal,
  type PrincipalCompanyFormData,
} from "@/components/principal-companies/PrincipalCompanyModal";

export default function PrincipalCompaniesPage() {
  const [companies, setCompanies] = useState<PrincipalCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<PrincipalCompany | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCompanies();
  }, [search, statusFilter]);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter !== "all") params.append("status", statusFilter);

      const res = await fetch(`/api/v1/principal-companies?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to fetch principal companies");
      }
      setCompanies(json.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error fetching principal companies");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setIsEditing(false);
    setSelectedCompany(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (company: PrincipalCompany) => {
    setIsEditing(true);
    setSelectedCompany(company);
    setModalOpen(true);
  };

  const handleSave = async (data: PrincipalCompanyFormData) => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const url = isEditing && selectedCompany
        ? `/api/v1/principal-companies/${selectedCompany._id}`
        : "/api/v1/principal-companies";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || `Failed to ${isEditing ? "update" : "create"} company`);
      }

      setSuccess(`Principal company ${isEditing ? "updated" : "created"} successfully`);
      setModalOpen(false);
      fetchCompanies();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error saving principal company");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, companyName: string) => {
    if (!confirm(`Are you sure you want to deactivate principal company "${companyName}"?`)) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      const res = await fetch(`/api/v1/principal-companies/${id}`, {
        method: "DELETE",
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to delete company");
      }

      setSuccess("Principal company removed successfully");
      fetchCompanies();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error deleting principal company");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Briefcase className="h-7 w-7 text-primary" />
            Principal Companies
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Parent manufacturing brands and supplier principals represented across dealerships.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 focus:outline-none"
        >
          <Plus className="h-4 w-4" />
          Add Principal Company
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
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-4 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
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
      <PrincipalCompanyTable
        companies={companies}
        loading={loading}
        onEdit={handleOpenEdit}
        onDelete={handleDelete}
      />

      {/* Modal Component */}
      <PrincipalCompanyModal
        isOpen={modalOpen}
        isEditing={isEditing}
        initialData={selectedCompany}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
