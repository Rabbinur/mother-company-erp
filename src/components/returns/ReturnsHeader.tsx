"use client";

import React from "react";
import Link from "next/link";
import { RotateCcw, Plus, RefreshCw, ShieldAlert, Truck, ArrowLeftRight } from "lucide-react";

interface ReturnsHeaderProps {
  activeTab: "sales" | "purchases" | "claims";
  onTabChange: (tab: "sales" | "purchases" | "claims") => void;
  onNewSalesReturnClick?: () => void;
  onNewClaimClick?: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function ReturnsHeader({
  activeTab,
  onTabChange,
  onNewSalesReturnClick,
  onNewClaimClick,
  onRefresh,
  isLoading = false,
}: ReturnsHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/40 pb-4 mb-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
          <RotateCcw className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Returns, Claims & Reverse Logistics
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-medium text-muted-foreground border">
              Dealership Isolated
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Customer returns, supplier debits, transit damages & manufacturer claims with strict stock & ledger isolation.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-lg border border-input bg-muted/40 p-1">
          <button
            onClick={() => onTabChange("sales")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === "sales"
                ? "bg-background text-foreground shadow-xs border border-border/50"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Customer Returns
          </button>
          <button
            onClick={() => onTabChange("purchases")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === "purchases"
                ? "bg-background text-foreground shadow-xs border border-border/50"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Supplier Returns
          </button>
          <button
            onClick={() => onTabChange("claims")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === "claims"
                ? "bg-background text-foreground shadow-xs border border-border/50"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Damage & Claims
          </button>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-md border border-input bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            title="Refresh returns data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        )}

        {activeTab === "sales" && onNewSalesReturnClick && (
          <button
            onClick={onNewSalesReturnClick}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Sales Return
          </button>
        )}

        {activeTab === "claims" && onNewClaimClick && (
          <button
            onClick={onNewClaimClick}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors shadow-sm"
          >
            <ShieldAlert className="w-4 h-4" />
            File New Claim
          </button>
        )}
      </div>
    </div>
  );
}
