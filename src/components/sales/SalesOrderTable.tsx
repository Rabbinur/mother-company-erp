"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Search, FileText, CheckCircle2, Clock, XCircle, Eye, ShieldCheck, Box } from "lucide-react";

export interface SalesOrderRow {
  _id: string;
  orderNumber: string;
  orderDate: string;
  customerId: any;
  warehouseId: any;
  dealershipId?: any;
  reservationId?: any;
  items: Array<{
    productId: any;
    variantId: any;
    name: string;
    quantity: number;
    customerPriceSnapshot: number;
    subtotal: number;
  }>;
  grandTotal: number;
  orderStatus: string;
  fulfillmentStatus: string;
  notes?: string;
}

interface SalesOrderTableProps {
  orders: SalesOrderRow[];
  loading?: boolean;
  onConfirmOrder?: (id: string) => void;
  onCancelOrder?: (id: string) => void;
}

export function SalesOrderTable({
  orders,
  loading = false,
  onConfirmOrder,
  onCancelOrder,
}: SalesOrderTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const filtered = orders.filter((o) => {
    const q = searchTerm.toLowerCase();
    const custName = typeof o.customerId === "object" ? o.customerId?.name || o.customerId?.shopName || "" : "";
    const matchesSearch =
      o.orderNumber.toLowerCase().includes(q) || custName.toLowerCase().includes(q);

    const normStatus = o.orderStatus?.toUpperCase();
    const matchesStatus = statusFilter === "ALL" || normStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (st: string) => {
    switch (st?.toUpperCase()) {
      case "DRAFT":
        return "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/20";
      case "CONFIRMED":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";
      case "PARTIALLY_FULFILLED":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
      case "FULFILLED":
      case "DELIVERED":
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
            placeholder="Search order #, customer, or shop..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-zinc-400"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {["ALL", "DRAFT", "CONFIRMED", "PARTIALLY_FULFILLED", "FULFILLED", "CANCELLED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 text-xs rounded-lg font-mono transition-colors whitespace-nowrap ${
                statusFilter === st
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              {st === "ALL" ? "All Orders" : st.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 font-medium font-mono">
                <th className="py-2.5 px-4">Order Number</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Retail Customer</th>
                <th className="py-2.5 px-3">Warehouse</th>
                <th className="py-2.5 px-3 text-right">Order Value</th>
                <th className="py-2.5 px-3 text-center">Stock Reservation</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-zinc-400">
                    Loading sales orders...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                    No sales orders match your search criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((order) => {
                  const custName =
                    typeof order.customerId === "object"
                      ? order.customerId?.shopName || order.customerId?.name || "Customer"
                      : "Customer";

                  const whName =
                    typeof order.warehouseId === "object"
                      ? order.warehouseId?.name || "Warehouse"
                      : "Warehouse";

                  const isDraft = order.orderStatus?.toUpperCase() === "DRAFT";
                  const isConfirmed = order.orderStatus?.toUpperCase() === "CONFIRMED";
                  const hasReservation = !!order.reservationId;

                  return (
                    <tr
                      key={order._id}
                      className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-medium text-zinc-900 dark:text-zinc-100">
                        <Link
                          href={`/sales/orders/${order._id}`}
                          className="hover:underline flex items-center gap-1.5"
                        >
                          <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span>{order.orderNumber}</span>
                        </Link>
                      </td>
                      <td className="py-3 px-3 font-mono text-zinc-600 dark:text-zinc-400 text-[11px]">
                        {new Date(order.orderDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">{custName}</div>
                        {typeof order.customerId === "object" && order.customerId?.phone && (
                          <div className="text-[11px] font-mono text-zinc-500">
                            {order.customerId.phone}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-zinc-600 dark:text-zinc-400 text-[11px]">
                        {whName}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-medium text-zinc-900 dark:text-zinc-100">
                        ৳{order.grandTotal.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {hasReservation ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
                            <ShieldCheck className="w-3 h-3" /> Reserved
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-zinc-500/10 text-zinc-500 border-zinc-500/20">
                            <Box className="w-3 h-3" /> None
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${getStatusBadge(
                            order.orderStatus
                          )}`}
                        >
                          {order.orderStatus?.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isDraft && onConfirmOrder && (
                            <button
                              onClick={() => onConfirmOrder(order._id)}
                              className="px-2 py-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition-colors"
                            >
                              Confirm
                            </button>
                          )}
                          <Link
                            href={`/sales/orders/${order._id}`}
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
