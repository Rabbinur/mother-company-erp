"use client";

import React, { useState, useEffect } from "react";
import { BarChart3, Printer, Download, TrendingUp, DollarSign, Calendar } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function ReportsPage() {
  const [tab, setTab] = useState<"pl" | "trial">("pl");
  const [plData, setPlData] = useState<any>(null);
  const [trialData, setTrialData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, [tab]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      if (tab === "pl") {
        const res = await fetch("/api/v1/reports/profit-loss");
        const json = await res.json();
        if (json.success) setPlData(json.data);
      } else {
        const res = await fetch("/api/v1/reports/trial-balance");
        const json = await res.json();
        if (json.success) setTrialData(json.data || []);
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
            Financial & Business Reports
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative financial statements derived from the verified double-entry accounting ledger
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-slate-200 bg-white p-1">
            <button
              onClick={() => setTab("pl")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                tab === "pl" ? "bg-primary text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Profit & Loss Statement
            </button>
            <button
              onClick={() => setTab("trial")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                tab === "trial" ? "bg-primary text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Trial Balance
            </button>
          </div>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {tab === "pl" ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xs max-w-3xl mx-auto space-y-6">
          <div className="text-center border-b border-slate-200 pb-4">
            <h3 className="text-lg font-bold text-slate-900">MOTHER COMPANY ERP</h3>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">
              Statement of Comprehensive Income (Profit & Loss)
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">All figures in Bangladesh Taka (৳ BDT)</p>
          </div>

          <div className="space-y-4 text-xs">
            {/* Sales Section */}
            <div className="space-y-1.5">
              <div className="flex justify-between py-1 font-semibold text-slate-800">
                <span>Gross Sales Revenue</span>
                <span>{formatCurrency(plData?.salesRevenue || 0)}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-500">
                <span className="pl-4">Less: Sales Discounts & Allowances</span>
                <span>({formatCurrency(plData?.salesDiscounts || 0)})</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 py-1 font-bold text-slate-900">
                <span>Net Sales</span>
                <span>{formatCurrency(plData?.netSales || 0)}</span>
              </div>
            </div>

            {/* COGS Section */}
            <div className="space-y-1.5 border-t border-slate-100 pt-3">
              <div className="flex justify-between py-1 text-slate-700">
                <span>Cost of Goods Sold (Direct Inventory Acquisition Cost)</span>
                <span>({formatCurrency(plData?.costOfGoodsSold || 0)})</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 bg-emerald-50/50 p-2.5 rounded-lg font-bold text-emerald-800 text-sm">
                <span>GROSS PROFIT</span>
                <span>{formatCurrency(plData?.grossProfit || 0)}</span>
              </div>
              <p className="text-[10px] text-slate-400 text-right pr-2">
                Gross Margin: {plData?.grossMarginPercentage || 0}%
              </p>
            </div>

            {/* Operating Expenses */}
            <div className="space-y-1.5 border-t border-slate-100 pt-3">
              <div className="flex justify-between py-1 font-semibold text-slate-800">
                <span>Operating & Administrative Expenses</span>
                <span>({formatCurrency(plData?.operatingExpenses || 0)})</span>
              </div>
              <p className="text-[11px] text-slate-400 pl-4">
                Rent, Staff Salaries, Freight, Utilities, and Warehouse Overheads
              </p>
            </div>

            {/* Net Profit */}
            <div className="border-t-2 border-slate-900 pt-3">
              <div className="flex justify-between rounded-lg bg-slate-900 p-3.5 text-white font-bold text-base">
                <span>NET PROFIT FOR THE PERIOD</span>
                <span className="text-emerald-400">{formatCurrency(plData?.netProfit || 0)}</span>
              </div>
              <p className="text-[11px] text-slate-400 text-right pr-2 mt-1">
                Net Profit Margin: {plData?.netProfitPercentage || 0}%
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Trial Balance Table */
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Account Code</th>
                  <th className="px-4 py-3.5">Account Title</th>
                  <th className="px-4 py-3.5">Type</th>
                  <th className="px-4 py-3.5 text-right">Debit (৳)</th>
                  <th className="px-4 py-3.5 text-right">Credit (৳)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trialData.map((t, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-900">{t.code}</td>
                    <td className="px-4 py-3.5 font-semibold text-slate-800">{t.name}</td>
                    <td className="px-4 py-3.5 uppercase text-[10px] text-slate-500">{t.type}</td>
                    <td className="px-4 py-3.5 text-right font-mono font-semibold text-slate-800">
                      {t.debit > 0 ? formatCurrency(t.debit) : "-"}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-semibold text-slate-800">
                      {t.credit > 0 ? formatCurrency(t.credit) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
