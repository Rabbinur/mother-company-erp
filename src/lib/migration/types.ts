/**
 * Migration & Preflight Type Definitions
 * Project: Dealership Management (Mother Company ERP)
 */

import type { MigrationMode, TargetCollectionName } from "./constants";

export type CheckStatus = "PASSED" | "FAILED" | "WARNING" | "NOT_IMPLEMENTED" | "SKIPPED";

export type CheckCategory =
  | "ENVIRONMENT"
  | "SCHEMA_INDEX"
  | "DATA_INTEGRITY"
  | "LOCK_STATE"
  | "TRANSACTION_OUTCOMES";

export interface PreflightCheckResult {
  id: string;
  name: string;
  category: CheckCategory;
  status: CheckStatus;
  critical: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface PreflightSummary {
  total: number;
  passed: number;
  failed: number;
  warnings: number;
  notImplemented: number;
  skipped: number;
}

export interface PreflightReport {
  timestamp: string;
  erpName: string;
  mode: MigrationMode;
  targetUriMasked: string;
  isEligibleForMigration: boolean;
  summary: PreflightSummary;
  checks: PreflightCheckResult[];
}

export interface PreflightOptions {
  mode?: MigrationMode;
  allowRemote?: boolean;
  mongoUri?: string;
  jsonOutput?: boolean;
  outputPath?: string;
  db?: any; // Mongoose db or native Db connection (for in-memory fixtures)
}
