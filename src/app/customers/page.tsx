"use client";

import React, { useState, useMemo } from "react";
import { Plus, Users, Building2, Phone, MapPin } from "lucide-react";
import {
  PageHeader,
  DataTable,
  ColumnDef,
  StatusBadge,
  SearchInput,
  Modal,
  FormField,
  Input,
  Select,
  CurrencyDisplay,
  Pagination,
} from "@/components/shared";
import { useDataQuery } from "@/hooks/useDataQuery";

interface CustomerItem {
  _id: string;
  customerCode: string;
  shopName: string;
  name: string;
  phone: string;
  email?: string;
  district?: string;
  area?: string;
  customerType: string;
  creditLimit: number;
  openingBalance: number;
  currentReceivable: number;
  status: string;
}

const DISTRICT_OPTIONS = [
  { value: "", label: "All Districts" },
  { value: "Dhaka", label: "Dhaka" },
  { value: "Chittagong", label: "Chittagong" },
  { value: "Sylhet", label: "Sylhet" },
  { value: "Rajshahi", label: "Rajshahi" },
  { value: "Khulna", label: "Khulna" },
  { value: "Barisal", label: "Barisal" },
  { value: "Rangpur", label: "Rangpur" },
  { value: "Mymensingh", label: "Mymensingh" },
];

const TYPE_OPTIONS = [
  { value: "retailer", label: "Retailer" },
  { value: "wholesaler", label: "Wholesaler" },
  { value: "distributor", label: "Distributor" },
];

/**
 * CustomersPage - Refactored according to SOLID principles using Reusable Components
 */
export default function CustomersPage() {
  const [districtFilter, setDistrictFilter] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    shopName: "",
    name: "",
    phone: "",
    district: "Dhaka",
    customerType: "retailer",
    creditLimit: "50000",
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Reusable Query Hook (Single Responsibility for data state)
  const {
    data: customers,
    loading,
    page,
    totalPages,
    total,
    setPage,
    setParams,
    refetch,
  } = useDataQuery<CustomerItem>({
    url: "/api/v1/customers",
    initialParams: { district: districtFilter },
  });

  const handleSearch = (searchVal: string) => {
    setPage(1);
    setParams((prev) => ({ ...prev, search: searchVal }));
  };

  const handleDistrictChange = (district: string) => {
    setDistrictFilter(district);
    setPage(1);
    setParams((prev) => ({ ...prev, district }));
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    try {
      const res = await fetch("/api/v1/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          creditLimit: parseFloat(formData.creditLimit) || 0,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to create retailer");
      }

      setShowCreateModal(false);
      setFormData({
        shopName: "",
        name: "",
        phone: "",
        district: "Dhaka",
        customerType: "retailer",
        creditLimit: "50000",
      });
      await refetch();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Error creating customer");
    } finally {
      setSaving(false);
    }
  };

  // Open/Closed: Column definitions declaratively configured
  const columns: ColumnDef<CustomerItem>[] = useMemo(
    () => [
      {
        header: "Shop Name & Code",
        cell: (c) => (
          <div>
            <div className="font-semibold text-slate-900">{c.shopName}</div>
            <div className="text-[10px] text-slate-400 font-mono tracking-wider">
              {c.customerCode}
            </div>
          </div>
        ),
      },
      {
        header: "Owner / Contact",
        accessorKey: "name",
      },
      {
        header: "Phone Number",
        cell: (c) => <span className="font-mono text-slate-600">{c.phone}</span>,
      },
      {
        header: "District",
        cell: (c) => (
          <span className="inline-flex items-center gap-1 text-slate-600">
            <MapPin className="h-3 w-3 text-slate-400" />
            {c.district || "Dhaka"}
          </span>
        ),
      },
      {
        header: "Type",
        cell: (c) => (
          <span className="uppercase text-[10px] font-semibold tracking-wider text-slate-500">
            {c.customerType}
          </span>
        ),
      },
      {
        header: "Credit Limit",
        align: "right",
        cell: (c) => <CurrencyDisplay amount={c.creditLimit} />,
      },
      {
        header: "Current Receivable",
        align: "right",
        cell: (c) => <CurrencyDisplay amount={c.currentReceivable} colorScheme="receivable" />,
      },
      {
        header: "Status",
        align: "center",
        cell: (c) => <StatusBadge status={c.status} />,
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      {/* Reusable Page Header */}
      <PageHeader
        title="Customers & Retailer Network"
        description="Retailer registry, credit limits, and receivables ledger"
        actions={
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-sky-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add New Retailer</span>
          </button>
        }
      />

      {/* Filter Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <SearchInput
          placeholder="Search by shop name, owner, phone, code..."
          onChange={handleSearch}
          className="flex-1 max-w-sm"
        />

        <div className="flex items-center gap-2">
          <Select
            options={DISTRICT_OPTIONS}
            value={districtFilter}
            onChange={(e) => handleDistrictChange(e.target.value)}
            className="w-40"
          />
        </div>
      </div>

      {/* Generic Reusable DataTable */}
      <DataTable
        columns={columns}
        data={customers}
        loading={loading}
        emptyMessage="No retailers found. Click 'Add New Retailer' to register one."
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
        title="Register New Retailer Shop"
        description="Enter customer shop details, credit limit, and territory information."
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
              form="create-customer-form"
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-sky-600 transition-colors disabled:opacity-50"
            >
              {saving ? "Registering..." : "Save Retailer"}
            </button>
          </>
        }
      >
        <form id="create-customer-form" onSubmit={handleCreateCustomer} className="space-y-3.5">
          {formError && (
            <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
              {formError}
            </div>
          )}

          <FormField label="Shop Name" required>
            <Input
              name="shopName"
              placeholder="e.g. Al-Madina General Store"
              value={formData.shopName}
              onChange={handleFormChange}
              required
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Owner / Contact Person" required>
              <Input
                name="name"
                placeholder="e.g. Mohammad Rahim"
                value={formData.name}
                onChange={handleFormChange}
                required
              />
            </FormField>

            <FormField label="Phone Number" required>
              <Input
                name="phone"
                placeholder="e.g. 01711000000"
                value={formData.phone}
                onChange={handleFormChange}
                required
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Territory / District">
              <Select
                name="district"
                value={formData.district}
                onChange={handleFormChange}
                options={DISTRICT_OPTIONS.filter((d) => d.value !== "")}
              />
            </FormField>

            <FormField label="Customer Type">
              <Select
                name="customerType"
                value={formData.customerType}
                onChange={handleFormChange}
                options={TYPE_OPTIONS}
              />
            </FormField>
          </div>

          <FormField
            label="Credit Limit (৳ BDT)"
            helperText="Maximum allowed outstanding credit balance before orders require manual approval."
          >
            <Input
              type="number"
              name="creditLimit"
              value={formData.creditLimit}
              onChange={handleFormChange}
              min="0"
              step="1000"
            />
          </FormField>
        </form>
      </Modal>
    </div>
  );
}
