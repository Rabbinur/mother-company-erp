"use client";

import React, { useState, useEffect } from "react";
import { ProcurementHeader } from "@/components/procurement/ProcurementHeader";
import { SupplierListTable, SupplierRow } from "@/components/procurement/SupplierListTable";
import { SupplierModal } from "@/components/procurement/SupplierModal";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierRow | null>(null);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/procurement/suppliers");
      if (res.ok) {
        const json = await res.json();
        setSuppliers(json.data?.suppliers || json.data || []);
      }
    } catch (err) {
      console.error("Failed to load suppliers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleEdit = (supplier: SupplierRow) => {
    setSelectedSupplier(supplier);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setSelectedSupplier(null);
    setIsModalOpen(true);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <ProcurementHeader
        title="Suppliers & Vendors"
        subtitle="Manage principal manufacturers, commercial trade vendors, and credit payment terms"
        activeTab="suppliers"
        onRefresh={fetchSuppliers}
        loading={loading}
        onNewSupplier={handleAddNew}
      />

      <SupplierListTable
        suppliers={suppliers}
        loading={loading}
        onEditSupplier={handleEdit}
      />

      <SupplierModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchSuppliers}
        initialData={selectedSupplier}
      />
    </div>
  );
}
