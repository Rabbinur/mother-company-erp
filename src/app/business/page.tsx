"use client";

import React, { useState, useEffect } from "react";
import { Building, AlertCircle, CheckCircle2 } from "lucide-react";
import { LegalEntityGateBanner } from "@/components/business/LegalEntityGateBanner";
import { BusinessProfileForm, type BusinessFormData } from "@/components/business/BusinessProfileForm";

interface BusinessProfile {
  _id: string;
  name: string;
  code: string;
  legalName?: string;
  currency: string;
  timezone: string;
  status: "active" | "inactive" | "suspended";
  email?: string;
  phone?: string;
  website?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}

export default function BusinessSettingsPage() {
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchBusiness();
  }, []);

  const fetchBusiness = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/v1/business");
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load business profile");
      }
      setBusiness(json.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error fetching business details");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (formData: BusinessFormData) => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const res = await fetch("/api/v1/business", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to update business profile");
      }

      setBusiness(json.data);
      setSuccess("Business profile updated successfully");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error updating business details");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Building className="h-7 w-7 text-primary" />
            Business Organization & Settings
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Mother Company distribution enterprise root settings and parameters.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              business?.status === "active"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
            }`}
          >
            Status: {business?.status?.toUpperCase()}
          </span>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Code: {business?.code}
          </span>
        </div>
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

      {/* Legal Entity Gate 1 Banner */}
      <LegalEntityGateBanner legalName={business?.legalName} />

      {/* Profile Form */}
      {business && (
        <BusinessProfileForm
          initialData={business}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
}
