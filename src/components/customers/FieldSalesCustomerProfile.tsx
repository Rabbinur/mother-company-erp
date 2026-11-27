"use client";

import React, { useState, useEffect } from "react";
import { Building2, Phone, Receipt, Clock, CheckCircle2, AlertCircle, DollarSign, PlusCircle } from "lucide-react";
import type { SalesmanCustomerDueProfile } from "@/services/customer/SalesmanCustomerDueService";

export function FieldSalesCustomerProfile({ customerId, dealershipId }: { customerId: string; dealershipId: string }) {
  const [profile, setProfile] = useState<SalesmanCustomerDueProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"invoices" | "payments" | "collections">("invoices");

  // Collection modal state
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [collectAmount, setCollectAmount] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [collectNotes, setCollectNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [customerId, dealershipId]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/v1/integrations/field-sales/customers/${customerId}?dealershipId=${dealershipId}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setProfile(data.data);
      } else {
        setError(data.message || "Failed to load customer dues");
      }
    } catch (err: any) {
      setError(err?.message || "Network error loading customer dues");
    } finally {
      setLoading(false);
    }
  };

  const handleRecordCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(collectAmount);
    if (!amount || amount <= 0) return alert("Please enter a valid positive amount");

    try {
      setSubmitting(true);
      const idempotencyKey = `fs-col-${customerId}-${Date.now()}`;
      const res = await fetch("/api/v1/integrations/field-sales/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          dealershipId,
          orderId: selectedOrderId || undefined,
          amount,
          paymentMethod: "cash",
          notes: collectNotes || "Overdue cash collection by salesman",
          idempotencyKey,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert("Physical cash collection recorded! It is now pending manager verification.");
        setShowCollectModal(false);
        setCollectAmount("");
        setCollectNotes("");
        fetchProfile();
      } else {
        alert(data.message || "Failed to record collection");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-sm text-slate-400">Loading customer outstanding dues...</div>;
  if (error || !profile) return <div className="p-8 text-center text-sm text-rose-400">{error || "Customer record not found"}</div>;

  return (
    <div className="space-y-6">
      {/* Header Info Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-100">{profile.customer.shopName}</h2>
            <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-300">{profile.customer.customerCode}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-400">
            <span>Proprietor: {profile.customer.name}</span>
            <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {profile.customer.phone}</span>
            <span>{profile.customer.address}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-xs text-slate-400 block">Outstanding Due ({profile.dealershipDue.dealershipName})</span>
            <span className="text-xl font-bold text-amber-400 font-mono">BDT {profile.dealershipDue.outstandingDue.toLocaleString()}</span>
          </div>
          <button
            onClick={() => setShowCollectModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-lg transition"
          >
            <PlusCircle className="h-4 w-4" /> Record Cash
          </button>
        </div>
      </div>

      {/* Credit & Pending Verification Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <span className="text-slate-400 block">Credit Limit</span>
          <span className="font-mono text-base font-semibold text-slate-200">
            {profile.dealershipDue.creditLimit > 0 ? `BDT ${profile.dealershipDue.creditLimit.toLocaleString()}` : "Not Configured / Restricted"}
          </span>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <span className="text-slate-400 block">Available Credit</span>
          <span className="font-mono text-base font-semibold text-emerald-400">
            {profile.dealershipDue.creditLimit > 0 ? `BDT ${profile.dealershipDue.availableCredit.toLocaleString()}` : "—"}
          </span>
        </div>
        <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-4">
          <span className="text-amber-400 block flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Pending Verification</span>
          <span className="font-mono text-base font-semibold text-amber-300">BDT {profile.pendingCollectionsTotal.toLocaleString()}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 text-sm">
        {[
          { key: "invoices", label: `Unpaid Invoices (${profile.invoiceWiseDues.length})`, icon: Receipt },
          { key: "payments", label: `Payment History (${profile.paymentHistory.length})`, icon: CheckCircle2 },
          { key: "collections", label: `Collections (${profile.collectionHistory.length})`, icon: DollarSign },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 font-medium transition ${
                isActive ? "border-primary text-primary" : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Unpaid Invoices */}
      {activeTab === "invoices" && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2">Invoice #</th>
                <th className="py-2">Date</th>
                <th className="py-2">Due Date</th>
                <th className="py-2 text-right">Invoice Total</th>
                <th className="py-2 text-right">Paid</th>
                <th className="py-2 text-right">Due Amount</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {profile.invoiceWiseDues.length === 0 ? (
                <tr><td colSpan={7} className="py-6 text-center text-slate-500">No overdue or unpaid invoices</td></tr>
              ) : (
                profile.invoiceWiseDues.map((inv) => (
                  <tr key={inv.orderId}>
                    <td className="py-2 font-mono font-medium text-slate-200">{inv.orderNumber}</td>
                    <td className="py-2">{new Date(inv.orderDate).toLocaleDateString()}</td>
                    <td className="py-2">
                      {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}
                      {inv.isOverdue && (
                        <span className="ml-1.5 rounded bg-red-950/60 px-1.5 py-0.5 text-[10px] font-medium text-red-400 border border-red-800/40">
                          Overdue ({inv.overdueDays}d)
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-right font-mono">BDT {inv.orderTotal.toLocaleString()}</td>
                    <td className="py-2 text-right font-mono">BDT {inv.paidAmount.toLocaleString()}</td>
                    <td className="py-2 text-right font-mono font-bold text-amber-400">BDT {inv.dueAmount.toLocaleString()}</td>
                    <td className="py-2 uppercase text-xs">{inv.paymentStatus}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Recent Payment History */}
      {activeTab === "payments" && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
          <div className="text-xs text-slate-400">
            {profile.lastPayment ? `Last payment: BDT ${profile.lastPayment.amount.toLocaleString()} on ${new Date(profile.lastPayment.date).toLocaleDateString()}` : "No payment history recorded"}
          </div>
          <div className="divide-y divide-slate-800/60 text-xs">
            {profile.paymentHistory.map((p) => (
              <div key={p.paymentId} className="flex justify-between py-2 text-slate-300">
                <span className="font-mono">{p.paymentNumber}</span>
                <span className="font-mono text-emerald-400">BDT {p.amount.toLocaleString()} ({p.paymentMethod})</span>
                <span>{new Date(p.date).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Collection History with Pending Indicator */}
      {activeTab === "collections" && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
          <div className="divide-y divide-slate-800/60 text-xs">
            {profile.collectionHistory.map((c) => {
              const isPending = c.status === "pending_verification";
              return (
                <div key={c.collectionId} className="flex justify-between items-center py-2.5">
                  <div>
                    <span className="font-mono font-medium text-slate-200 block">{c.collectionId}</span>
                    <span className="text-slate-400 text-xs">Collected on {new Date(c.collectedAt).toLocaleDateString()} by {c.collectorRole}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-slate-100 block">BDT {c.amount.toLocaleString()} (Cash)</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs uppercase font-medium ${
                      isPending ? "bg-amber-950/60 text-amber-400 border border-amber-800/40" : "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                    }`}>
                      {isPending ? <Clock className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                      {isPending ? "Pending Verification" : "Verified"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Record Cash Collection Modal */}
      {showCollectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-100">Record Physical Cash Collection</h3>
            <p className="text-xs text-slate-400">Note: New cash collections remain pending until verified by a manager or accountant.</p>
            <form onSubmit={handleRecordCollection} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Invoice (Optional)</label>
                <select value={selectedOrderId} onChange={(e) => setSelectedOrderId(e.target.value)} className="w-full rounded border border-slate-700 bg-slate-800 p-2 text-slate-200">
                  <option value="">General Customer Due</option>
                  {profile.invoiceWiseDues.map((inv) => (
                    <option key={inv.orderId} value={inv.orderId}>{inv.orderNumber} — Due: BDT {inv.dueAmount}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Cash Amount (BDT) *</label>
                <input type="number" required min="1" value={collectAmount} onChange={(e) => setCollectAmount(e.target.value)} placeholder="e.g. 5000" className="w-full rounded border border-slate-700 bg-slate-800 p-2 text-slate-200 font-mono" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Notes / Receipt Reference</label>
                <input type="text" value={collectNotes} onChange={(e) => setCollectNotes(e.target.value)} placeholder="Receipt # or follow-up note" className="w-full rounded border border-slate-700 bg-slate-800 p-2 text-slate-200" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCollectModal(false)}
                  className="rounded px-3 py-1.5 text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded bg-emerald-600 hover:bg-emerald-500 px-4 py-1.5 font-semibold text-white"
                >
                  {submitting ? "Submitting..." : "Submit Collection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
