"use client";

import React, { useState, useEffect } from "react";
import { DeliveryHeader } from "@/components/delivery/DeliveryHeader";
import { DeliveryKpiCards } from "@/components/delivery/DeliveryKpiCards";
import { DispatchTable, type DispatchSummary } from "@/components/delivery/DispatchTable";
import { CreateDispatchModal } from "@/components/delivery/CreateDispatchModal";

export default function DeliveryDashboardPage() {
  const [dispatches, setDispatches] = useState<DispatchSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchDispatches = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/delivery/dispatches?limit=25");
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
  }, []);

  const totalTrips = dispatches.length;
  const inTransitCount = dispatches.filter((d) => d.status === "IN_TRANSIT").length;
  const deliveredCount = dispatches.filter((d) => d.status === "DELIVERED").length;
  const pendingCount = dispatches.filter(
    (d) => d.status === "PENDING_DISPATCH" || d.status === "READY_FOR_DISPATCH"
  ).length;

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <DeliveryHeader
        onNewDispatchClick={() => setIsModalOpen(true)}
        onRefresh={fetchDispatches}
        isLoading={isLoading}
      />

      <DeliveryKpiCards
        totalTrips={totalTrips}
        inTransitCount={inTransitCount}
        deliveredCount={deliveredCount}
        pendingCount={pendingCount}
      />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Recent Dispatch Trips</h2>
        </div>

        <DispatchTable dispatches={dispatches} isLoading={isLoading} />
      </div>

      <CreateDispatchModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => fetchDispatches()}
      />
    </div>
  );
}
