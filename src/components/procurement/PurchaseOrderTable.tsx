"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Search, FileText, CheckCircle2, Clock, XCircle, ShieldAlert, ArrowRight, Eye } from "lucide-react";

export interface PurchaseOrderItem {
  productId: string;
  variantId?: string;
  name: string;
  quantity: number;
  remainingQuantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PurchaseOrderRow {
  _id: string;
  orderNumber: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  supplierId: any;
  dealershipId?: any;
  principalCompanyId?: any;
  status: "DRAFT" | "SUBMITTED" | "PARTIALLY_RECEIVED" | "FULLY_RECEIVED" | "CANCELLED";
  items: PurchaseOrderItem[];
  totalAmount: number;
  grnIds?: string[];
  notes?: string;
}

interface PurchaseOrderTableProps {
  orders: PurchaseOrderRow[];
  loading?: boolean;
  canViewCost?: boolean;
  onSubmitOrder?: (id: string) => void;
  onCancelOrder?: (id: string) => void;
}

export function PurchaseOrderTable({
  orders,
  loading = false,
  canViewCost = true,
  onSubmitOrder,
  onCancelOrder,
}: PurchaseOrderTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const filtered = orders.filter((o) => {
    const q = searchTerm.toLowerCase();
    const supplierName = typeof o.supplierId === "object" ? o.supplierId?.companyName || o.supplierId?.name : "";
    const matchesSearch =
      o.orderNumber.toLowerCase().includes(q) ||
      (supplierName && supplierName.toLowerCase().includes(q));

    const matchesStatus = statusFilter === "ALL" || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (st: string) => {
    switch (st) {
      case "DRAFT":
        return "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/20";
      case "SUBMITTED":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";
      case "PARTIALLY_RECEIVED":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
      case "FULLY_RECEIVED":
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
      case "CANCELLED":
        return "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20";
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
            placeholder="Search PO # or supplier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-zinc-400"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          {["ALL", "DRAFT", "SUBMITTED", "PARTIALLY_RECEIVED", "FULLY_RECEIVED", "CANCELLED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 text-xs rounded-lg font-mono transition-colors whitespace-nowrap ${
                statusFilter === st
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              {st === "ALL" ? "All Statuses" : st.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 font-medium font-mono">
                <th className="py-2.5 px-4">PO Number</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Supplier</th>
                <th className="py-2.5 px-3 text-center">Fulfillment</th>
                <th className="py-2.5 px-3 text-right">Order Value</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-400">
                    Loading purchase orders...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                    No purchase orders match your criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((po) => {
                  const supplierName =
                    typeof po.supplierId === "object"
                      ? po.supplierId?.companyName || po.supplierId?.name || "Supplier"
                      : "Supplier";

                  const totalOrdered = po.items.reduce((s, it) => s + (it.quantity || 0), 0);
                  const totalRemaining = po.items.reduce((s, it) => s + (it.remainingQuantity || 0), 0);
                  const receivedQty = Math.max(0, totalOrdered - totalRemaining);
                  const progressPct = totalOrdered > 0 ? Math.round((receivedQty / totalOrdered) * 100) : 0;

                  return (
                    <tr
                      key={po._id}
                      className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-medium text-zinc-900 dark:text-zinc-100">
                        <Link
                          href={`/procurement/orders/${po._id}`}
                          className="hover:underline flex items-center gap-1.5"
                        >
                          <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span>{po.orderNumber}</span>
                        </Link>
                      </td>
                      <td className="py-3 px-3 font-mono text-zinc-600 dark:text-zinc-400 text-[11px]">
                        {new Date(po.orderDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 text-zinc-900 dark:text-zinc-100 font-medium">
                        {supplierName}
                      </td>
                      <td className="py-3 px-3">
                        <div className="w-28 mx-auto space-y-1">
                          <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                            <span>{receivedQty}/{totalOrdered}</span>
                            <span>{progressPct}%</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-medium">
                        {canViewCost ? (
                          <span className="text-zinc-900 dark:text-zinc-100">
                            ৳{po.totalAmount.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
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
                            po.status
                          )}`}
                        >
                          {po.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {po.status === "DRAFT" && onSubmitOrder && (
                            <button
                              onClick={() => onSubmitOrder(po._id)}
                              className="px-2 py-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition-colors"
                            >
                              Submit
                            </button>
                          )}
                          <Link
                            href={`/procurement/orders/${po._id}`}
                            className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Link>
                        </div>
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
