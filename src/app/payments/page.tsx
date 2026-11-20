"use client";

import React, { useState, useEffect } from "react";
import {
  CreditCard,
  Plus,
  Search,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  X,
  Building2,
  Users,
} from "lucide-react";
import { formatCurrency, formatShortDate } from "@/lib/utils";

export default function PaymentsPage() {
  const [tab, setTab] = useState<"customer" | "vendor">("customer");
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [transactionRef, setTransactionRef] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchPayments();
    fetchAccounts();
    fetchParties();
  }, [tab]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const endpoint =
        tab === "customer"
          ? "/api/v1/payments/customer"
          : "/api/v1/payments/vendor";
      const res = await fetch(endpoint);
      const json = await res.json();
      if (json.success) setPayments(json.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const res = await fetch("/api/v1/accounts");
      const json = await res.json();
      if (json.success) {
        // Filter liquid asset accounts: cash, bank, mfs
        const liquid = json.data.filter(
          (a: any) =>
            a.type === "asset" &&
            ["cash", "bank", "mfs_bkash", "mfs_nagad", "mfs_rocket"].includes(
              a.subType
            )
        );
        setAccounts(liquid);
        if (liquid.length > 0 && !selectedAccountId) {
          setSelectedAccountId(liquid[0]._id);
        }
      }
    } catch {
      // ignore
    }
  };

  const fetchParties = async () => {
    try {
      const endpoint = tab === "customer" ? "/api/v1/customers" : "/api/v1/vendors";
      const res = await fetch(endpoint);
      const json = await res.json();
      if (json.success) setParties(json.data || []);
    } catch {
      // ignore
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartyId || !selectedAccountId || !amount) {
      setError("Please fill all required fields");
      return;
    }
    setSaving(true);
    setError("");

    try {
      const endpoint =
        tab === "customer"
          ? "/api/v1/payments/customer"
          : "/api/v1/payments/vendor";

      const payload = {
        [tab === "customer" ? "customerId" : "vendorId"]: selectedPartyId,
        accountId: selectedAccountId,
        amount: parseFloat(amount) || 0,
        paymentMethod,
        transactionReference: transactionRef,
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to post payment");
      }

      setShowModal(false);
      setAmount("");
      setTransactionRef("");
      setSelectedPartyId("");
      fetchPayments();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error posting payment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Payments & Cash Receipts
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Double-entry transactions across Cash, Bank, and Mobile Financial Services (bKash/Nagad)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-slate-200 bg-white p-1">
            <button
              onClick={() => setTab("customer")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                tab === "customer"
                  ? "bg-primary text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Customer Receipts
            </button>
            <button
              onClick={() => setTab("vendor")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                tab === "vendor"
                  ? "bg-primary text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Vendor Disbursements
            </button>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-sky-600"
          >
            <Plus className="h-4 w-4" />
            <span>{tab === "customer" ? "Record Receipt" : "Record Disbursement"}</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Payment Ref #</th>
                <th className="px-4 py-3.5">{tab === "customer" ? "Retailer" : "Vendor"}</th>
                <th className="px-4 py-3.5">Deposit / Withdraw Account</th>
                <th className="px-4 py-3.5">Method</th>
                <th className="px-4 py-3.5">Trx Ref</th>
                <th className="px-4 py-3.5">Amount (৳)</th>
                <th className="px-4 py-3.5">Date</th>
                <th className="px-4 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-slate-400">
                    Loading financial transactions...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-slate-400">
                    No payment transactions recorded in this category.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-900">
                      {p.paymentNumber}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-800">
                      {tab === "customer"
                        ? p.customerId?.shopName || "Customer"
                        : p.vendorId?.companyName || "Vendor"}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">{p.accountId?.name}</td>
                    <td className="px-4 py-3.5 uppercase text-[10px] font-bold text-slate-600">
                      {p.paymentMethod}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-slate-500">
                      {p.transactionReference || "-"}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-emerald-600">
                      {formatCurrency(p.amount)}
                    </td>
                    <td className="px-4 py-3.5 text-slate-400 text-[11px]">
                      {formatShortDate(p.date)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-slate-900">
                {tab === "customer" ? "Record Customer Payment" : "Record Vendor Payment"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && (
              <div className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700 border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleRecordPayment} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Select {tab === "customer" ? "Retailer / Shop" : "Supplier / Vendor"}
                </label>
                <select
                  required
                  value={selectedPartyId}
                  onChange={(e) => setSelectedPartyId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs focus:outline-hidden focus:border-primary"
                >
                  <option value="">-- Choose Party --</option>
                  {parties.map((pt) => (
                    <option key={pt._id} value={pt._id}>
                      {tab === "customer"
                        ? `${pt.shopName} (Due: ৳${pt.currentReceivable})`
                        : `${pt.companyName} (Payable: ৳${pt.currentPayable})`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  {tab === "customer" ? "Deposit Into Account" : "Pay From Account"}
                </label>
                <select
                  required
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs focus:outline-hidden focus:border-primary"
                >
                  {accounts.map((acc) => (
                    <option key={acc._id} value={acc._id}>
                      {acc.name} (Balance: ৳{acc.balance})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Amount (৳ BDT)</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="৳ 5,000.00"
                    className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs focus:outline-hidden focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Payment Channel</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs focus:outline-hidden focus:border-primary"
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="bkash">bKash</option>
                    <option value="nagad">Nagad</option>
                    <option value="rocket">Rocket</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Transaction Reference (TrxID / Cheque #)
                </label>
                <input
                  type="text"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  placeholder="e.g. 9J28DA10 or CHQ-4029"
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs focus:outline-hidden focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
                >
                  {saving ? "Posting to Ledger..." : "Post Transaction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
