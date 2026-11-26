"use client";

import React from "react";
import {
  Package,
  AlertTriangle,
  Clock,
  Building2,
  TrendingUp,
  TrendingDown,
  Layers,
  ShieldAlert,
} from "lucide-react";
import { InventoryAnalyticsData } from "./types";
import { formatCurrency, formatShortDate } from "@/lib/utils";

interface InventoryAnalyticsSectionProps {
  inventory: InventoryAnalyticsData;
  canViewCosts: boolean;
}

export function InventoryAnalyticsSection({
  inventory,
  canViewCosts,
}: InventoryAnalyticsSectionProps) {
  const {
    totalStockUnits,
    totalAvailableUnits,
    totalReservedUnits,
    totalDamagedUnits,
    inventoryValuation,
    dealershipComparison,
    lowStockAlerts,
    fastMovingProducts,
    slowMovingProducts,
    expiryAlerts,
  } = inventory;

  return (
    <div className="space-y-6">
      {/* 5 Top Inventory Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Total Stock Units</span>
          <p className="mt-1 text-xl font-bold text-slate-900">{totalStockUnits.toLocaleString()}</p>
          <span className="text-[11px] text-slate-400">Units on-hand</span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Available Units</span>
          <p className="mt-1 text-xl font-bold text-emerald-600">{totalAvailableUnits.toLocaleString()}</p>
          <span className="text-[11px] text-slate-400">Ready for sale</span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Reserved Units</span>
          <p className="mt-1 text-xl font-bold text-amber-600">{totalReservedUnits.toLocaleString()}</p>
          <span className="text-[11px] text-slate-400">Pending dispatch</span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Damaged / Hold</span>
          <p className="mt-1 text-xl font-bold text-rose-600">{totalDamagedUnits.toLocaleString()}</p>
          <span className="text-[11px] text-slate-400">Quarantine</span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">FIFO Valuation</span>
          <p className="mt-1 text-xl font-bold text-purple-700">
            {canViewCosts ? formatCurrency(inventoryValuation) : "Confidential"}
          </p>
          <span className="text-[11px] text-slate-400">Net landed cost</span>
        </div>
      </div>

      {/* Row 2: Branch Comparison & Low-Stock Alerts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Dealership Stock Comparison */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-slate-900">Branch Stock Breakdown</h3>
            </div>
            <span className="text-[11px] text-slate-400">Dealership units & valuation</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-2 px-2.5">Dealership</th>
                  <th className="py-2 px-2.5 text-right">Units</th>
                  <th className="py-2 px-2.5 text-right">{canViewCosts ? "Valuation" : ""}</th>
                  <th className="py-2 px-2.5 text-center">Low-Stock Items</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dealershipComparison && dealershipComparison.length > 0 ? (
                  dealershipComparison.map((d) => (
                    <tr key={d.dealershipId} className="hover:bg-slate-50/60">
                      <td className="py-2 px-2.5 font-medium text-slate-800">{d.dealershipName}</td>
                      <td className="py-2 px-2.5 text-right font-semibold text-slate-900">
                        {d.stockUnits.toLocaleString()}
                      </td>
                      <td className="py-2 px-2.5 text-right font-medium text-purple-700">
                        {canViewCosts ? formatCurrency(d.valuation) : "—"}
                      </td>
                      <td className="py-2 px-2.5 text-center">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            d.lowStockCount > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {d.lowStockCount} alerts
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      No dealership stock records
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Stock Threshold Alerts */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900">Low-Stock Alerts</h3>
            </div>
            <span className="text-[11px] text-amber-700 font-semibold">
              {lowStockAlerts ? lowStockAlerts.length : 0} items below minimum
            </span>
          </div>

          <div className="overflow-x-auto max-h-60">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-2 px-2.5">Item</th>
                  <th className="py-2 px-2.5 text-center">Available</th>
                  <th className="py-2 px-2.5 text-center">Min Threshold</th>
                  <th className="py-2 px-2.5">Branch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lowStockAlerts && lowStockAlerts.length > 0 ? (
                  lowStockAlerts.map((item, idx) => (
                    <tr key={`${item.productId}-${idx}`} className="hover:bg-amber-50/40">
                      <td className="py-2 px-2.5">
                        <div className="font-semibold text-slate-800">{item.productName}</div>
                        <div className="text-[10px] text-slate-400">{item.sku}</div>
                      </td>
                      <td className="py-2 px-2.5 text-center font-bold text-rose-600">
                        {item.availableQuantity}
                      </td>
                      <td className="py-2 px-2.5 text-center text-slate-500 font-medium">
                        {item.minStock}
                      </td>
                      <td className="py-2 px-2.5 text-slate-600 text-[11px]">
                        {item.dealershipName || "Central"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-emerald-600 font-medium">
                      ✓ All products are above safety stock threshold
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Row 3: Expiry Radar (Expired & Near-Expiry Batches) */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-rose-600" />
            <h3 className="text-sm font-bold text-slate-900">Batch Expiry Radar</h3>
          </div>
          <span className="text-[11px] text-slate-400">Batches expired or expiring within 60 days</span>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Expired Batches */}
          <div className="rounded-lg border border-rose-100 bg-rose-50/30 p-3">
            <h4 className="text-xs font-bold text-rose-800 mb-2 flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>Expired Batches ({expiryAlerts?.expiredBatches?.length || 0})</span>
            </h4>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {expiryAlerts?.expiredBatches && expiryAlerts.expiredBatches.length > 0 ? (
                expiryAlerts.expiredBatches.map((b, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border border-rose-100 text-xs">
                    <div>
                      <span className="font-semibold text-slate-800">{b.productName}</span>
                      <span className="text-[10px] text-slate-400 block">Batch: {b.batchNumber}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-rose-600 block">{b.remainingQuantity} units</span>
                      <span className="text-[10px] text-rose-500 font-medium">{b.daysExpired} days ago</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 py-3 text-center">No expired batches in stock</p>
              )}
            </div>
          </div>

          {/* Near Expiry Batches */}
          <div className="rounded-lg border border-amber-100 bg-amber-50/30 p-3">
            <h4 className="text-xs font-bold text-amber-800 mb-2 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span>Near Expiry Batches ({expiryAlerts?.nearExpiryBatches?.length || 0})</span>
            </h4>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {expiryAlerts?.nearExpiryBatches && expiryAlerts.nearExpiryBatches.length > 0 ? (
                expiryAlerts.nearExpiryBatches.map((b, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border border-amber-100 text-xs">
                    <div>
                      <span className="font-semibold text-slate-800">{b.productName}</span>
                      <span className="text-[10px] text-slate-400 block">Batch: {b.batchNumber}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-amber-700 block">{b.remainingQuantity} units</span>
                      <span className="text-[10px] text-amber-600 font-medium">Expires in {b.daysUntilExpiry} days</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 py-3 text-center">No batches near expiry</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
