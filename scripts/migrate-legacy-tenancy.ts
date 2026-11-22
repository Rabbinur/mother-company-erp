/**
 * Phase 2B — Legacy Tenancy Migration Engine CLI & Coordinator
 * Project: Dealership Management (Mother Company ERP)
 *
 * Implements dry-run migration planning, BSON pre-image archiving, inventory partitioning,
 * quarantine isolation, and fail-closed safety guards.
 *
 * STRICT GOVERNANCE RULE:
 * Live 'apply' mode is permanently blocked in this phase. Dry-run performs ZERO database writes.
 */

import path from "node:path";
import { pathToFileURL } from "node:url";

import { ERP_SYSTEM_NAME, type MigrationMode } from "../src/lib/migration/constants";
import { maskMongoUri, isRemoteClusterUri, validateMigrationMode } from "../src/lib/migration/safe-env";
import { buildMigrationPlan, type MigrationPlanReport, type MigrationPlanOptions } from "../src/lib/migration/migration-plan";
import type { LegacyInventoryBalance, DealershipAllocationRule } from "../src/lib/migration/inventory-partitioner";
import { validateMigrationLock, type MigrationLockPayload } from "../src/lib/migration/fence-guard";

export interface MigrationEngineOptions extends MigrationPlanOptions {
  mode?: MigrationMode;
  allowRemote?: boolean;
  mongoUri?: string;
  sourceBalances?: LegacyInventoryBalance[];
  allocationRulesMap?: Map<string, DealershipAllocationRule[]>;
  lockPayload?: MigrationLockPayload;
}

export interface MigrationEngineResult {
  erpName: string;
  mode: MigrationMode;
  targetUriMasked: string;
  status: "PLAN_READY" | "BLOCKED" | "FAILED";
  exitCode: number;
  message: string;
  planReport?: MigrationPlanReport;
  error?: string;
}

export class LiveMigrationNotAuthorizedError extends Error {
  constructor(message = "LIVE_MIGRATION_NOT_AUTHORIZED: Live migration execution is strictly forbidden in Phase 2B Step 2. Only dry-run and planning validation are authorized.") {
    super(message);
    this.name = "LiveMigrationNotAuthorizedError";
  }
}

/**
 * Runs the migration engine in dry-run mode or safely blocks apply mode.
 */
export async function runMigrationEngine(
  options: MigrationEngineOptions = {}
): Promise<MigrationEngineResult> {
  const mode: MigrationMode = validateMigrationMode(options.mode);
  const rawUri = options.mongoUri || process.env.MONGODB_URI || process.env.MONGODB_URL || null;
  const maskedUri = maskMongoUri(rawUri);

  // 1. SAFETY GUARD: Strictly block apply mode
  if (mode === "apply") {
    const errorMsg =
      "LIVE_MIGRATION_NOT_AUTHORIZED: Live migration execution is strictly forbidden in Phase 2B Step 2. " +
      "Only dry-run planning and isolated in-memory verification are authorized. Migration remains paused.";
    return {
      erpName: ERP_SYSTEM_NAME,
      mode: "apply",
      targetUriMasked: maskedUri,
      status: "BLOCKED",
      exitCode: 1,
      message: errorMsg,
      error: errorMsg,
    };
  }

  // 2. REMOTE CONNECTION SAFETY GUARD
  const isRemote = isRemoteClusterUri(rawUri);
  if (isRemote && !options.allowRemote) {
    const errorMsg =
      "CRITICAL SAFETY VIOLATION: Remote MongoDB cluster access blocked during migration run without explicit --allow-remote flag.";
    return {
      erpName: ERP_SYSTEM_NAME,
      mode,
      targetUriMasked: maskedUri,
      status: "FAILED",
      exitCode: 1,
      message: errorMsg,
      error: errorMsg,
    };
  }

  // 3. FENCE / LOCK VERIFICATION
  if (options.lockPayload) {
    const lockCheck = validateMigrationLock(
      options.lockPayload,
      options.coordinatorId || "COORDINATOR_PROCESS",
      1
    );
    if (!lockCheck.isValid) {
      return {
        erpName: ERP_SYSTEM_NAME,
        mode,
        targetUriMasked: maskedUri,
        status: "FAILED",
        exitCode: 1,
        message: `Write-fence lock validation failed: ${lockCheck.error}`,
        error: lockCheck.error,
      };
    }
  }

  // 4. PLAN GENERATION & ARCHIVE VERIFICATION (Pure Dry-Run)
  try {
    const sourceBalances = options.sourceBalances || [];
    const allocationRulesMap = options.allocationRulesMap || new Map();

    const planReport = buildMigrationPlan(sourceBalances, allocationRulesMap, {
      runId: options.runId,
      businessId: options.businessId,
      businessName: options.businessName,
      ownerId: options.ownerId,
      mockLargeDocSize: options.mockLargeDocSize,
    });

    return {
      erpName: ERP_SYSTEM_NAME,
      mode: "dry-run",
      targetUriMasked: maskedUri,
      status: "PLAN_READY",
      exitCode: 0,
      message:
        `Dry-run migration plan successfully generated and verified. ` +
        `Zero writes executed. Planned partitions: ${planReport.summary.totalTargetPartitions}, ` +
        `Quarantined: ${planReport.summary.totalQuarantinedPartitions}, ` +
        `Pre-images verified: ${planReport.summary.totalPreImages}.`,
      planReport,
    };
  } catch (err: any) {
    return {
      erpName: ERP_SYSTEM_NAME,
      mode,
      targetUriMasked: maskedUri,
      status: "FAILED",
      exitCode: 1,
      message: `Migration planning failed: ${err.message}`,
      error: err.message,
    };
  }
}

/**
 * Formats a terminal summary of the migration result
 */
export function formatMigrationOutput(result: MigrationEngineResult): string {
  const divider = "=".repeat(78);
  const subDivider = "-".repeat(78);
  const lines: string[] = [];

  lines.push(divider);
  lines.push(`  LEGACY TENANCY MIGRATION ENGINE — ${result.erpName}`);
  lines.push(divider);
  lines.push(`  Mode      : ${result.mode.toUpperCase()}`);
  lines.push(`  Target URI: ${result.targetUriMasked}`);
  lines.push(`  Status    : [${result.status}]`);
  lines.push(`  Message   : ${result.message}`);
  lines.push(subDivider);

  if (result.planReport) {
    const s = result.planReport.summary;
    const r = result.planReport.reconciliation;
    lines.push(`  Migration Run ID : ${result.planReport.migrationRunId}`);
    lines.push(`  Execution Stage  : ${result.planReport.stage}`);
    lines.push(`  Source Balances  : ${s.totalSourceBalances}`);
    lines.push(`  Target Partitions: ${s.totalTargetPartitions} (Active: ${s.totalActivePartitions}, Quarantined: ${s.totalQuarantinedPartitions})`);
    lines.push(`  Pre-Image Archive: ${s.totalPreImages} (Inline: ${s.totalInlinePreImages}, GridFS: ${s.totalGridFsPreImages})`);
    lines.push(`  Planned Indexes  : ${s.plannedIndexes}`);
    lines.push(`  Reconciliation   : Source OnHand=${r.sourceTotalOnHand} == Target OnHand=${r.targetTotalOnHand} (${r.isBalanced ? "BALANCED" : "DISCREPANCY"})`);
    lines.push(subDivider);
    lines.push(`  SAFETY NOTICE: Dry-run complete. ZERO database writes executed. Live apply remains blocked.`);
  }

  lines.push(divider);
  return lines.join("\n");
}

/**
 * CLI Main Entry Point
 */
async function main() {
  const args = process.argv.slice(2);
  const modeArg = args.find((a) => a.startsWith("--mode="))?.split("=")[1] || (args.includes("--dry-run") ? "dry-run" : undefined);
  const businessName = args.find((a) => a.startsWith("--business-name="))?.split("=")[1];
  const ownerId = args.find((a) => a.startsWith("--owner-id="))?.split("=")[1];
  const runId = args.find((a) => a.startsWith("--run-id="))?.split("=")[1];
  const allowRemote = args.includes("--allow-remote");
  const jsonOutput = args.includes("--json");

  let mode: MigrationMode = "dry-run";
  try {
    mode = validateMigrationMode(modeArg || "dry-run");
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }

  const result = await runMigrationEngine({
    mode,
    businessName,
    ownerId,
    runId,
    allowRemote,
  });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatMigrationOutput(result));
  }

  process.exit(result.exitCode);
}

// Execute main if invoked directly
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error("Fatal migration engine error:", err);
    process.exit(1);
  });
}
