"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  Truck,
  ArrowLeft,
  CheckCircle,
  Clock,
  Package,
  Play,
  CheckCheck,
  XCircle,
  FileSpreadsheet,
} from "lucide-react";
import { StopDeliveryModal } from "@/components/delivery/StopDeliveryModal";
import { TripReconciliationModal } from "@/components/delivery/TripReconciliationModal";

export default function DispatchWorkbenchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [dispatch, setDispatch] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeStop, setActiveStop] = useState<any | null>(null);
  const [isReconcileOpen, setIsReconcileOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchDispatch = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/delivery/dispatches/${id}`);
      const data = await res.json();
      if (data?.data) setDispatch(data.data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDispatch();
  }, [id]);

  if (isLoading) {
    return <div className="p-12 text-center text-muted-foreground">Loading dispatch trip workbench...</div>;
  }

  if (!dispatch) {
    return <div className="p-12 text-center text-red-500">Dispatch trip not found.</div>;
  }

  const handleLoad = async () => {
    try {
      const res = await fetch(`/api/v1/delivery/dispatches/${id}/load`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      fetchDispatch();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleStart = async () => {
    try {
      const res = await fetch(`/api/v1/delivery/dispatches/${id}/start`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      fetchDispatch();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <Link href="/delivery" className="p-2 rounded-md hover:bg-muted text-muted-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-mono text-foreground">{dispatch.dispatchNumber}</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                {dispatch.status}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Trip Date: {format(new Date(dispatch.tripDate), "PPP")} • Origin: {dispatch.warehouseId?.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {dispatch.status === "READY_FOR_DISPATCH" && (
            <button
              onClick={handleLoad}
              className="px-3.5 py-2 text-xs font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1.5"
            >
              <Package className="w-3.5 h-3.5" /> Confirm Vehicle Loading
            </button>
          )}

          {dispatch.status === "LOADED" && (
            <button
              onClick={handleStart}
              className="px-3.5 py-2 text-xs font-medium rounded-md bg-amber-600 text-white hover:bg-amber-700 flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" /> Start Trip (In-Transit)
            </button>
          )}

          {(dispatch.status === "DELIVERED" || dispatch.status === "PARTIALLY_DELIVERED") && (
            <button
              onClick={() => setIsReconcileOpen(true)}
              className="px-3.5 py-2 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1.5"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Reconcile & Close Trip
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="p-3 text-xs text-red-600 bg-red-500/10 border border-red-200 rounded-md">
          {actionError}
        </div>
      )}

      {/* Trip Custody Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border bg-card">
          <span className="text-xs text-muted-foreground">Assigned Vehicle</span>
          <div className="font-semibold text-foreground mt-1">
            {dispatch.vehicleNumber || "Unassigned"}
          </div>
          <p className="text-xs text-muted-foreground">
            {dispatch.vehicleId?.modelName ? `${dispatch.vehicleId.modelName}` : "Standard Logistics Fleet"}
          </p>
        </div>

        <div className="p-4 rounded-xl border bg-card">
          <span className="text-xs text-muted-foreground">Assigned Deliveryman</span>
          <div className="font-semibold text-foreground mt-1">
            {dispatch.deliverymanName || "Unassigned"}
          </div>
          <p className="text-xs text-muted-foreground">{dispatch.deliverymanPhone || "No contact info"}</p>
        </div>

        <div className="p-4 rounded-xl border bg-card">
          <span className="text-xs text-muted-foreground">Trip Summary</span>
          <div className="font-semibold text-foreground mt-1">{dispatch.orders?.length || 0} Delivery Stops</div>
          <p className="text-xs text-muted-foreground">{dispatch.items?.length || 0} Total Product Lines</p>
        </div>
      </div>

      {/* Delivery Stops Sheet */}
      <div className="border rounded-xl bg-card overflow-hidden">
        <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Retailer Delivery Stops & Outcomes</h2>
          <span className="text-xs text-muted-foreground">Click stop to record delivery</span>
        </div>

        <div className="divide-y text-xs">
          {dispatch.orders?.map((stop: any, idx: number) => (
            <div
              key={idx}
              className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px]">
                    {stop.stopSequence || idx + 1}
                  </span>
                  <span className="font-semibold text-foreground">{stop.customerName}</span>
                  <span className="font-mono text-muted-foreground">({stop.orderNumber})</span>
                </div>
                <p className="text-muted-foreground text-[11px] pl-7">
                  {stop.address || "Store delivery address"} • {stop.phone || "No phone"}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="font-mono font-medium">৳{(stop.cashCollected || 0).toLocaleString()}</div>
                  <div className="text-[10px] text-muted-foreground">Collected</div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                    stop.status === "delivered"
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-200"
                      : stop.status === "partially_delivered"
                      ? "bg-amber-500/10 text-amber-600 border-amber-200"
                      : stop.status === "failed" || stop.status === "rejected"
                      ? "bg-red-500/10 text-red-600 border-red-200"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {stop.status}
                </span>

                {(dispatch.status === "LOADED" ||
                  dispatch.status === "IN_TRANSIT" ||
                  dispatch.status === "PARTIALLY_DELIVERED") && (
                  <button
                    onClick={() => setActiveStop(stop)}
                    className="px-2.5 py-1 text-xs font-medium rounded-md border border-input bg-background hover:bg-muted"
                  >
                    Record Delivery
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      {activeStop && (
        <StopDeliveryModal
          isOpen={!!activeStop}
          onClose={() => setActiveStop(null)}
          stop={activeStop}
          items={dispatch.items?.filter((it: any) => String(it.orderId) === String(activeStop.orderId)) || []}
          dispatchId={dispatch._id}
          onSuccess={() => fetchDispatch()}
        />
      )}

      {isReconcileOpen && (
        <TripReconciliationModal
          isOpen={isReconcileOpen}
          onClose={() => setIsReconcileOpen(false)}
          dispatch={dispatch}
          onSuccess={() => fetchDispatch()}
        />
      )}
    </div>
  );
}
