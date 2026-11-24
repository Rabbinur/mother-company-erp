"use client";

import React, { useState, useEffect } from "react";
import { ProcurementHeader } from "@/components/procurement/ProcurementHeader";
import { SupplierPayableTable, SupplierPayableRow } from "@/components/procurement/SupplierPayableTable";
import { SupplierPaymentModal } from "@/components/procurement/SupplierPaymentModal";

export default function SupplierPayablesPage() {
  const [payables, setPayables] = useState<SupplierPayableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayable, setSelectedPayable] = useState<SupplierPayableRow | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchPayables = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/procurement/payables");
      if (res.ok) {
        const json = await res.json();
        setPayables(json.data?.payables || json.data || []);
      }
    } catch (err) {
      console.error("Failed to load payables:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayables();
  }, []);

  const handleRecordPayment = (payable: SupplierPayableRow) => {
    setSelectedPayable(payable);
    setIsModalOpen(true);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <ProcurementHeader
        title="Supplier Payables & Settlements"
        subtitle="Track billed challan liabilities, prompt cash settlement discounts, and payment history"
        activeTab="payables"
        onRefresh={fetchPayables}
        loading={loading}
      />

      <SupplierPayableTable
        payables={payables}
        loading={loading}
        onRecordPayment={handleRecordPayment}
      />

      <SupplierPaymentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchPayables}
        payable={selectedPayable}
      />
    </div>
  );
}
