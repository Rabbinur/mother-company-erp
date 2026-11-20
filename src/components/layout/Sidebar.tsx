"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Layers,
  Tags,
  Warehouse,
  Truck,
  ShoppingCart,
  Users,
  Building2,
  RotateCcw,
  CreditCard,
  Receipt,
  BookOpen,
  BarChart3,
  UserCog,
  ShieldAlert,
  ChevronRight,
  LogOut,
  Sliders,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Products & Variants", href: "/products", icon: Package },
  { label: "Categories & Brands", href: "/categories", icon: Layers },
  { label: "Pricing Management", href: "/pricing", icon: Tags },
  { label: "Central Inventory", href: "/inventory", icon: Warehouse },
  { label: "Purchase Orders", href: "/purchases", icon: Truck },
  { label: "Sales Orders", href: "/orders", icon: ShoppingCart },
  { label: "Customers / Retailers", href: "/customers", icon: Users },
  { label: "Vendors / Suppliers", href: "/vendors", icon: Building2 },
  { label: "Returns Management", href: "/returns", icon: RotateCcw },
  { label: "Payments & Receipts", href: "/payments", icon: CreditCard },
  { label: "Operating Expenses", href: "/expenses", icon: Receipt },
  { label: "Financial Accounts", href: "/accounts", icon: BookOpen },
  { label: "Business Reports", href: "/reports", icon: BarChart3 },
  { label: "Staff & User Roles", href: "/users", icon: UserCog },
  { label: "Audit Logs", href: "/audit-logs", icon: ShieldAlert },
];

export function Sidebar({ userRole }: { userRole?: string }) {
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch {
      window.location.href = "/login";
    }
  };

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Brand Heading */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white font-bold shadow-sm">
          MC
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-white">
            MOTHER COMPANY
          </h2>
          <p className="text-xs text-slate-400">Enterprise ERP</p>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-white shadow-sm"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className={cn("h-4 w-4", isActive ? "text-white" : "text-slate-400")} />
                <span>{item.label}</span>
              </div>
              {isActive && <ChevronRight className="h-4 w-4 text-white opacity-80" />}
            </Link>
          );
        })}
      </div>

      {/* Footer Profile & Logout */}
      <div className="border-t border-sidebar-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Role:{" "}
            <span className="font-semibold uppercase text-sky-400">
              {userRole?.replace(/_/g, " ") || "Admin"}
            </span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-950/40 hover:text-red-200 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
