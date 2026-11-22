/**
 * Phase 2B — Migration Audit Manifest & Event Logger
 * Project: Dealership Management (Mother Company ERP)
 *
 * Records structured, sanitized audit entries for all planned and executed operations.
 * Strictly redacts connection strings, tokens, and credentials.
 */

export type MigrationOperationType =
  | "PARTITION_INVENTORY"
  | "ARCHIVE_PREIMAGE"
  | "CREATE_INDEX"
  | "QUARANTINE_RECORD";

export type MigrationOperationStatus =
  | "PLANNED"
  | "VALIDATED"
  | "ARCHIVED"
  | "SIMULATED"
  | "FAILED";

export interface MigrationAuditEntry {
  migrationRunId: string;
  sourceCollection: string;
  sourceId: string;
  targetCollection: string;
  targetId: string;
  operationType: MigrationOperationType;
  beforeHash: string;
  afterHash: string;
  status: MigrationOperationStatus;
  errorDetails?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Sanitizes arbitrary values to prevent logging secrets, passwords, or tokens.
 */
export function sanitizeAuditData(data: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!data) return {};

  const sanitized: Record<string, unknown> = {};
  const secretKeyPatterns = /pass|secret|token|auth|key|cred/i;

  for (const [k, v] of Object.entries(data)) {
    if (secretKeyPatterns.test(k) && typeof v === "string") {
      sanitized[k] = "[REDACTED]";
    } else if (typeof v === "string" && (v.includes("mongodb://") || v.includes("mongodb+srv://"))) {
      sanitized[k] = "[REDACTED_URI]";
    } else if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      sanitized[k] = sanitizeAuditData(v as Record<string, unknown>);
    } else {
      sanitized[k] = v;
    }
  }

  return sanitized;
}

export class MigrationAuditManifest {
  private entries: MigrationAuditEntry[] = [];
  readonly migrationRunId: string;

  constructor(migrationRunId: string) {
    this.migrationRunId = migrationRunId;
  }

  record(entry: Omit<MigrationAuditEntry, "migrationRunId" | "timestamp">): MigrationAuditEntry {
    const fullEntry: MigrationAuditEntry = {
      migrationRunId: this.migrationRunId,
      sourceCollection: entry.sourceCollection,
      sourceId: entry.sourceId,
      targetCollection: entry.targetCollection,
      targetId: entry.targetId,
      operationType: entry.operationType,
      beforeHash: entry.beforeHash,
      afterHash: entry.afterHash,
      status: entry.status,
      errorDetails: entry.errorDetails,
      metadata: sanitizeAuditData(entry.metadata),
      timestamp: new Date().toISOString(),
    };

    this.entries.push(fullEntry);
    return fullEntry;
  }

  getEntries(): MigrationAuditEntry[] {
    return [...this.entries];
  }

  getCount(): number {
    return this.entries.length;
  }

  getFailedEntries(): MigrationAuditEntry[] {
    return this.entries.filter((e) => e.status === "FAILED");
  }

  toJSON(): string {
    return JSON.stringify(
      {
        migrationRunId: this.migrationRunId,
        totalEntries: this.entries.length,
        entries: this.entries,
      },
      null,
      2
    );
  }
}
