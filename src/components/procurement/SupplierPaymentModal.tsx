"use client";

import React, { useState } from "react";
import { X, CreditCard, AlertCircle, CheckCircle2 } from "lucide-react";
import { SupplierPayableRow } from "./SupplierPayableTable";

interface SupplierPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  payable: SupplierPayableRow | null;
}

export function SupplierPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  payable,
}: SupplierPaymentModalProps) {
  if (!isOpen || !payable) return null;

  const [paymentAmount, setPaymentAmount] = useState(payable.outstandingBalance.toString());
  const [cashDiscount, setCashDiscount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supplierName =
    typeof payable.supplierId === "object"
      ? payable.supplierId?.companyName || payable.supplierId?.name || "Supplier"
      : "Supplier";

  const numPayment = parseFloat(paymentAmount) || 0;
  const numDiscount = parseFloat(cashDiscount) || 0;
  const remainingAfter = Math.max(0, payable.outstandingBalance - numPayment - numDiscount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numPayment <= 0 && numDiscount <= 0) {
      setError("Payment amount or earned discount must be greater than zero.");
      return;
    }
    if (numPayment + numDiscount > payable.outstandingBalance + 0.001) {
      setError(`Total settlement (৳${(numPayment + numDiscount).toFixed(2)}) cannot exceed outstanding balance (৳${payable.outstandingBalance.toFixed(2)}).`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const idempotencyKey = `PAY-${payable._id}-${Date.now()}`;
      const res = await fetch("/api/v1/procurement/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payableId: payable._id,
          amount: numPayment,
          cashDiscountEarned: numDiscount,
          paymentMethod,
          reference: reference.trim() || undefined,
          paymentDate,
          notes: notes.trim() || undefined,
          idempotencyKey,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || json.message || "Failed to record payment");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to submit supplier payment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-zinc-500" />
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
              Record Supplier Payment
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

          {/* Invoice Summary Box */}
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 p-3 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500">Supplier:</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{supplierName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Bill / Invoice:</span>
              <span className="font-mono text-zinc-900 dark:text-zinc-100">{payable.invoiceNumber} ({payable.payableNumber})</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-zinc-200 dark:border-zinc-700 font-mono">
              <span className="text-zinc-500">Outstanding Balance:</span>
              <span className="font-semibold text-rose-600 dark:text-rose-400">
                ৳{payable.outstandingBalance.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Disbursement Amount (৳) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Earned Cash Discount (৳)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={cashDiscount}
                onChange={(e) => setCashDiscount(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-400"
              >
                <option value="bank_transfer">Bank Transfer (BEFTN/RTGS)</option>
                <option value="cheque">Company Cheque</option>
                <option value="cash">Cash Voucher</option>
                <option value="mobile_banking">bKash / Nagad Commercial</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Cheque / Txn Ref #
              </label>
              <input
                type="text"
                placeholder="e.g. CHQ-998811 or TR-4521"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Payment Date
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-400"
              />
            </div>
            <div className="flex flex-col justify-end">
              <div className="text-[11px] text-zinc-500 font-mono">
                Remaining after payment:
              </div>
              <div className="text-sm font-semibold font-mono text-zinc-900 dark:text-zinc-100">
                ৳{remainingAfter.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Payment Memo / Remarks
            </label>
            <input
              type="text"
              placeholder="e.g. Cleared via City Bank A/C ...881"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-zinc-400"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3.5 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 transition-colors disabled:opacity-50"
            >
              {loading ? "Recording..." : "Confirm Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
