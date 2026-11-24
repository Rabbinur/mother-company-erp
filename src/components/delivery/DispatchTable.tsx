"use client";

import React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Truck, ChevronRight, Eye, CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";

export interface DispatchSummary {
  _id: string;
  dispatchNumber: string;
  tripDate: string;
  status: string;
  vehicleNumber?: string;
  deliverymanName?: string;
  warehouseId?: { name: string; code: string };
  orders?: Array<{ orderId: string; status: string }>;
  reconciliation?: { isStockBalanced: boolean; totalCashCollected: number; cashDeposited: number };
}

interface DispatchTableProps {
  dispatches: DispatchSummary[];
  isLoading?: boolean;
}

export function DispatchTable({ dispatches, isLoading = false }: DispatchTableProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING_DISPATCH":
      case "READY_FOR_DISPATCH":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 border border-blue-200/50">
            <Clock className="w-3 h-3" /> Ready
          </span>
        );
      case "LOADED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-600 border border-indigo-200/50">
            <Truck className="w-3 h-3" /> Loaded
          </span>
        );
      case "IN_TRANSIT":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 border border-amber-200/50">
            <Truck className="w-3 h-3 animate-pulse" /> In Transit
          </span>
        );
      case "DELIVERED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-200/50">
            <CheckCircle2 className="w-3 h-3" /> Delivered
          </span>
        );
      case "PARTIALLY_DELIVERED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 border border-amber-200/50">
            <AlertTriangle className="w-3 h-3" /> Partial
          </span>
        );
      case "DELIVERY_FAILED":
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-600 border border-red-200/50">
            <XCircle className="w-3 h-3" /> {status === "CANCELLED" ? "Cancelled" : "Failed"}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border">
            {status}
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center border rounded-xl bg-card text-muted-foreground">
        Loading dispatches...
      </div>
    );
  }

  if (!dispatches || dispatches.length === 0) {
    return (
      <div className="p-12 text-center border rounded-xl bg-card text-muted-foreground flex flex-col items-center justify-center gap-2">
        <Truck className="w-10 h-10 text-muted-foreground/40 mb-1" />
        <p className="font-medium text-foreground">No dispatch trips found</p>
        <p className="text-xs text-muted-foreground">
          Create a new dispatch trip from confirmed sales orders to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-border/50 rounded-xl overflow-hidden bg-card shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 text-muted-foreground font-medium text-xs border-b">
            <tr>
              <th className="py-3 px-4">Dispatch #</th>
              <th className="py-3 px-4">Trip Date</th>
              <th className="py-3 px-4">Vehicle & Driver</th>
              <th className="py-3 px-4">Warehouse</th>
              <th className="py-3 px-4">Stops</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {dispatches.map((d) => (
              <tr key={d._id} className="hover:bg-muted/30 transition-colors">
                <td className="py-3 px-4 font-mono font-semibold text-primary">
                  <Link href={`/delivery/dispatches/${d._id}`} className="hover:underline">
                    {d.dispatchNumber}
                  </Link>
                </td>
                <td className="py-3 px-4 text-muted-foreground">
                  {d.tripDate ? format(new Date(d.tripDate), "MMM dd, yyyy") : "N/A"}
                </td>
                <td className="py-3 px-4">
                  <div className="font-medium text-foreground">
                    {d.vehicleNumber || "Unassigned Vehicle"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {d.deliverymanName || "No driver assigned"}
                  </div>
                </td>
                <td className="py-3 px-4 text-xs text-muted-foreground">
                  {d.warehouseId?.name || "Central Warehouse"}
                </td>
                <td className="py-3 px-4 font-medium text-foreground">
                  {d.orders?.length || 0} stops
                </td>
                <td className="py-3 px-4">{getStatusBadge(d.status)}</td>
                <td className="py-3 px-4 text-right">
                  <Link
                    href={`/delivery/dispatches/${d._id}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-input bg-background hover:bg-muted text-foreground transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Workbench
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
