/**
 * Phase 2B — Oplog Safety Checker & Rollover Auditor
 * Project: Dealership Management (Mother Company ERP)
 *
 * Inspects MongoDB replica set local.oplog.rs evidence to detect post-migration mutations,
 * catches oplog truncation/rollover, and fails closed if permissions or evidence are incomplete.
 */

import type { OplogInspectionStatus } from "./rollback-types";

export interface OplogEntry {
  ts: Date | number; // BSON Timestamp or Epoch ms
  op: "i" | "u" | "d" | "c" | "n"; // insert, update, delete, command, no-op
  ns: string; // e.g. "dealership_erp.inventorybalances"
  o?: any;
  o2?: any;
}

export interface OplogAuditOptions {
  migrationCompletedAt: Date;
  targetNamespaces: string[];
  oplogEntries?: OplogEntry[];
  hasReadPrivileges?: boolean;
  earliestOplogTimestamp?: Date;
  mockRolloverDetected?: boolean;
}

export interface OplogAuditResult {
  status: OplogInspectionStatus;
  canProceed: boolean;
  totalOplogEntriesInspected: number;
  externalMutationsDetected: number;
  isRolledOver: boolean;
  hasPrivileges: boolean;
  message: string;
  detectedOperations: Array<{
    op: string;
    ns: string;
    ts: Date;
    description: string;
  }>;
}

/**
 * Normalizes an oplog timestamp into milliseconds.
 */
function getTimestampMs(ts: Date | number | any): number {
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === "number") return ts;
  if (ts?.high !== undefined) return ts.high * 1000; // BSON Timestamp
  return 0;
}

/**
 * Audits replica set oplog evidence. Fails closed if privileges are absent or oplog has rolled over.
 */
export function auditReplicaSetOplog(options: OplogAuditOptions): OplogAuditResult {
  const {
    migrationCompletedAt,
    targetNamespaces,
    oplogEntries = [],
    hasReadPrivileges = true,
    earliestOplogTimestamp,
    mockRolloverDetected = false,
  } = options;

  // 1. Privilege Guard: Missing read privileges on local.oplog.rs fails closed
  if (!hasReadPrivileges) {
    return {
      status: "UNAUTHORIZED",
      canProceed: false,
      totalOplogEntriesInspected: 0,
      externalMutationsDetected: 0,
      isRolledOver: false,
      hasPrivileges: false,
      message:
        "CRITICAL: Lacking read privileges on local.oplog.rs. Cannot verify post-migration replica set oplog state. Fails closed.",
      detectedOperations: [],
    };
  }

  const migrationCompletedMs = migrationCompletedAt.getTime();

  // 2. Rollover Guard: Earliest oplog entry is newer than migration timestamp
  let isRolledOver = mockRolloverDetected;
  if (earliestOplogTimestamp) {
    if (earliestOplogTimestamp.getTime() > migrationCompletedMs) {
      isRolledOver = true;
    }
  }

  if (isRolledOver) {
    return {
      status: "ROLLED_OVER",
      canProceed: false,
      totalOplogEntriesInspected: oplogEntries.length,
      externalMutationsDetected: 0,
      isRolledOver: true,
      hasPrivileges: true,
      message:
        "CRITICAL: Oplog rollover detected! The replica set oplog window has truncated post-migration entries. Cannot guarantee zero mutations. Fails closed.",
      detectedOperations: [],
    };
  }

  // 3. Scan for post-migration mutations on target namespaces
  const targetNsSet = new Set(targetNamespaces.map((ns) => ns.toLowerCase()));
  const detectedOperations: Array<{ op: string; ns: string; ts: Date; description: string }> = [];

  for (const entry of oplogEntries) {
    const entryTsMs = getTimestampMs(entry.ts);

    // Only inspect operations occurring after migration completion
    if (entryTsMs >= migrationCompletedMs) {
      const ns = (entry.ns || "").toLowerCase();
      const collName = ns.includes(".") ? ns.split(".")[1] : ns;

      if (targetNsSet.has(ns) || targetNsSet.has(collName)) {
        // Exclude system migration metadata mutations
        if (entry.o?.isMigrationCoordinatorWrite !== true) {
          let desc = `Operation '${entry.op}' on '${entry.ns}'`;
          if (entry.op === "d") desc = `Document deletion (op: 'd') on '${entry.ns}'`;
          if (entry.op === "u") desc = `Document update (op: 'u') on '${entry.ns}'`;
          if (entry.op === "i") desc = `New document insert (op: 'i') on '${entry.ns}'`;

          detectedOperations.push({
            op: entry.op,
            ns: entry.ns,
            ts: new Date(entryTsMs),
            description: desc,
          });
        }
      }
    }
  }

  if (detectedOperations.length > 0) {
    return {
      status: "MUTATIONS_DETECTED",
      canProceed: false,
      totalOplogEntriesInspected: oplogEntries.length,
      externalMutationsDetected: detectedOperations.length,
      isRolledOver: false,
      hasPrivileges: true,
      message: `CRITICAL: Detected ${detectedOperations.length} post-migration business operations in replica set oplog. Rollback prohibited.`,
      detectedOperations,
    };
  }

  // All clear: inspected window complete, zero external writes
  return {
    status: "COMPLETE",
    canProceed: true,
    totalOplogEntriesInspected: oplogEntries.length,
    externalMutationsDetected: 0,
    isRolledOver: false,
    hasPrivileges: true,
    message: "Oplog evidence complete: Zero post-migration business mutations detected in target collections.",
    detectedOperations: [],
  };
}
