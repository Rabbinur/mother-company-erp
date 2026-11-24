"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { WarehouseItem } from "./WarehouseTable";

export interface WarehouseFormData {
  name: string;
  code: string;
  isCentral: boolean;
  dealershipIds: string[];
  status: "active" | "inactive";
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

export interface DealershipOption {
  _id: string;
  name: string;
  code: string;
}

interface WarehouseModalProps {
  isOpen: boolean;
  isEditing: boolean;
  initialData?: WarehouseItem | null;
  dealerships: DealershipOption[];
  saving: boolean;
  onClose: () => void;
  onSave: (data: WarehouseFormData) => Promise<void>;
}

export function WarehouseModal({
  isOpen,
  isEditing,
  initialData,
  dealerships,
  saving,
  onClose,
  onSave,
}: WarehouseModalProps) {
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
    if (initialData && isEditing) {
      setName(initialData.name || "");
      setCode(initialData.code || "");
      setIsCentral(initialData.isCentral || false);
      const dIds = (initialData.dealershipIds || []).map((d) =>
        typeof d === "object" && d ? d._id : (d as string)
      );
      setSelectedDealershipIds(dIds);
      setStatus(initialData.status || "active");
      setContactPerson(initialData.contactPerson || "");
      setPhone(initialData.phone || "");
      setEmail(initialData.email || "");
      setStreet(initialData.address?.street || "");
      setCity(initialData.address?.city || "");
      setState(initialData.address?.state || "");
    } else {
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
    }
  }, [initialData, isEditing, isOpen]);

  if (!isOpen) return null;

  const toggleDealershipSelection = (id: string) => {
    setSelectedDealershipIds((prev) =>
      prev.includes(id) ? prev.filter((dId) => dId !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      name,
      code,
      isCentral,
      dealershipIds: isCentral ? [] : selectedDealershipIds,
      status,
      contactPerson: contactPerson || undefined,
      phone: phone || undefined,
      email: email || undefined,
      address: {
        street: street || undefined,
        city: city || undefined,
        state: state || undefined,
        country: "Bangladesh",
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {isEditing ? "Edit Warehouse" : "Add Warehouse"}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
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
              {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Warehouse"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
