"use client";

import React from "react";
import { GrnItemRow } from "./GrnProductMatchingTable";

interface GrnPhysicalReceivingTableProps {
  items: GrnItemRow[];
  onItemChange: (index: number, updated: Partial<GrnItemRow>) => void;
  isReadOnly?: boolean;
}

export function GrnPhysicalReceivingTable({
  items,
  onItemChange,
  isReadOnly = false,
}: GrnPhysicalReceivingTableProps) {
  const handleQuantityChange = (
    index: number,
    field: "receivedQuantity" | "damagedQuantity" | "rejectedQuantity" | "batchNumber" | "expiryDate",
    value: any
  ) => {
    const current = items[index];
    const updated: Partial<GrnItemRow> = { [field]: value };

    if (field === "receivedQuantity") {
      const rec = Math.max(0, Number(value || 0));
      updated.receivedQuantity = rec;
      updated.shortageQuantity = Math.max(0, current.challanQuantity - rec);
    }

    onItemChange(index, updated);
  };

  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden mb-6">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
          Physical Stock Receiving & Discrepancies
        </h3>
        <p className="text-xs text-zinc-700 dark:text-zinc-300">
          Record actual counted units, damaged items (segregated to quarantine), rejected stock, and batch/expiry info.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850/50 text-zinc-600 dark:text-zinc-400 font-medium">
              <th className="py-2.5 px-3 w-10 text-center font-mono">#</th>
              <th className="py-2.5 px-3 min-w-[180px]">Product</th>
              <th className="py-2.5 px-3 font-mono text-right w-24">Challan Qty</th>
              <th className="py-2.5 px-3 font-mono text-right w-28">Received Qty</th>
              <th className="py-2.5 px-3 font-mono text-right w-24">Shortage</th>
              <th className="py-2.5 px-3 font-mono text-right w-24">Damaged</th>
              <th className="py-2.5 px-3 font-mono text-right w-24">Rejected</th>
              <th className="py-2.5 px-3 min-w-[140px]">Batch Number</th>
              <th className="py-2.5 px-3 min-w-[140px]">Expiry Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {items.map((item, idx) => {
              const shortage = Math.max(0, item.challanQuantity - (item.receivedQuantity || 0));
              const hasShortage = shortage > 0;
              const hasDamage = (item.damagedQuantity || 0) > 0;

              return (
                <tr key={idx} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-850/30 transition-colors">
                  <td className="py-2.5 px-3 text-center font-mono text-zinc-700 dark:text-zinc-300">
                    {item.lineItemNumber}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">{item.productName}</div>
                    {item.matchedVariantName && (
                      <div className="text-xs font-mono text-zinc-700 dark:text-zinc-300">
                        {item.matchedVariantName}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                    {item.challanQuantity}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {isReadOnly ? (
                      <span className="font-mono tabular-nums text-zinc-900 dark:text-zinc-100 font-medium">
                        {item.receivedQuantity}
                      </span>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        value={item.receivedQuantity}
                        onChange={(e) => handleQuantityChange(idx, "receivedQuantity", e.target.value)}
                        className="w-20 text-xs font-mono text-right rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                      />
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-right tabular-nums">
                    <span className={hasShortage ? "text-amber-600 dark:text-amber-400 font-medium" : "text-zinc-700 dark:text-zinc-300"}>
                      {shortage > 0 ? `-${shortage}` : "0"}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {isReadOnly ? (
                      <span className={`font-mono tabular-nums ${hasDamage ? "text-rose-600 font-medium" : "text-zinc-400"}`}>
                        {item.damagedQuantity || 0}
                      </span>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        value={item.damagedQuantity || 0}
                        onChange={(e) => handleQuantityChange(idx, "damagedQuantity", Number(e.target.value))}
                        className="w-16 text-xs font-mono text-right rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                      />
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {isReadOnly ? (
                      <span className="font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                        {item.rejectedQuantity || 0}
                      </span>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        value={item.rejectedQuantity || 0}
                        onChange={(e) => handleQuantityChange(idx, "rejectedQuantity", Number(e.target.value))}
                        className="w-16 text-xs font-mono text-right rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                      />
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    {isReadOnly ? (
                      <span className="font-mono text-zinc-700 dark:text-zinc-300">{item.batchNumber || "-"}</span>
                    ) : (
                      <input
                        type="text"
                        placeholder="e.g. B-901"
                        value={item.batchNumber || ""}
                        onChange={(e) => handleQuantityChange(idx, "batchNumber", e.target.value)}
                        className="w-full text-xs font-mono rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                      />
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    {isReadOnly ? (
                      <span className="font-mono text-zinc-700 dark:text-zinc-300">
                        {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : "-"}
                      </span>
                    ) : (
                      <input
                        type="date"
                        value={item.expiryDate ? String(item.expiryDate).slice(0, 10) : ""}
                        onChange={(e) => handleQuantityChange(idx, "expiryDate", e.target.value)}
                        className="w-full text-xs font-mono rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
