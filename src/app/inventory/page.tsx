"use client";

import React, { useState, useEffect } from "react";
import { InventoryHeader } from "@/components/inventory/InventoryHeader";
import { InventoryKpiCards } from "@/components/inventory/InventoryKpiCards";
import { InventoryTable, type BalanceItem } from "@/components/inventory/InventoryTable";
import { StockMovementTable, type MovementItem } from "@/components/inventory/StockMovementTable";
import { StockBatchTable, type BatchItem } from "@/components/inventory/StockBatchTable";
import { StockAdjustmentModal } from "@/components/inventory/StockAdjustmentModal";
import { StockTransferModal } from "@/components/inventory/StockTransferModal";

export default function InventoryPage() {
  const [tab, setTab] = useState<"balances" | "movements" | "batches">("balances");
  const [balances, setBalances] = useState<BalanceItem[]>([]);
  const [movements, setMovements] = useState<MovementItem[]>([]);
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [dealerships, setDealerships] = useState<Array<{ _id: string; name: string }>>([]);
  const [warehouses, setWarehouses] = useState<Array<{ _id: string; name: string }>>([]);
  const [selectedDealership, setSelectedDealership] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [search, setSearch] = useState("");

  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [tab, selectedDealership, selectedWarehouse, search]);

  const fetchMetadata = async () => {
    try {
      const [dRes, wRes] = await Promise.all([
        fetch("/api/v1/dealerships").then((r) => r.json()),
        fetch("/api/v1/warehouses").then((r) => r.json()),
      ]);
      if (dRes.success) setDealerships(dRes.data || []);
      if (wRes.success) setWarehouses(wRes.data || []);
    } catch {
      // ignore
    }
  };

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append("tab", tab);
      if (selectedDealership) params.append("dealershipId", selectedDealership);
      if (selectedWarehouse) params.append("warehouseId", selectedWarehouse);
      if (search) params.append("search", search);

      const res = await fetch(`/api/v1/inventory?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        if (tab === "balances") setBalances(json.data || []);
        else if (tab === "movements") setMovements(json.data || []);
        else if (tab === "batches") setBatches(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Compute live KPIs
  const totalOnHand = balances.reduce((sum, b) => sum + (b.onHandQuantity || 0), 0);
  const totalReserved = balances.reduce((sum, b) => sum + (b.reservedQuantity || 0), 0);
  const totalAvailable = balances.reduce((sum, b) => sum + (b.availableQuantity || 0), 0);
  const totalDamaged = balances.reduce((sum, b) => sum + (b.damagedQuantity || 0), 0);

  return (
    <div className="space-y-6">
      <InventoryHeader
        dealerships={dealerships}
        warehouses={warehouses}
        selectedDealership={selectedDealership}
        selectedWarehouse={selectedWarehouse}
        onDealershipChange={setSelectedDealership}
        onWarehouseChange={setSelectedWarehouse}
        search={search}
        onSearchChange={setSearch}
        onOpenAdjust={() => setShowAdjustModal(true)}
        onOpenTransfer={() => setShowTransferModal(true)}
      />

      <InventoryKpiCards
        totalOnHand={totalOnHand}
        totalAvailable={totalAvailable}
        totalReserved={totalReserved}
        totalDamaged={totalDamaged}
      />

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setTab("balances")}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
            tab === "balances"
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Stock Balances
        </button>
        <button
          onClick={() => setTab("batches")}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
            tab === "batches"
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Batch & Landed Costs
        </button>
        <button
          onClick={() => setTab("movements")}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
            tab === "movements"
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Movement Ledger
        </button>
      </div>

      {tab === "balances" && <InventoryTable balances={balances} loading={loading} />}
      {tab === "batches" && <StockBatchTable batches={batches} loading={loading} />}
      {tab === "movements" && <StockMovementTable movements={movements} loading={loading} />}

      <StockAdjustmentModal
        isOpen={showAdjustModal}
        onClose={() => setShowAdjustModal(false)}
        dealerships={dealerships}
        warehouses={warehouses}
        onSuccess={fetchInventory}
      />

      <StockTransferModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        dealerships={dealerships}
        warehouses={warehouses}
        onSuccess={fetchInventory}
      />
    </div>
  );
}
