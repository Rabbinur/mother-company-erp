"use client";

import React, { useState, useEffect } from "react";
import { DeliveryHeader } from "@/components/delivery/DeliveryHeader";
import { DispatchTable, type DispatchSummary } from "@/components/delivery/DispatchTable";
import { CreateDispatchModal } from "@/components/delivery/CreateDispatchModal";

export default function DispatchesListPage() {
  const [dispatches, setDispatches] = useState<DispatchSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchDispatches = async () => {
    setIsLoading(true);
    try {
      const q = statusFilter ? `?status=${statusFilter}` : "";
      const res = await fetch(`/api/v1/delivery/dispatches${q}`);
      const data = await res.json();
      if (data?.data?.dispatches) {
        setDispatches(data.data.dispatches);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDispatches();
  }, [statusFilter]);

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <DeliveryHeader
        onNewDispatchClick={() => setIsModalOpen(true)}
        onRefresh={fetchDispatches}
        isLoading={isLoading}
      />

      <div className="flex items-center gap-2 mb-4">
        {["", "READY_FOR_DISPATCH", "LOADED", "IN_TRANSIT", "DELIVERED", "PARTIALLY_DELIVERED", "CANCELLED"].map(
          (st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                statusFilter === st
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {st === "" ? "All Dispatches" : st.replace(/_/g, " ")}
            </button>
          )
        )}
      </div>

      <DispatchTable dispatches={dispatches} isLoading={isLoading} />

      <CreateDispatchModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => fetchDispatches()}
      />
    </div>
  );
}
