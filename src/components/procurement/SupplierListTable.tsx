"use client";

import React, { useState } from "react";
import { Search, Building2, Phone, Mail, ArrowRight, ShieldAlert } from "lucide-react";

export interface SupplierRow {
  _id: string;
  code?: string;
  name: string;
  companyName?: string;
  phone?: string;
  email?: string;
  paymentTerms?: string;
  customPaymentTermsDays?: number;
  currentPayable?: number;
  status: string;
}

interface SupplierListTableProps {
  suppliers: SupplierRow[];
  loading?: boolean;
  canViewCost?: boolean;
  onEditSupplier?: (supplier: SupplierRow) => void;
  onSelectSupplier?: (supplier: SupplierRow) => void;
}

export function SupplierListTable({
  suppliers,
  loading = false,
  canViewCost = true,
  onEditSupplier,
  onSelectSupplier,
}: SupplierListTableProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = suppliers.filter((s) => {
    const q = searchTerm.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.companyName && s.companyName.toLowerCase().includes(q)) ||
      (s.code && s.code.toLowerCase().includes(q)) ||
      (s.phone && s.phone.includes(q))
    );
  });

  const getPaymentTermsLabel = (terms?: string, customDays?: number) => {
    switch (terms) {
      case "immediate":
        return "Immediate (Cash)";
      case "net_7":
        return "Net 7 Days";
      case "net_15":
        return "Net 15 Days";
      case "net_30":
        return "Net 30 Days";
      case "net_45":
        return "Net 45 Days";
      case "net_60":
        return "Net 60 Days";
      case "custom":
        return `Net ${customDays || 0} Days`;
      default:
        return terms || "Not specified";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search suppliers by name, company, code, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-500"
          />
        </div>
        <div className="text-xs text-zinc-500 font-mono">
          Showing {filtered.length} of {suppliers.length} suppliers
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 font-medium font-mono">
                <th className="py-2.5 px-4">Supplier / Company</th>
                <th className="py-2.5 px-3">Code</th>
                <th className="py-2.5 px-3">Contact</th>
                <th className="py-2.5 px-3">Payment Terms</th>
                <th className="py-2.5 px-3 text-right">Outstanding Payable</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-400">
                    Loading suppliers...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                    No suppliers match your search criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr
                    key={s._id}
                    className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span>{s.companyName || s.name}</span>
                      </div>
                      {s.companyName && s.name && (
                        <div className="text-[11px] text-zinc-500 pl-5">{s.name}</div>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                      {s.code || "—"}
                    </td>
                    <td className="py-3 px-3 text-zinc-600 dark:text-zinc-300">
                      {s.phone && (
                        <div className="flex items-center gap-1 font-mono text-[11px]">
                          <Phone className="w-3 h-3 text-zinc-400" />
                          <span>{s.phone}</span>
                        </div>
                      )}
                      {s.email && (
                        <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                          <Mail className="w-3 h-3 text-zinc-400" />
                          <span className="truncate max-w-[140px]">{s.email}</span>
                        </div>
                      )}
                      {!s.phone && !s.email && <span className="text-zinc-400">—</span>}
                    </td>
                    <td className="py-3 px-3 text-zinc-700 dark:text-zinc-300">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                        {getPaymentTermsLabel(s.paymentTerms, s.customPaymentTermsDays)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-medium">
                      {canViewCost ? (
                        <span
                          className={
                            (s.currentPayable || 0) > 0
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-zinc-600 dark:text-zinc-400"
                          }
                        >
                          ৳{(s.currentPayable || 0).toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-zinc-400 text-[11px]">
                          <ShieldAlert className="w-3 h-3" /> Restricted
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                          s.status === "active"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                            : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20"
                        }`}
                      >
                        {s.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {onEditSupplier && (
                          <button
                            onClick={() => onEditSupplier(s)}
                            className="px-2 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                          >
                            Edit
                          </button>
                        )}
                        {onSelectSupplier && (
                          <button
                            onClick={() => onSelectSupplier(s)}
                            className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
