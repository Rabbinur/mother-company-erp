"use client";

import React, { useState, useEffect } from "react";
import { GrnHeader } from "@/components/grn/GrnHeader";
import { GrnManualEntryForm } from "@/components/grn/GrnManualEntryForm";

export default function NewGrnPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [principalCompanies, setPrincipalCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFormData() {
      try {
        const [vRes, wRes, pRes] = await Promise.all([
          fetch("/api/v1/vendors"),
          fetch("/api/v1/warehouses"),
          fetch("/api/v1/principal-companies").catch(() => null),
        ]);

        if (vRes.ok) {
          const vData = await vRes.json();
          setSuppliers(vData.data?.vendors || vData.data || []);
        }

        if (wRes.ok) {
          const wData = await wRes.json();
          setWarehouses(wData.data?.warehouses || wData.data || []);
        }

        if (pRes && pRes.ok) {
          const pData = await pRes.json();
          setPrincipalCompanies(pData.data?.principalCompanies || pData.data || []);
        }
      } catch (err) {
        console.error("Failed to load options for GRN form:", err);
      } finally {
        setLoading(false);
      }
    }
    loadFormData();
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <GrnHeader
        title="Create Goods Receipt Note (GRN)"
        subtitle="Primary Manual Entry workflow. You can enter details and add items directly."
        isDetailPage
      />

      {loading ? (
        <div className="rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center text-xs text-zinc-400 font-mono">
          Loading supplier and warehouse directory...
        </div>
      ) : (
        <GrnManualEntryForm
          suppliers={suppliers}
          warehouses={warehouses}
          principalCompanies={principalCompanies}
        />
      )}
    </div>
  );
}
