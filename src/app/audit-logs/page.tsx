"use client";

import React, { useState, useMemo } from "react";
import { ShieldAlert, Eye } from "lucide-react";
import {
  PageHeader,
  DataTable,
  ColumnDef,
  StatusBadge,
  Modal,
  Select,
  Pagination,
} from "@/components/shared";
import { formatDate } from "@/lib/utils";
import { useDataQuery } from "@/hooks/useDataQuery";

interface AuditLogItem {
  _id: string;
  createdAt: string;
  actorEmail?: string;
  action: string;
  entityType: string;
  entityId: string;
  ipAddress?: string;
  details?: Record<string, unknown>;
  beforeSnapshot?: Record<string, unknown>;
  afterSnapshot?: Record<string, unknown>;
}

const ENTITY_OPTIONS = [
  { value: "", label: "All Audit Entities" },
  { value: "order", label: "Sales Orders" },
  { value: "purchase", label: "Purchases" },
  { value: "product", label: "Products" },
  { value: "price", label: "Prices" },
  { value: "inventory", label: "Inventory Adjustments" },
  { value: "payment", label: "Payments" },
  { value: "user", label: "User Management" },
];

/**
 * AuditLogsPage - Refactored with Reusable Components adhering to SOLID
 */
export default function AuditLogsPage() {
  const [entityFilter, setEntityFilter] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const {
    data: logs,
    loading,
    page,
    totalPages,
    total,
    setPage,
    setParams,
  } = useDataQuery<AuditLogItem>({
    url: "/api/v1/audit-logs",
    initialParams: { entityType: entityFilter },
  });

  const handleEntityChange = (entityType: string) => {
    setEntityFilter(entityType);
    setPage(1);
    setParams((prev) => ({ ...prev, entityType }));
  };

  const columns: ColumnDef<AuditLogItem>[] = useMemo(
    () => [
      {
        header: "Timestamp",
        cell: (log) => (
          <span className="font-mono text-slate-500 text-[11px]">
            {formatDate(log.createdAt)}
          </span>
        ),
      },
      {
        header: "Actor / User",
        cell: (log) => (
          <span className="font-semibold text-slate-900">
            {log.actorEmail || "system"}
          </span>
        ),
      },
      {
        header: "Action Performed",
        cell: (log) => (
          <span className="font-mono text-[11px] font-semibold text-slate-700 uppercase">
            {log.action}
          </span>
        ),
      },
      {
        header: "Entity Scope",
        cell: (log) => (
          <div>
            <span className="capitalize text-slate-700 font-medium">{log.entityType}</span>
            <div className="font-mono text-[10px] text-slate-400">ID: {log.entityId}</div>
          </div>
        ),
      },
      {
        header: "IP Address",
        cell: (log) => (
          <span className="font-mono text-slate-400">{log.ipAddress || "127.0.0.1"}</span>
        ),
      },
      {
        header: "Audit Snapshot",
        align: "center",
        cell: (log) => (
          <button
            type="button"
            onClick={() => setSelectedLog(log)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
          >
            <Eye className="h-3.5 w-3.5 text-slate-500" />
            <span>Details</span>
          </button>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Immutable Activity Audit Logs"
        description="Complete traceability of user actions, price revisions, inventory adjustments, and order workflows"
        actions={
          <Select
            options={ENTITY_OPTIONS}
            value={entityFilter}
            onChange={(e) => handleEntityChange(e.target.value)}
            className="w-48"
          />
        }
      />

      <DataTable
        columns={columns}
        data={logs}
        loading={loading}
        emptyMessage="No audit log entries recorded for this filter criteria."
      />

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
      />

      {/* Snapshot Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Audit Event Details"
        description={
          selectedLog
            ? `${selectedLog.action} on ${selectedLog.entityType} (${selectedLog.entityId})`
            : "Audit Details"
        }
        size="lg"
        footer={
          <button
            type="button"
            onClick={() => setSelectedLog(null)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        }
      >
        {selectedLog && (
          <div className="space-y-3">
            <div>
              <span className="font-semibold text-slate-900">Actor:</span>{" "}
              <span className="font-mono text-slate-700">{selectedLog.actorEmail}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-900">Logged At:</span>{" "}
              <span className="font-mono text-slate-700">{formatDate(selectedLog.createdAt)}</span>
            </div>

            {selectedLog.beforeSnapshot && (
              <div>
                <span className="font-semibold text-slate-900 block mb-1">Before Snapshot:</span>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-[11px] font-mono overflow-x-auto max-h-48">
                  {JSON.stringify(selectedLog.beforeSnapshot, null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.afterSnapshot && (
              <div>
                <span className="font-semibold text-slate-900 block mb-1">After Snapshot:</span>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-[11px] font-mono overflow-x-auto max-h-48">
                  {JSON.stringify(selectedLog.afterSnapshot, null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.details && (
              <div>
                <span className="font-semibold text-slate-900 block mb-1">Details:</span>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-[11px] font-mono overflow-x-auto max-h-48">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
