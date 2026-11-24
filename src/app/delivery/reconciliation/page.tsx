"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle, DollarSign, Package } from "lucide-react";

export default function DailyStockReconciliationPage() {
  const [deliverymen, setDeliverymen] = useState<any[]>([]);
  const [selectedDriver, setSelectedDriver] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [sheet, setSheet] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetch("/api/v1/delivery/deliverymen")
      .then((r) => r.json())
      .then((data) => {
        if (data?.data) {
          setDeliverymen(data.data);
          if (data.data.length > 0) setSelectedDriver(data.data[0]._id);
        }
      });
  }, []);

  const fetchSheet = async () => {
    if (!selectedDriver) return;
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/v1/delivery/reconciliation?deliverymanId=${selectedDriver}&date=${selectedDate}`
      );
      const data = await res.json();
      if (data?.data) setSheet(data.data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDriver) fetchSheet();
  }, [selectedDriver, selectedDate]);

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Link href="/delivery" className="p-2 rounded-md hover:bg-muted text-muted-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">Deliveryman Daily Stock Reconciliation</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Reconciles loaded stock against delivered quantities, returns, damages, and cash deposits.
            </p>
          </div>
        </div>

        <button
          onClick={fetchSheet}
          disabled={isLoading}
          className="p-2 rounded-md border bg-background hover:bg-muted"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Driver and Date Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border bg-card">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Select Deliveryman
          </label>
          <select
            value={selectedDriver}
            onChange={(e) => setSelectedDriver(e.target.value)}
            className="w-full text-xs rounded-md border border-input bg-background p-2"
          >
            {deliverymen.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name} {d.phone ? `(${d.phone})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Trip Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full text-xs rounded-md border border-input bg-background p-2"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-muted-foreground">Calculating reconciliation...</div>
      ) : sheet ? (
        <div className="space-y-6">
          {/* Stock Custody Formula Grid */}
          <div className="border rounded-xl bg-card overflow-hidden">
            <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Stock Custody Sheet</h2>
              </div>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                  sheet.isStockBalanced
                    ? "bg-emerald-500/10 text-emerald-600"
                    : "bg-red-500/10 text-red-600"
                }`}
              >
                {sheet.isStockBalanced ? "Stock Balanced" : `Variance: ${sheet.stockVariance} units`}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x border-b text-center p-4">
              <div className="p-2">
                <span className="text-[11px] text-muted-foreground block">Opening / Loaded</span>
                <span className="text-xl font-bold font-mono text-foreground">
                  {sheet.openingLoadedQuantity}
                </span>
              </div>
              <div className="p-2">
                <span className="text-[11px] text-muted-foreground block">Delivered to Retailers</span>
                <span className="text-xl font-bold font-mono text-emerald-600">
                  {sheet.deliveredQuantity}
                </span>
              </div>
              <div className="p-2">
                <span className="text-[11px] text-muted-foreground block">Retailer Returns</span>
                <span className="text-xl font-bold font-mono text-blue-600">
                  {sheet.retailerReturnsQuantity}
                </span>
              </div>
              <div className="p-2">
                <span className="text-[11px] text-muted-foreground block">Damaged Goods</span>
                <span className="text-xl font-bold font-mono text-red-600">
                  {sheet.damagedQuantity}
                </span>
              </div>
              <div className="p-2">
                <span className="text-[11px] text-muted-foreground block">Undelivered / Closing</span>
                <span className="text-xl font-bold font-mono text-foreground">
                  {sheet.undeliveredQuantity}
                </span>
              </div>
            </div>

            <div className="p-3 bg-muted/10 text-xs text-muted-foreground text-center">
              Reconciliation Formula: <strong>Loaded ({sheet.openingLoadedQuantity})</strong> = Delivered (
              {sheet.deliveredQuantity}) + Returns ({sheet.retailerReturnsQuantity}) + Damaged (
              {sheet.damagedQuantity}) + Closing ({sheet.undeliveredQuantity})
            </div>
          </div>

          {/* Cash Settlement Summary */}
          <div className="border rounded-xl bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Cash Collections & Deposit</h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3 rounded-lg border bg-muted/20">
                <span className="text-muted-foreground">Total Retailer Cash Collected</span>
                <div className="text-lg font-bold font-mono text-foreground mt-1">
                  ৳{(sheet.totalCashCollected || 0).toLocaleString()}
                </div>
              </div>

              <div className="p-3 rounded-lg border bg-muted/20">
                <span className="text-muted-foreground">Actual Cash Deposited</span>
                <div className="text-lg font-bold font-mono text-foreground mt-1">
                  ৳{(sheet.totalCashDeposited || 0).toLocaleString()}
                </div>
              </div>

              <div className="p-3 rounded-lg border bg-muted/20">
                <span className="text-muted-foreground">Cash Variance</span>
                <div
                  className={`text-lg font-bold font-mono mt-1 ${
                    sheet.cashDifference === 0
                      ? "text-emerald-600"
                      : sheet.cashDifference < 0
                      ? "text-red-600"
                      : "text-blue-600"
                  }`}
                >
                  {sheet.cashDifference === 0
                    ? "৳0 (Reconciled)"
                    : `৳${(sheet.cashDifference || 0).toLocaleString()}`}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
