"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  Phone,
  CreditCard,
  Package,
  Receipt,
  RotateCcw,
  Truck,
  Download,
  Printer,
  ShieldAlert,
} from "lucide-react";
import type { CompleteCustomerProfileData } from "@/services/customer/CustomerProfileService";

export function CompleteCustomerProfile({ customerId }: { customerId: string }) {
  const [profile, setProfile] = useState<CompleteCustomerProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"accounts" | "orders" | "payments" | "returns" | "deliveries">("accounts");

  useEffect(() => {
    fetchProfile();
  }, [customerId]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/customers/${customerId}/profile`);
      const data = await res.json();
      if (res.ok && data.success) {
        setProfile(data.data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (section: string) => {
    window.open(`/api/v1/customers/${customerId}/export?section=${section}`, "_blank");
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-slate-400">Loading complete customer profile...</div>;
  }

  if (!profile) {
    return <div className="p-8 text-center text-sm text-rose-400">Failed to load customer profile</div>;
  }

  return (
    <div className="space-y-6">
      {/* Customer Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-100">{profile.customer.shopName}</h2>
            <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-300">
              {profile.customer.customerCode}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-400">
            <span>Proprietor: {profile.customer.name}</span>
            <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {profile.customer.phone}</span>
            <span>Type: {profile.customer.customerType}</span>
          </div>
        </div>

        {/* Action Controls & Total Due */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs text-slate-400 block">Overall Receivable</span>
            <span className="text-lg font-bold text-amber-400 font-mono">
              BDT {profile.customer.currentReceivable?.toLocaleString() || 0}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleDownload("all")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
            >
              <Download className="h-3.5 w-3.5" /> Full CSV
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
            >
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 text-sm">
        {[
          { key: "accounts", label: "Dealership Ledgers", icon: Building2 },
          { key: "orders", label: `Orders (${profile.ordersSummary.totalOrders})`, icon: Package },
          { key: "payments", label: `Payments (${profile.paymentsSummary.totalPayments})`, icon: Receipt },
          { key: "returns", label: `Returns (${profile.returnsSummary.totalReturns})`, icon: RotateCcw },
          { key: "deliveries", label: "Delivery Stops", icon: Truck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 font-medium transition ${
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Dealership Ledgers */}
      {activeTab === "accounts" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <p className="flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-amber-400" />
              Dealership accounts maintain strictly isolated subledgers. Dues are never combined.
            </p>
            <button onClick={() => handleDownload("overview")} className="text-primary hover:underline">
              Download Ledgers CSV
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profile.dealershipAccounts.map((da) => (
              <div key={da.dealershipId} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                  <div>
                    <h4 className="font-semibold text-slate-200">{da.dealershipName}</h4>
                    <span className="text-xs text-slate-400">Rep: {da.salesmanName}</span>
                  </div>
                  <span className="rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-xs">
                    {da.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                  <div>
                    <span className="text-slate-400 block">Credit Limit</span>
                    <span className="font-mono text-slate-200">BDT {da.creditLimit.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Current Balance (Due)</span>
                    <span className="font-mono font-bold text-amber-400">BDT {da.currentBalance.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Total Invoiced</span>
                    <span className="font-mono text-slate-300">BDT {da.totalInvoiced.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Total Collected</span>
                    <span className="font-mono text-emerald-400">BDT {da.totalCollected.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Orders & Schemes */}
      {activeTab === "orders" && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Total Spent: BDT {profile.ordersSummary.totalSpent.toLocaleString()} | Scheme Free Goods: {profile.ordersSummary.totalFreeQuantity} pcs</span>
            <button onClick={() => handleDownload("orders")} className="text-primary hover:underline">Download Orders CSV</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="py-2">Order #</th>
                  <th className="py-2">Grand Total</th>
                  <th className="py-2">Paid Amount</th>
                  <th className="py-2">Order Status</th>
                  <th className="py-2">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {profile.ordersSummary.recentOrders.map((o) => (
                  <tr key={o.orderNumber}>
                    <td className="py-2 font-mono">{o.orderNumber}</td>
                    <td className="py-2 font-mono">BDT {o.grandTotal}</td>
                    <td className="py-2 font-mono">BDT {o.paidAmount}</td>
                    <td className="py-2 uppercase">{o.orderStatus}</td>
                    <td className="py-2 capitalize">{o.paymentStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Payments & Collections */}
      {activeTab === "payments" && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Verified Paid Total: BDT {profile.paymentsSummary.totalPaid.toLocaleString()}</span>
            <button onClick={() => handleDownload("payments")} className="text-primary hover:underline">Download Payments CSV</button>
          </div>
          <div className="space-y-2">
            <h5 className="font-semibold text-slate-300 text-xs uppercase tracking-wider">Collections from Delivery</h5>
            <div className="divide-y divide-slate-800/60 text-xs">
              {profile.paymentsSummary.recentCollections.map((c) => (
                <div key={c.collectionId} className="flex justify-between py-2 text-slate-300">
                  <span className="font-mono">{c.collectionId}</span>
                  <span className="font-mono text-emerald-400">BDT {c.amount} ({c.paymentMethod})</span>
                  <span className="capitalize">{c.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Returns */}
      {activeTab === "returns" && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Total Returns Credit: BDT {profile.returnsSummary.totalRefundCredit.toLocaleString()}</span>
            <button onClick={() => handleDownload("returns")} className="text-primary hover:underline">Download Returns CSV</button>
          </div>
          <div className="divide-y divide-slate-800/60 text-xs">
            {profile.returnsSummary.recentReturns.map((r) => (
              <div key={r.returnNumber} className="flex justify-between py-2 text-slate-300">
                <span className="font-mono">{r.returnNumber}</span>
                <span className="font-mono text-amber-400">Credit: BDT {r.refundAmount}</span>
                <span className="uppercase">{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Delivery Stops */}
      {activeTab === "deliveries" && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
          <div className="divide-y divide-slate-800/60 text-xs">
            {profile.deliveryHistory.map((d, i) => (
              <div key={i} className="flex justify-between py-2 text-slate-300">
                <span>Dispatch: {d.dispatchNumber}</span>
                <span>Order: {d.orderNumber}</span>
                <span className="uppercase">{d.status}</span>
                <span className="font-mono text-emerald-400">Cash: BDT {d.cashCollected}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
