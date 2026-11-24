"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Search, CreditCard, DollarSign, ShieldAlert, FileText, CheckCircle2, Clock } from "lucide-react";

export interface SupplierPayableRow {
  _id: string;
  payableNumber: string;
  invoiceNumber: string;
  invoiceDate?: string;
  challanNumber?: string;
  supplierId: any;
  dealershipId?: any;
  principalCompanyId?: any;
  netPayable: number;
  paidAmount: number;
  outstandingBalance: number;
  conditionalCashDiscount?: number;
  status: "UNPAID" | "PARTIALLY_PAID" | "PAID";
  dueDate?: string;
  grnId?: any;
  purchaseOrderId?: any;
}

interface SupplierPayableTableProps {
  payables: SupplierPayableRow[];
  loading?: boolean;
  canViewCost?: boolean;
  onRecordPayment?: (payable: SupplierPayableRow) => void;
}

export function SupplierPayableTable({
  payables,
  loading = false,
  canViewCost = true,
  onRecordPayment,
}: SupplierPayableTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const filtered = payables.filter((p) => {
    const q = searchTerm.toLowerCase();
    const supName =
      typeof p.supplierId === "object"
        ? p.supplierId?.companyName || p.supplierId?.name || ""
        : "";
    const matchesSearch =
      p.payableNumber.toLowerCase().includes(q) ||
      p.invoiceNumber.toLowerCase().includes(q) ||
      (p.challanNumber && p.challanNumber.toLowerCase().includes(q)) ||
      supName.toLowerCase().includes(q);

    const matchesStatus = statusFilter === "ALL" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (st: string) => {
    switch (st) {
      case "UNPAID":
        return "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20";
      case "PARTIALLY_PAID":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
      case "PAID":
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
      default:
        return "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/20";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search invoice #, challan #, or supplier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-zinc-400"
          />
        </div>

        <div className="flex items-center gap-2">
          {["ALL", "UNPAID", "PARTIALLY_PAID", "PAID"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 text-xs rounded-lg font-mono transition-colors ${
                statusFilter === st
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              {st === "ALL" ? "All Bills" : st.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 font-medium font-mono">
                <th className="py-2.5 px-4">Payable # / Invoice</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Supplier</th>
                <th className="py-2.5 px-3 text-right">Net Billed</th>
                <th className="py-2.5 px-3 text-right">Settled</th>
                <th className="py-2.5 px-3 text-right">Outstanding</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-zinc-400">
                    Loading payable records...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                    No supplier payables found.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const supplierName =
                    typeof p.supplierId === "object"
                      ? p.supplierId?.companyName || p.supplierId?.name || "Supplier"
                      : "Supplier";

                  return (
                    <tr
                      key={p._id}
                      className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {p.payableNumber}
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          Inv: {p.invoiceNumber} {p.challanNumber ? `(Ch: ${p.challanNumber})` : ""}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                        {p.invoiceDate ? new Date(p.invoiceDate).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-3 px-3 text-zinc-900 dark:text-zinc-100 font-medium">
                        {supplierName}
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        {canViewCost ? (
                          <span>৳{p.netPayable.toLocaleString("en-BD", { minimumFractionDigits: 2 })}</span>
                        ) : (
                          <span className="text-zinc-400">Restricted</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                        {canViewCost ? (
                          <span>৳{p.paidAmount.toLocaleString("en-BD", { minimumFractionDigits: 2 })}</span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-medium">
                        {canViewCost ? (
                          <span
                            className={
                              p.outstandingBalance > 0
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-zinc-500"
                            }
                          >
                            ৳{p.outstandingBalance.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-zinc-400 text-[11px]">
                            <ShieldAlert className="w-3 h-3" /> Restricted
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${getStatusBadge(
                            p.status
                          )}`}
                        >
                          {p.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {p.status !== "PAID" && onRecordPayment && canViewCost && (
                          <button
                            onClick={() => onRecordPayment(p)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 transition-colors"
                          >
                            <CreditCard className="w-3 h-3" />
                            <span>Pay</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
