"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { DealershipItem } from "./DealershipTable";

export interface DealershipFormData {
  name: string;
  code: string;
  principalCompanyId?: string | null;
  status: "active" | "inactive";
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

export interface PrincipalOption {
  _id: string;
  name: string;
  code: string;
}

interface DealershipModalProps {
  isOpen: boolean;
  isEditing: boolean;
  initialData?: DealershipItem | null;
  principals: PrincipalOption[];
  saving: boolean;
  onClose: () => void;
  onSave: (data: DealershipFormData) => Promise<void>;
}

export function DealershipModal({
  isOpen,
  isEditing,
  initialData,
  principals,
  saving,
  onClose,
  onSave,
}: DealershipModalProps) {
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
    if (initialData && isEditing) {
      setName(initialData.name || "");
      setCode(initialData.code || "");
      const pId =
        typeof initialData.principalCompanyId === "object" && initialData.principalCompanyId
          ? initialData.principalCompanyId._id
          : (initialData.principalCompanyId as string) || "";
      setPrincipalCompanyId(pId);
      setStatus(initialData.status || "active");
      setContactPerson(initialData.contactPerson || "");
      setContactPhone(initialData.contactPhone || "");
      setContactEmail(initialData.contactEmail || "");
      setStreet(initialData.address?.street || "");
      setCity(initialData.address?.city || "");
      setState(initialData.address?.state || "");
      setCountry(initialData.address?.country || "Bangladesh");
    } else {
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
    }
  }, [initialData, isEditing, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      name,
      code,
      principalCompanyId: principalCompanyId || null,
      status,
      contactPerson: contactPerson || undefined,
      contactPhone: contactPhone || undefined,
      contactEmail: contactEmail || undefined,
      address: {
        street: street || undefined,
        city: city || undefined,
        state: state || undefined,
        country: country || undefined,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {isEditing ? "Edit Dealership" : "Add Dealership"}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
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
              {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Dealership"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
