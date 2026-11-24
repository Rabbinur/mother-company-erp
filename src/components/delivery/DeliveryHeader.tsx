"use client";

import React from "react";
import Link from "next/link";
import { Truck, Plus, Filter, RefreshCw } from "lucide-react";

interface DeliveryHeaderProps {
  onNewDispatchClick?: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function DeliveryHeader({
  onNewDispatchClick,
  onRefresh,
  isLoading = false,
}: DeliveryHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/40 pb-4 mb-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
          <Truck className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Delivery & Dispatch Management
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-medium text-muted-foreground border">
              Logistics
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage trips, vehicle load sheets, retailer delivery proof, and daily stock custody.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href="/delivery/reconciliation"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border border-input bg-background hover:bg-muted text-foreground transition-colors"
        >
          Daily Reconciliation
        </Link>

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-md border border-input bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            title="Refresh dispatches"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        )}

        {onNewDispatchClick && (
          <button
            onClick={onNewDispatchClick}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Dispatch Trip
          </button>
        )}
      </div>
    </div>
  );
}
