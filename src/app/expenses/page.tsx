"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Plus, Receipt, CheckCircle, Tag } from "lucide-react";
import {
  PageHeader,
  DataTable,
  ColumnDef,
  StatusBadge,
  Modal,
  FormField,
  Input,
  Select,
  Textarea,
  CurrencyDisplay,
  Pagination,
} from "@/components/shared";
import { formatShortDate } from "@/lib/utils";
import { useDataQuery } from "@/hooks/useDataQuery";

interface ExpenseItem {
  _id: string;
  expenseNumber: string;
  date: string;
  categoryName?: string;
  amount: number;
  payee?: string;
  description: string;
  status: string;
}

interface OptionItem {
  _id: string;
  name?: string;
  accountName?: string;
  type?: string;
}

/**
 * ExpensesPage - Refactored with Reusable Components adhering to SOLID
 */
export default function ExpensesPage() {
  const [categories, setCategories] = useState<OptionItem[]>([]);
  const [accounts, setAccounts] = useState<OptionItem[]>([]);
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    categoryId: "",
    accountId: "",
    amount: "",
    payee: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const {
    data: expenses,
    loading,
    page,
    totalPages,
    total,
    setPage,
    refetch,
  } = useDataQuery<ExpenseItem>({
    url: "/api/v1/expenses",
  });

  useEffect(() => {
    fetchOptions();
  }, []);

  const fetchOptions = async () => {
    try {
      const [catRes, accRes] = await Promise.all([
        fetch("/api/v1/expenses/categories").then((r) => r.json()),
        fetch("/api/v1/accounts").then((r) => r.json()),
      ]);

      if (catRes.success && catRes.data?.length > 0) {
        setCategories(catRes.data);
        setFormData((prev) => ({ ...prev, categoryId: catRes.data[0]._id }));
      }

      if (accRes.success && accRes.data?.length > 0) {
        const liquid = accRes.data.filter(
          (a: { type: string }) => a.type === "asset" || a.type === "bank" || a.type === "cash"
        );
        setAccounts(liquid.length > 0 ? liquid : accRes.data);
        if (liquid.length > 0) {
          setFormData((prev) => ({ ...prev, accountId: liquid[0]._id }));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");

    try {
      const res = await fetch("/api/v1/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount) || 0,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to log expense");
      }

      setShowModal(false);
      setFormData((prev) => ({
        ...prev,
        amount: "",
        payee: "",
        description: "",
      }));
      await refetch();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Error logging expense");
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnDef<ExpenseItem>[] = useMemo(
    () => [
      {
        header: "Voucher #",
        cell: (e) => (
          <div>
            <div className="font-semibold text-slate-900">{e.expenseNumber}</div>
            <div className="text-[10px] text-slate-400">{formatShortDate(e.date)}</div>
          </div>
        ),
      },
      {
        header: "Category",
        cell: (e) => (
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
            <Tag className="h-3 w-3 text-slate-400" />
            {e.categoryName || "General Expense"}
          </span>
        ),
      },
      {
        header: "Payee / Beneficiary",
        cell: (e) => <span className="text-slate-600">{e.payee || "—"}</span>,
      },
      {
        header: "Description / Purpose",
        accessorKey: "description",
      },
      {
        header: "Amount (৳)",
        align: "right",
        cell: (e) => <CurrencyDisplay amount={e.amount} />,
      },
      {
        header: "Status",
        align: "center",
        cell: (e) => <StatusBadge status={e.status} />,
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operating Expenses Ledger"
        description="Record and track operational overheads, utility bills, and vendor disbursements"
        actions={
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-sky-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Record Expense</span>
          </button>
        }
      />

      <DataTable
        columns={columns}
        data={expenses}
        loading={loading}
        emptyMessage="No expense records logged yet. Click 'Record Expense' to add one."
      />

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
      />

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Record Operating Expense"
        description="Book operational disbursements against the appropriate Chart of Accounts."
        size="md"
        loading={saving}
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="expense-form"
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-sky-600 transition-colors disabled:opacity-50"
            >
              {saving ? "Posting..." : "Post Expense Voucher"}
            </button>
          </>
        }
      >
        <form id="expense-form" onSubmit={handleCreateExpense} className="space-y-3.5">
          {formError && (
            <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Expense Category" required>
              <Select
                name="categoryId"
                value={formData.categoryId}
                onChange={handleFormChange}
                required
              >
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Disbursement Account (Cash/Bank)" required>
              <Select
                name="accountId"
                value={formData.accountId}
                onChange={handleFormChange}
                required
              >
                {accounts.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.accountName}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Disbursed Amount (৳ BDT)" required>
              <Input
                type="number"
                name="amount"
                placeholder="0.00"
                value={formData.amount}
                onChange={handleFormChange}
                min="1"
                step="0.01"
                required
              />
            </FormField>

            <FormField label="Payee / Recipient">
              <Input
                name="payee"
                placeholder="e.g. Dhaka Power Distribution (DPDC)"
                value={formData.payee}
                onChange={handleFormChange}
              />
            </FormField>
          </div>

          <FormField label="Description / Voucher Remarks" required>
            <Textarea
              name="description"
              rows={3}
              placeholder="e.g. Head office electricity bill for the month of October"
              value={formData.description}
              onChange={handleFormChange}
              required
            />
          </FormField>
        </form>
      </Modal>
    </div>
  );
}
