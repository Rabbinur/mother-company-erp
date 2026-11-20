"use client";

import React, { useState, useEffect } from "react";
import { ShieldAlert, Search, Eye, X, Filter } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState("");
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [entityFilter]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = entityFilter ? `?entityType=${entityFilter}` : "";
      const res = await fetch(`/api/v1/audit-logs${params}`);
      const json = await res.json();
      if (json.success) setLogs(json.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Immutable Activity Audit Logs
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Complete traceability of user actions, price revisions, inventory adjustments, and orders
          </p>
        </div>

        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-xs"
        >
          <option value="">All Entities</option>
          <option value="order">Sales Orders</option>
          <option value="purchase">Purchases</option>
          <option value="product">Products</option>
          <option value="price">Prices</option>
          <option value="inventory">Inventory Adjustments</option>
          <option value="payment">Payments</option>
          <option value="user">User Management</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Action Code</th>
                <th className="px-4 py-3.5">Actor</th>
                <th className="px-4 py-3.5">Entity Type</th>
                <th className="px-4 py-3.5">Source</th>
                <th className="px-4 py-3.5">Timestamp</th>
                <th className="px-4 py-3.5 text-right">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-slate-400">
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-slate-400">
                    No activity logs recorded.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-900">
                      {log.action}
                    </td>
                    <td className="px-4 py-3.5 text-slate-800">
                      <span className="font-semibold">{log.actorName || log.actorEmail || "System"}</span>
                      {log.actorEmail && (
                        <span className="block text-[10px] text-slate-400">{log.actorEmail}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 uppercase text-[10px] font-bold text-slate-600">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5">
                        {log.entityType}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 uppercase text-[10px]">
                      {log.source || "dashboard"}
                    </td>
                    <td className="px-4 py-3.5 text-slate-400 text-[11px]">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Snapshot Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900 font-mono">
                  {selectedLog.action}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Entity: {selectedLog.entityType} | ID: {selectedLog.entityId || "N/A"}
                </p>
              </div>
              <button onClick={() => setSelectedLog(null)} className="p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 max-h-80 overflow-y-auto text-xs">
              {selectedLog.beforeSnapshot && (
                <div>
                  <span className="font-semibold text-slate-700 block mb-1">Before State:</span>
                  <pre className="rounded-lg bg-slate-50 p-3 text-[11px] font-mono text-slate-800 border">
                    {JSON.stringify(selectedLog.beforeSnapshot, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.afterSnapshot && (
                <div>
                  <span className="font-semibold text-slate-700 block mb-1">After State:</span>
                  <pre className="rounded-lg bg-slate-50 p-3 text-[11px] font-mono text-slate-800 border">
                    {JSON.stringify(selectedLog.afterSnapshot, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t mt-4">
              <button
                onClick={() => setSelectedLog(null)}
                className="rounded-lg border px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-50 font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
