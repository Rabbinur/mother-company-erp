"use client";

import React from "react";
import Link from "next/link";
import { Plus, RefreshCw, ShoppingCart, Truck, CreditCard, Users } from "lucide-react";

interface ProcurementHeaderProps {
  title: string;
  subtitle?: string;
  activeTab?: "dashboard" | "orders" | "payables" | "suppliers";
  onRefresh?: () => void;
  loading?: boolean;
  onNewOrder?: () => void;
  onNewSupplier?: () => void;
}

export function ProcurementHeader({
  title,
  subtitle,
  activeTab = "dashboard",
  onRefresh,
  loading = false,
  onNewOrder,
  onNewSupplier,
}: ProcurementHeaderProps) {
  const tabs = [
    { id: "dashboard", label: "Overview", href: "/procurement", icon: ShoppingCart },
    { id: "orders", label: "Purchase Orders", href: "/procurement/orders", icon: Truck },
    { id: "payables", label: "Supplier Payables", href: "/procurement/payables", icon: CreditCard },
    { id: "suppliers", label: "Suppliers", href: "/procurement/suppliers", icon: Users },
  ];

  return (
    <div className="space-y-4 border-b border-zinc-200 dark:border-zinc-800 pb-4 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mb-1">
            <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              ERP
            </Link>
            <span>/</span>
            <span className="text-zinc-900 dark:text-zinc-100 font-medium">Procurement</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          )}

          {onNewSupplier && (
            <button
              onClick={onNewSupplier}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Supplier</span>
            </button>
          )}

          {onNewOrder && (
            <button
              onClick={onNewOrder}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Purchase Order</span>
            </button>
          )}
        </div>
      </div>

      <nav className="flex items-center gap-1 overflow-x-auto pt-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                isActive
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
