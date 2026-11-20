import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Bangladesh Currency Formatter (৳ BDT)
 * Accurately formats integer poisha or standard decimal amounts.
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "৳0.00";
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(amount)
    .replace("BDT", "৳")
    .trim();
}

/**
 * Standard Date Formatter
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "N/A";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Short Date Formatter (DD Mon YYYY)
 */
export function formatShortDate(date: Date | string | null | undefined): string {
  if (!date) return "N/A";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format Status Badges
 */
export function formatStatus(status: string): string {
  if (!status) return "";
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Generate sequential human-readable codes (e.g. ORD-202611-0001, PUR-202611-0001)
 */
export function generateReferenceCode(prefix: string, sequenceNumber: number): string {
  const dateStr = new Date().toISOString().slice(0, 7).replace("-", "");
  const padded = String(sequenceNumber).padStart(4, "0");
  return `${prefix}-${dateStr}-${padded}`;
}

/**
 * Safe integer conversion for poisha / currency arithmetic to prevent floating point inaccuracies
 */
export function toPoisha(bdt: number): number {
  return Math.round((bdt || 0) * 100);
}

export function fromPoisha(poisha: number): number {
  return (poisha || 0) / 100;
}
