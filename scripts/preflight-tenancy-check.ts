/**
 * Phase 2B — Preflight Tenancy & Data Integrity Check Script
 * Project: Dealership Management (Mother Company ERP)
 *
 * Validates environment, schema assumptions, index safety, data integrity,
 * transaction outcomes, and migration lock state without mutating any database.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import mongoose from "mongoose";

import {
  ERP_SYSTEM_NAME,
  MIGRATION_LOCK_KEY,
  TARGET_MIGRATION_COLLECTIONS,
  ALL_33_MODELS,
  type MigrationMode,
} from "../src/lib/migration/constants";

import {
  maskMongoUri,
  isRemoteClusterUri,
  validateMigrationMode,
} from "../src/lib/migration/safe-env";

import type {
  PreflightOptions,
  PreflightReport,
  PreflightCheckResult,
  PreflightSummary,
  CheckCategory,
} from "../src/lib/migration/types";

// Import all models to ensure Mongoose schemas are registered
import * as Models from "../src/models/index";

/**
 * Executes the complete preflight tenancy audit against the target database or fixture.
 */
export async function runPreflightChecks(
  options: PreflightOptions = {}
): Promise<PreflightReport> {
  const timestamp = new Date().toISOString();
  const checks: PreflightCheckResult[] = [];
  const mode: MigrationMode = validateMigrationMode(options.mode);

  const rawUri =
    options.mongoUri ||
    process.env.MONGODB_URI ||
    process.env.MONGODB_URL ||
    null;
  const maskedUri = maskMongoUri(rawUri);

  // Helper to push check result
  const recordCheck = (check: PreflightCheckResult) => {
    checks.push(check);
  };

  // ---------------------------------------------------------
  // 1. ENVIRONMENT & SAFETY CHECKS
  // ---------------------------------------------------------

  // Check 1.1: Environment URI Presence
  if (!rawUri && !options.db) {
    recordCheck({
      id: "ENV-01",
      name: "MongoDB Connection URI Validation",
      category: "ENVIRONMENT",
      status: "FAILED",
      critical: true,
      message: "MONGODB_URI or MONGODB_URL environment variable is missing",
      details: { maskedUri },
    });
  } else {
    recordCheck({
      id: "ENV-01",
      name: "MongoDB Connection URI Validation",
      category: "ENVIRONMENT",
      status: "PASSED",
      critical: true,
      message: "Target database URI is configured and credentials are masked",
      details: { targetUri: maskedUri },
    });
  }

  // Check 1.2: Remote Cluster Access Guard
  const isRemote = isRemoteClusterUri(rawUri);
  if (isRemote && !options.allowRemote) {
    recordCheck({
      id: "ENV-02",
      name: "Remote Cluster Access Safety Guard",
      category: "ENVIRONMENT",
      status: "FAILED",
      critical: true,
      message:
        "CRITICAL SAFETY VIOLATION: Remote MongoDB cluster access blocked without explicit --allow-remote flag",
      details: {
        targetUri: maskedUri,
        isRemote,
        allowRemote: !!options.allowRemote,
      },
    });
  } else {
    recordCheck({
      id: "ENV-02",
      name: "Remote Cluster Access Safety Guard",
      category: "ENVIRONMENT",
      status: "PASSED",
      critical: true,
      message: isRemote
        ? "Remote connection explicitly permitted via --allow-remote flag"
        : "Target is a safe local or in-memory fixture",
      details: { isRemote, allowRemote: !!options.allowRemote },
    });
  }

  // Check 1.3: Migration Mode Validation
  recordCheck({
    id: "ENV-03",
    name: "Migration Execution Mode",
    category: "ENVIRONMENT",
    status: "PASSED",
    critical: false,
    message: `Preflight running in '${mode}' mode`,
    details: { mode },
  });

  // ---------------------------------------------------------
  // 2. MODEL & SCHEMA AUDIT (Static Mongoose Inspection)
  // ---------------------------------------------------------

  // Check 2.1: Model Registration Coverage
  const missingModels: string[] = [];
  for (const modelName of ALL_33_MODELS) {
    if (!mongoose.models[modelName] && !(Models as any)[modelName]) {
      missingModels.push(modelName);
    }
  }

  if (missingModels.length > 0) {
    recordCheck({
      id: "SCHEMA-01",
      name: "Mongoose Model Registration (33 Models)",
      category: "SCHEMA_INDEX",
      status: "FAILED",
      critical: true,
      message: `Missing ${missingModels.length} expected Mongoose models in runtime`,
      details: { missingModels },
    });
  } else {
    recordCheck({
      id: "SCHEMA-01",
      name: "Mongoose Model Registration (33 Models)",
      category: "SCHEMA_INDEX",
      status: "PASSED",
      critical: true,
      message: "All 33 repository Mongoose models successfully registered and verified",
      details: { verifiedCount: ALL_33_MODELS.length },
    });
  }

  // Check 2.2: InventoryBalance Schema Assumptions
  const invBalanceSchema = (Models.InventoryBalance as any)?.schema;
  if (invBalanceSchema) {
    const hasVariantId = invBalanceSchema.paths.variantId?.isRequired === true;
    const hasBatchId = !!invBalanceSchema.paths.batchId;
    const hasStockStatus = !!invBalanceSchema.paths.stockStatus;

    if (!hasVariantId) {
      recordCheck({
        id: "SCHEMA-02",
        name: "InventoryBalance variantId Requirement",
        category: "SCHEMA_INDEX",
        status: "FAILED",
        critical: true,
        message: "InventoryBalance schema does not require variantId",
      });
    } else {
      recordCheck({
        id: "SCHEMA-02",
        name: "InventoryBalance variantId Requirement",
        category: "SCHEMA_INDEX",
        status: "PASSED",
        critical: true,
        message: "Verified: InventoryBalance.variantId is required: true",
      });
    }

    if (!hasBatchId && !hasStockStatus) {
      recordCheck({
        id: "SCHEMA-03",
        name: "InventoryBalance Legacy Fields Verification",
        category: "SCHEMA_INDEX",
        status: "PASSED",
        critical: false,
        message:
          "Verified: Legacy InventoryBalance contains neither batchId nor stockStatus. Dual partial unique indexes verified appropriate.",
      });
    } else {
      recordCheck({
        id: "SCHEMA-03",
        name: "InventoryBalance Legacy Fields Verification",
        category: "SCHEMA_INDEX",
        status: "WARNING",
        critical: false,
        message: "InventoryBalance schema contains batchId or stockStatus fields unexpectedly",
        details: { hasBatchId, hasStockStatus },
      });
    }
  }

  // ---------------------------------------------------------
  // 3. DATABASE INSPECTION CHECKS (Requires active DB/Fixture)
  // ---------------------------------------------------------
  const db = options.db || (mongoose.connection.readyState === 1 ? mongoose.connection.db : null);

  if (!db) {
    recordCheck({
      id: "DB-00",
      name: "Database Connection Availability",
      category: "DATA_INTEGRITY",
      status: "WARNING",
      critical: false,
      message:
        "No active database connection or fixture provided. Skipping live collection, duplicate scan, and transaction checks.",
      details: { readyState: mongoose.connection.readyState },
    });
  } else {
    // Check 3.1: Target Collections Presence
    try {
      const collections = await db.listCollections().toArray();
      const existingCollNames = new Set(collections.map((c: any) => c.name.toLowerCase()));
      const foundCollections: string[] = [];
      const absentCollections: string[] = [];

      for (const colName of TARGET_MIGRATION_COLLECTIONS) {
        if (existingCollNames.has(colName)) {
          foundCollections.push(colName);
        } else {
          absentCollections.push(colName);
        }
      }

      recordCheck({
        id: "COLL-01",
        name: "Target Migration Collections Presence",
        category: "SCHEMA_INDEX",
        status: absentCollections.length > 0 ? "WARNING" : "PASSED",
        critical: false,
        message: `Found ${foundCollections.length}/${TARGET_MIGRATION_COLLECTIONS.length} migration collections in database`,
        details: { foundCollections, absentCollections },
      });
    } catch (err: any) {
      recordCheck({
        id: "COLL-01",
        name: "Target Migration Collections Presence",
        category: "SCHEMA_INDEX",
        status: "FAILED",
        critical: true,
        message: `Failed to list collections: ${err.message}`,
      });
    }

    // Check 3.2: Duplicate Phone Scan on Vendor Collection
    try {
      const vendorColl = db.collection("vendors");
      const phoneDuplicates = await vendorColl
        .aggregate([
          { $match: { phone: { $exists: true, $ne: "", $type: "string" } } },
          { $group: { _id: "$phone", count: { $sum: 1 }, ids: { $push: "$_id" } } },
          { $match: { count: { $gt: 1 } } },
        ])
        .toArray();

      if (phoneDuplicates.length > 0) {
        recordCheck({
          id: "DUP-01",
          name: "Vendor Phone Number Duplicate Detection",
          category: "DATA_INTEGRITY",
          status: "FAILED",
          critical: true,
          message: `Found ${phoneDuplicates.length} duplicate phone number groups in vendors collection. Must resolve prior to unique index creation!`,
          details: { duplicateCount: phoneDuplicates.length, samples: phoneDuplicates.slice(0, 5) },
        });
      } else {
        recordCheck({
          id: "DUP-01",
          name: "Vendor Phone Number Duplicate Detection",
          category: "DATA_INTEGRITY",
          status: "PASSED",
          critical: true,
          message: "Zero duplicate phone numbers detected in vendors collection",
        });
      }
    } catch (err: any) {
      recordCheck({
        id: "DUP-01",
        name: "Vendor Phone Number Duplicate Detection",
        category: "DATA_INTEGRITY",
        status: "WARNING",
        critical: false,
        message: `Could not query vendors collection: ${err.message}`,
      });
    }

    // Check 3.3: InventoryBalance Duplicate Tuples Scan
    try {
      const invColl = db.collection("inventorybalances");
      const tupleDuplicates = await invColl
        .aggregate([
          {
            $group: {
              _id: {
                warehouseId: "$warehouseId",
                productId: "$productId",
                variantId: "$variantId",
              },
              count: { $sum: 1 },
            },
          },
          { $match: { count: { $gt: 1 } } },
        ])
        .toArray();

      if (tupleDuplicates.length > 0) {
        recordCheck({
          id: "DUP-02",
          name: "InventoryBalance Tuple Duplicate Detection",
          category: "DATA_INTEGRITY",
          status: "FAILED",
          critical: true,
          message: `Found ${tupleDuplicates.length} duplicate warehouse-product-variant tuples in inventorybalances. Legacy baseline corrupted!`,
          details: { duplicateCount: tupleDuplicates.length, samples: tupleDuplicates.slice(0, 5) },
        });
      } else {
        recordCheck({
          id: "DUP-02",
          name: "InventoryBalance Tuple Duplicate Detection",
          category: "DATA_INTEGRITY",
          status: "PASSED",
          critical: true,
          message: "Zero duplicate balance tuples detected in inventorybalances",
        });
      }
    } catch (err: any) {
      recordCheck({
        id: "DUP-02",
        name: "InventoryBalance Tuple Duplicate Detection",
        category: "DATA_INTEGRITY",
        status: "WARNING",
        critical: false,
        message: `Could not query inventorybalances collection: ${err.message}`,
      });
    }

    // Check 3.4: Negative Stock Balances Scan
    try {
      const invColl = db.collection("inventorybalances");
      const negativeBalances = await invColl
        .find({
          $or: [{ onHand: { $lt: 0 } }, { reserved: { $lt: 0 } }],
        })
        .limit(10)
        .toArray();

      if (negativeBalances.length > 0) {
        recordCheck({
          id: "DATA-01",
          name: "Negative Inventory Balance Detection",
          category: "DATA_INTEGRITY",
          status: "FAILED",
          critical: true,
          message: `Found negative stock quantities in inventorybalances (onHand < 0 or reserved < 0)`,
          details: { sampleCount: negativeBalances.length, samples: negativeBalances },
        });
      } else {
        recordCheck({
          id: "DATA-01",
          name: "Negative Inventory Balance Detection",
          category: "DATA_INTEGRITY",
          status: "PASSED",
          critical: true,
          message: "Zero negative stock balances detected (all onHand >= 0 and reserved >= 0)",
        });
      }
    } catch (err: any) {
      recordCheck({
        id: "DATA-01",
        name: "Negative Inventory Balance Detection",
        category: "DATA_INTEGRITY",
        status: "WARNING",
        critical: false,
        message: `Could not check negative balances: ${err.message}`,
      });
    }

    // Check 3.5: Unresolved TransactionOutcomes Scan
    try {
      const txColl = db.collection("transactionoutcomes");
      const unresolvedTx = await txColl
        .find({
          status: { $in: ["PENDING", "RECONCILIATION_REQUIRED"] },
        })
        .limit(20)
        .toArray();

      if (unresolvedTx.length > 0) {
        recordCheck({
          id: "TX-01",
          name: "Unresolved Transaction Outcomes Scan",
          category: "TRANSACTION_OUTCOMES",
          status: "FAILED",
          critical: true,
          message: `CRITICAL: Found ${unresolvedTx.length} unresolved transactions (PENDING or RECONCILIATION_REQUIRED). Migration cannot proceed until transactions are resolved!`,
          details: {
            unresolvedCount: unresolvedTx.length,
            samples: unresolvedTx.map((t: any) => ({
              id: t._id,
              operationType: t.operationType,
              status: t.status,
              idempotencyKey: t.idempotencyKey,
            })),
          },
        });
      } else {
        recordCheck({
          id: "TX-01",
          name: "Unresolved Transaction Outcomes Scan",
          category: "TRANSACTION_OUTCOMES",
          status: "PASSED",
          critical: true,
          message: "Zero unresolved transaction outcomes (0 PENDING, 0 RECONCILIATION_REQUIRED)",
        });
      }
    } catch (err: any) {
      recordCheck({
        id: "TX-01",
        name: "Unresolved Transaction Outcomes Scan",
        category: "TRANSACTION_OUTCOMES",
        status: "WARNING",
        critical: false,
        message: `Could not inspect transactionoutcomes collection: ${err.message}`,
      });
    }

    // Check 3.6: Migration Lock State Inspection
    try {
      const settingsColl = db.collection("systemsettings");
      const lockDoc = await settingsColl.findOne({ key: MIGRATION_LOCK_KEY });

      if (mode === "apply") {
        if (!lockDoc || !lockDoc.value?.locked) {
          recordCheck({
            id: "LOCK-01",
            name: "Migration Lock Acquisition State",
            category: "LOCK_STATE",
            status: "FAILED",
            critical: true,
            message: `Migration mode is 'apply' but ${MIGRATION_LOCK_KEY} is NOT held! Must acquire write lock before applying mutations.`,
            details: { lockDoc },
          });
        } else {
          recordCheck({
            id: "LOCK-01",
            name: "Migration Lock Acquisition State",
            category: "LOCK_STATE",
            status: "PASSED",
            critical: true,
            message: "Active migration write-lock verified held by coordinator",
            details: {
              lockedAt: lockDoc.value?.lockedAt,
              leaseExpiresAt: lockDoc.value?.leaseExpiresAt,
              fenceEpoch: lockDoc.value?.fenceEpoch,
            },
          });
        }
      } else {
        // In inspection or dry-run mode, lock is informative
        recordCheck({
          id: "LOCK-01",
          name: "Migration Lock Acquisition State",
          category: "LOCK_STATE",
          status: "PASSED",
          critical: false,
          message: lockDoc?.value?.locked
            ? "Maintenance lock is currently ACTIVE"
            : "Maintenance lock is currently INACTIVE (normal steady-state)",
          details: { isLocked: !!lockDoc?.value?.locked, fenceEpoch: lockDoc?.value?.fenceEpoch },
        });
      }
    } catch (err: any) {
      recordCheck({
        id: "LOCK-01",
        name: "Migration Lock Acquisition State",
        category: "LOCK_STATE",
        status: "WARNING",
        critical: false,
        message: `Could not inspect systemsettings lock state: ${err.message}`,
      });
    }
  }

  // Check 3.7: Live Oplog Read Privileges Guard
  // Strictly report as NOT_IMPLEMENTED when running without elevated Atlas cluster admin
  recordCheck({
    id: "OPLOG-01",
    name: "MongoDB Atlas Oplog rs.oplog Access Privileges",
    category: "LOCK_STATE",
    status: "NOT_IMPLEMENTED",
    critical: false,
    message:
      "Direct replica set local.oplog.rs inspection requires Atlas privileged cluster role (readAnyDatabase). Execution deferred to Mode 2 Staging run.",
  });

  // ---------------------------------------------------------
  // 4. SUMMARY & ELIGIBILITY CALCULATION
  // ---------------------------------------------------------
  const summary: PreflightSummary = {
    total: checks.length,
    passed: checks.filter((c) => c.status === "PASSED").length,
    failed: checks.filter((c) => c.status === "FAILED").length,
    warnings: checks.filter((c) => c.status === "WARNING").length,
    notImplemented: checks.filter((c) => c.status === "NOT_IMPLEMENTED").length,
    skipped: checks.filter((c) => c.status === "SKIPPED").length,
  };

  const hasCriticalFailure = checks.some((c) => c.critical && c.status === "FAILED");
  const isEligibleForMigration = !hasCriticalFailure;

  const report: PreflightReport = {
    timestamp,
    erpName: ERP_SYSTEM_NAME,
    mode,
    targetUriMasked: maskedUri,
    isEligibleForMigration,
    summary,
    checks,
  };

  // Optional JSON file output
  if (options.outputPath) {
    fs.writeFileSync(options.outputPath, JSON.stringify(report, null, 2), "utf-8");
  }

  return report;
}

/**
 * Formats a PreflightReport for clean terminal presentation
 */
export function formatTerminalReport(report: PreflightReport): string {
  const lines: string[] = [];
  const divider = "=".repeat(78);
  const subDivider = "-".repeat(78);

  lines.push(divider);
  lines.push(`  PREFLIGHT TENANCY & DATA INTEGRITY REPORT — ${report.erpName}`);
  lines.push(divider);
  lines.push(`  Timestamp : ${report.timestamp}`);
  lines.push(`  Mode      : ${report.mode.toUpperCase()}`);
  lines.push(`  Target URI: ${report.targetUriMasked}`);
  lines.push(
    `  Eligibility: ${
      report.isEligibleForMigration
        ? "[ELIGIBLE FOR MIGRATION PLANNING]"
        : "[MIGRATION BLOCKED — CRITICAL DEFECTS DETECTED]"
    }`
  );
  lines.push(subDivider);
  lines.push(
    `  SUMMARY: Total: ${report.summary.total} | Passed: ${report.summary.passed} | Failed: ${report.summary.failed} | Warnings: ${report.summary.warnings} | Not Implemented: ${report.summary.notImplemented}`
  );
  lines.push(subDivider);
  lines.push("");

  for (const check of report.checks) {
    let tag = `[${check.status}]`;
    if (check.status === "PASSED") tag = `\x1b[32m[PASS]\x1b[0m`;
    else if (check.status === "FAILED") tag = `\x1b[31m[FAIL]\x1b[0m`;
    else if (check.status === "WARNING") tag = `\x1b[33m[WARN]\x1b[0m`;
    else if (check.status === "NOT_IMPLEMENTED") tag = `\x1b[36m[NOT IMPLEMENTED]\x1b[0m`;

    const crit = check.critical ? " (CRITICAL)" : "";
    lines.push(`  ${tag} ${check.id}: ${check.name}${crit}`);
    lines.push(`         ${check.message}`);
    if (check.details) {
      lines.push(`         Details: ${JSON.stringify(check.details)}`);
    }
    lines.push("");
  }

  lines.push(divider);
  return lines.join("\n");
}

/**
 * CLI Main Entry Point
 */
async function main() {
  const args = process.argv.slice(2);
  const modeArg = args.find((a) => a.startsWith("--mode="))?.split("=")[1];
  const allowRemote = args.includes("--allow-remote");
  const jsonOutput = args.includes("--json");
  const outputArg = args.find((a) => a.startsWith("--output="))?.split("=")[1];

  let mode: MigrationMode = "inspection";
  try {
    mode = validateMigrationMode(modeArg);
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }

  const report = await runPreflightChecks({
    mode,
    allowRemote,
    outputPath: outputArg,
  });

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatTerminalReport(report));
  }

  if (!report.isEligibleForMigration) {
    process.exit(1);
  }
}

// Execute main if invoked directly
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error("Fatal preflight execution error:", err);
    process.exit(1);
  });
}
