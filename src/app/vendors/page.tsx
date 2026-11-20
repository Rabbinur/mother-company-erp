"use client";

import React, { useState, useMemo } from "react";
import { Plus, Building2, Phone, Mail, MapPin } from "lucide-react";
import {
  PageHeader,
  DataTable,
  ColumnDef,
  StatusBadge,
  SearchInput,
  Modal,
  FormField,
  Input,
  CurrencyDisplay,
  Pagination,
} from "@/components/shared";
import { useDataQuery } from "@/hooks/useDataQuery";

interface VendorItem {
  _id: string;
  vendorCode?: string;
  name: string;
  companyName: string;
  phone: string;
  email?: string;
  address?: string;
  contactPerson?: string;
  taxVatNumber?: string;
  openingBalance: number;
  currentPayable: number;
  status: string;
}

/**
 * VendorsPage - Refactored according to SOLID principles using Reusable Components
 */
export default function VendorsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    companyName: "",
    name: "",
    phone: "",
    email: "",
    address: "",
    taxVatNumber: "",
    openingBalance: "0",
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Reusable Query Hook
  const {
    data: vendors,
    loading,
    page,
    totalPages,
    total,
    setPage,
    setParams,
    refetch,
  } = useDataQuery<VendorItem>({
    url: "/api/v1/vendors",
  });

  const handleSearch = (searchVal: string) => {
    setPage(1);
    setParams((prev) => ({ ...prev, search: searchVal }));
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    try {
      const res = await fetch("/api/v1/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          openingBalance: parseFloat(formData.openingBalance) || 0,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to create vendor");
      }

      setShowCreateModal(false);
      setFormData({
        companyName: "",
        name: "",
        phone: "",
        email: "",
        address: "",
        taxVatNumber: "",
        openingBalance: "0",
      });
      await refetch();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Error creating vendor");
    } finally {
      setSaving(false);
    }
  };

  // Open/Closed: Columns configured declaratively
  const columns: ColumnDef<VendorItem>[] = useMemo(
    () => [
      {
        header: "Company & Supplier Code",
        cell: (v) => (
          <div>
            <div className="font-semibold text-slate-900">{v.companyName}</div>
            <div className="text-[10px] text-slate-400 font-mono tracking-wider">
              {v.vendorCode || v._id.substring(v._id.length - 8).toUpperCase()}
            </div>
          </div>
        ),
      },
      {
        header: "Contact Person",
        accessorKey: "name",
      },
      {
        header: "Phone Number",
        cell: (v) => <span className="font-mono text-slate-600">{v.phone}</span>,
      },
      {
        header: "Email Address",
        cell: (v) => <span className="text-slate-500">{v.email || "—"}</span>,
      },
      {
        header: "Current Payable (৳)",
        align: "right",
        cell: (v) => <CurrencyDisplay amount={v.currentPayable} colorScheme="payable" />,
      },
      {
        header: "Status",
        align: "center",
        cell: (v) => <StatusBadge status={v.status} />,
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      {/* Reusable Page Header */}
      <PageHeader
        title="Vendor & Supplier Management"
        description="Vendor directory, purchase history, and outstanding payables"
        actions={
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-sky-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add New Vendor</span>
          </button>
        }
      />

      {/* Filter Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <SearchInput
          placeholder="Search vendors by company, contact person, or phone..."
          onChange={handleSearch}
          className="flex-1 max-w-sm"
        />
      </div>

      {/* Generic Reusable DataTable */}
      <DataTable
        columns={columns}
        data={vendors}
        loading={loading}
        emptyMessage="No vendors registered. Click 'Add New Vendor' to create one."
      />

      {/* Reusable Pagination */}
      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
      />

      {/* Reusable Modal Form */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add New Vendor / Supplier"
        description="Record vendor company details, payment contact, and initial opening balance."
        size="md"
        loading={saving}
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-vendor-form"
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-sky-600 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Vendor"}
            </button>
          </>
        }
      >
        <form id="create-vendor-form" onSubmit={handleCreateVendor} className="space-y-3.5">
          {formError && (
            <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
              {formError}
            </div>
          )}

          <FormField label="Company Name" required>
            <Input
              name="companyName"
              placeholder="e.g. Meghna Group of Industries"
              value={formData.companyName}
              onChange={handleFormChange}
              required
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Contact Person Name" required>
              <Input
                name="name"
                placeholder="e.g. Tanvir Ahmed"
                value={formData.name}
                onChange={handleFormChange}
                required
              />
            </FormField>

            <FormField label="Phone Number" required>
              <Input
                name="phone"
                placeholder="e.g. 01811000000"
                value={formData.phone}
                onChange={handleFormChange}
                required
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Email Address">
              <Input
                type="email"
                name="email"
                placeholder="contact@company.com"
                value={formData.email}
                onChange={handleFormChange}
              />
            </FormField>

            <FormField label="BIN / Trade License / Tax #">
              <Input
                name="taxVatNumber"
                placeholder="e.g. 123456789-0001"
                value={formData.taxVatNumber}
                onChange={handleFormChange}
              />
            </FormField>
          </div>

          <FormField label="Physical / Factory Address">
            <Input
              name="address"
              placeholder="e.g. Tejgaon I/A, Dhaka"
              value={formData.address}
              onChange={handleFormChange}
            />
          </FormField>

          <FormField
            label="Opening Balance Payable (৳ BDT)"
            helperText="Initial company liability owed to this supplier prior to system onboarding."
          >
            <Input
              type="number"
              name="openingBalance"
              value={formData.openingBalance}
              onChange={handleFormChange}
              min="0"
              step="100"
            />
          </FormField>
        </form>
      </Modal>
    </div>
  );
}
