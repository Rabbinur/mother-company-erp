"use client";

import React, { useState, useEffect } from "react";
import { X, Building2, AlertCircle } from "lucide-react";
import { SupplierRow } from "./SupplierListTable";

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: SupplierRow | null;
}

export function SupplierModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: SupplierModalProps) {
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("net_30");
  const [customDays, setCustomDays] = useState(30);
  const [status, setStatus] = useState("active");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || "");
      setCompanyName(initialData.companyName || "");
      setCode(initialData.code || "");
      setPhone(initialData.phone || "");
      setEmail(initialData.email || "");
      setPaymentTerms(initialData.paymentTerms || "net_30");
      setCustomDays(initialData.customPaymentTermsDays || 30);
      setStatus(initialData.status || "active");
    } else {
      setName("");
      setCompanyName("");
      setCode("");
      setPhone("");
      setEmail("");
      setPaymentTerms("net_30");
      setCustomDays(30);
      setStatus("active");
    }
    setError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Contact person or supplier name is required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: Record<string, any> = {
        name: name.trim(),
        companyName: companyName.trim() || undefined,
        code: code.trim().toUpperCase() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        paymentTerms,
        customPaymentTermsDays: paymentTerms === "custom" ? Number(customDays) : undefined,
        status,
      };

      const url = initialData?._id
        ? `/api/v1/procurement/suppliers/${initialData._id}`
        : "/api/v1/procurement/suppliers";

      const method = initialData?._id ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || json.message || "Failed to save supplier");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save supplier details");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-zinc-500" />
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
              {initialData ? "Edit Supplier Details" : "Add New Supplier"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2 text-xs text-rose-700 dark:text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Company Name
              </label>
              <input
                type="text"
                placeholder="e.g. Square Consumer Goods Ltd"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Supplier Code
              </label>
              <input
                type="text"
                placeholder="e.g. SUP-SQ-001"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 uppercase focus:outline-hidden focus:ring-1 focus:ring-zinc-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Contact Person *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Md. Rahman Khan"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                placeholder="e.g. 01711000000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                placeholder="supplier@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Payment Terms
              </label>
              <select
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-400"
              >
                <option value="immediate">Immediate (Cash on Delivery)</option>
                <option value="net_7">Net 7 Days</option>
                <option value="net_15">Net 15 Days</option>
                <option value="net_30">Net 30 Days (Standard)</option>
                <option value="net_45">Net 45 Days</option>
                <option value="net_60">Net 60 Days</option>
                <option value="custom">Custom Credit Days</option>
              </select>
            </div>
          </div>

          {paymentTerms === "custom" && (
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Custom Credit Period (Days)
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={customDays}
                onChange={(e) => setCustomDays(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-400"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3.5 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 transition-colors disabled:opacity-50"
            >
              {loading ? "Saving..." : initialData ? "Save Changes" : "Create Supplier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
