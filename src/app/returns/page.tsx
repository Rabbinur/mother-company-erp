"use client";

import React, { useState, useEffect } from "react";
import {
  RotateCcw,
  Plus,
  CheckCircle,
  AlertOctagon,
  Clock,
  X,
  FileText,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function ReturnsPage() {
  const [tab, setTab] = useState<"sales" | "purchases">("sales");
  const [salesReturns, setSalesReturns] = useState<any[]>([]);
  const [purchaseReturns, setPurchaseReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReturns();
  }, [tab]);

  const fetchReturns = async () => {
    try {
      setLoading(true);
      const endpoint = tab === "sales" ? "/api/v1/returns/sales" : "/api/v1/returns/purchases";
      const res = await fetch(endpoint);
      const json = await res.json();
      if (json.success) {
        if (tab === "sales") setSalesReturns(json.data || []);
        else setPurchaseReturns(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Returns & Quality Inspection
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Customer sales returns and vendor purchase returns with condition inspection
          </p>
        </div>

        <div className="flex rounded-lg border border-slate-200 bg-white p-1">
          <button
            onClick={() => setTab("sales")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              tab === "sales" ? "bg-primary text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Sales Returns
          </button>
          <button
            onClick={() => setTab("purchases")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              tab === "purchases" ? "bg-primary text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Purchase Returns
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Return #</th>
                <th className="px-4 py-3.5">Reference Document</th>
                <th className="px-4 py-3.5">Party (Customer / Vendor)</th>
                <th className="px-4 py-3.5">Reason</th>
                <th className="px-4 py-3.5">Restocked?</th>
                <th className="px-4 py-3.5">Adjustment Amount</th>
                <th className="px-4 py-3.5">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                    Loading returns...
                  </td>
                </tr>
              ) : (tab === "sales" ? salesReturns : purchaseReturns).length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                    No return events recorded.
                  </td>
                </tr>
              ) : (
                (tab === "sales" ? salesReturns : purchaseReturns).map((r) => (
                  <tr key={r._id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-900">
                      {r.returnNumber}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-600">
                      {tab === "sales" ? r.orderNumber : r.purchaseNumber}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-800">
                      {tab === "sales"
                        ? r.customerId?.shopName || "Customer"
                        : r.vendorId?.companyName || "Vendor"}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">{r.reason}</td>
                    <td className="px-4 py-3.5">
                      {r.restocked ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          <CheckCircle className="h-3 w-3" /> Yes (Good Condition)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          <AlertOctagon className="h-3 w-3" /> Damaged / Not Restocked
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-primary">
                      {formatCurrency(tab === "sales" ? r.totalRefundAmount : r.totalDebitAmount)}
                    </td>
                    <td className="px-4 py-3.5 text-slate-400 text-[11px]">
                      {formatDate(r.createdAt)}
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
