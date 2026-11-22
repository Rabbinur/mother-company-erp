/**
 * Phase 2B — Legacy Tenancy Rollback Engine CLI & Coordinator
 * Project: Dealership Management (Mother Company ERP)
 *
 * Implements safe rollback inspection, deterministic plan generation, 3-layer safety validation,
 * and fail-closed safety guards.
 *
 * STRICT GOVERNANCE RULE:
 * Live 'apply' mode is permanently blocked in this phase with LIVE_ROLLBACK_NOT_AUTHORIZED.
 * Zero database writes executed.
 */

import path from "node:path";
import { pathToFileURL } from "node:url";

import { ERP_SYSTEM_NAME } from "../src/lib/migration/constants";
import { maskMongoUri, isRemoteClusterUri } from "../src/lib/migration/safe-env";
import { buildRollbackPlan, type RollbackPlannerOptions } from "../src/lib/migration/rollback-plan";
import type { RollbackPlanReport } from "../src/lib/migration/rollback-types";

export interface RollbackEngineOptions extends RollbackPlannerOptions {
  allowRemote?: boolean;
  mongoUri?: string;
}

export interface RollbackEngineResult {
  erpName: string;
  mode: "inspect" | "dry-run" | "apply";
  targetUriMasked: string;
  status: "PLAN_READY" | "INSPECTED" | "BLOCKED" | "FAILED";
  exitCode: number;
  message: string;
  planReport?: RollbackPlanReport;
  error?: string;
}

export class LiveRollbackNotAuthorizedError extends Error {
  constructor(
    message = "LIVE_ROLLBACK_NOT_AUTHORIZED: Automated live rollback is strictly prohibited. Recovery in live environments requires manual Point-in-Time Recovery (PITR)."
  ) {
    super(message);
    this.name = "LiveRollbackNotAuthorizedError";
  }
}

/**
 * Runs the rollback engine in inspect or dry-run mode, and permanently blocks apply mode.
 */
export async function runRollbackEngine(
  options: RollbackEngineOptions
): Promise<RollbackEngineResult> {
  const mode = options.mode || "inspect";
  const rawUri = options.mongoUri || process.env.MONGODB_URI || process.env.MONGODB_URL || null;
  const maskedUri = maskMongoUri(rawUri);

  // 1. SAFETY GUARD: Strictly block apply mode
  if (mode === "apply") {
    const errorMsg =
      "LIVE_ROLLBACK_NOT_AUTHORIZED: Automated live rollback is strictly prohibited in Phase 2B Step 3. " +
      "Once business operations have resumed, automated document restoration is permanently forbidden to protect financial and inventory state. " +
      "Manual Point-in-Time Recovery (PITR) via Atlas snapshot is mandatory.";
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
      "CRITICAL SAFETY VIOLATION: Remote MongoDB cluster access blocked during rollback run without explicit --allow-remote flag.";
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

  // 3. BUILD AND EVALUATE ROLLBACK PLAN
  try {
    const planReport = buildRollbackPlan({
      ...options,
      mode,
    });

    const isInspect = mode === "inspect";
    const status = isInspect ? "INSPECTED" : planReport.isEligibleForRollback ? "PLAN_READY" : "BLOCKED";
    const exitCode = isInspect ? 0 : planReport.isEligibleForRollback ? 0 : 1;

    let message = isInspect
      ? `Rollback inspection complete. Found ${planReport.summary.totalMigratedDocuments} records. Safe: ${planReport.summary.safeToRestoreCount}, Conflicts: ${planReport.summary.conflictCount}.`
      : planReport.isEligibleForRollback
      ? `Rollback dry-run plan generated and validated. 100% of 3-layer safety gates passed. Zero database writes executed.`
      : `Rollback dry-run plan blocked due to safety gate or document conflict violations. Zero database writes executed.`;

    return {
      erpName: ERP_SYSTEM_NAME,
      mode,
      targetUriMasked: maskedUri,
      status,
      exitCode,
      message,
      planReport,
    };
  } catch (err: any) {
    return {
      erpName: ERP_SYSTEM_NAME,
      mode,
      targetUriMasked: maskedUri,
      status: "FAILED",
      exitCode: 1,
      message: `Rollback planning error: ${err.message}`,
      error: err.message,
    };
  }
}

/**
 * Formats terminal summary output for rollback engine execution.
 */
export function formatRollbackOutput(result: RollbackEngineResult): string {
  const divider = "=".repeat(78);
  const subDivider = "-".repeat(78);
  const lines: string[] = [];

  lines.push(divider);
  lines.push(`  LEGACY TENANCY ROLLBACK ENGINE — ${result.erpName}`);
  lines.push(divider);
  lines.push(`  Mode      : ${result.mode.toUpperCase()}`);
  lines.push(`  Target URI: ${result.targetUriMasked}`);
  lines.push(`  Status    : [${result.status}]`);
  lines.push(`  Message   : ${result.message}`);
  lines.push(subDivider);

  if (result.planReport) {
    const s = result.planReport.summary;
    const g = result.planReport.safetyGates;
    lines.push(`  Migration Run ID : ${result.planReport.migrationRunId}`);
    lines.push(`  Rollback Run ID  : ${result.planReport.rollbackRunId}`);
    lines.push(
      `  Safety Gates     : Freeze=${g.layerAFreeze.passed ? "PASS" : "FAIL"} | Oplog=${g.layerBOplog.passed ? "PASS" : "FAIL"} | Integrity=${g.layerCIntegrity.passed ? "PASS" : "FAIL"}`
    );
    lines.push(
      `  Documents        : Total=${s.totalMigratedDocuments} | Safe=${s.safeToRestoreCount} | Conflict=${s.conflictCount} | MissingPreImage=${s.missingPreImageCount} | Blocked=${s.blockedCount}`
    );
    lines.push(`  Eligibility      : ${result.planReport.isEligibleForRollback ? "[ELIGIBLE FOR ROLLBACK DRY-RUN]" : "[ROLLBACK INELIGIBLE / BLOCKED]"}`);
    lines.push(subDivider);
    lines.push(`  SAFETY NOTICE: Rollback dry-run complete. ZERO database writes executed. Live apply remains permanently blocked.`);
  }

  lines.push(divider);
  return lines.join("\n");
}

/**
 * CLI Main Entry Point
 */
async function main() {
  const args = process.argv.slice(2);
  const modeArg =
    args.find((a) => a.startsWith("--mode="))?.split("=")[1] ||
    (args.includes("--dry-run") ? "dry-run" : args.includes("--inspect") ? "inspect" : "inspect");
  const runId = args.find((a) => a.startsWith("--run-id="))?.split("=")[1] || "MIG-UNKNOWN";
  const rollbackRunId = args.find((a) => a.startsWith("--rollback-run-id="))?.split("=")[1];
  const allowRemote = args.includes("--allow-remote");
  const jsonOutput = args.includes("--json");

  let mode: "inspect" | "dry-run" | "apply" = "inspect";
  if (modeArg === "dry-run" || modeArg === "apply" || modeArg === "inspect") {
    mode = modeArg;
  }

  const result = await runRollbackEngine({
    migrationRunId: runId,
    rollbackRunId,
    mode,
    allowRemote,
  });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatRollbackOutput(result));
  }

  process.exit(result.exitCode);
}

// Execute main if invoked directly
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error("Fatal rollback engine error:", err);
    process.exit(1);
  });
}
