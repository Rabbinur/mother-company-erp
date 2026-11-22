/**
 * Phase 2B — Three-Layer Rollback Safety Evaluator
 * Project: Dealership Management (Mother Company ERP)
 *
 * Implements the 3 independent safety gates:
 * Layer A: Maintenance Freeze
 * Layer B: Replica Set Oplog Inspection
 * Layer C: Document Integrity & Financial/Inventory Dependency Graph
 */

import { validateMigrationLock, type MigrationLockPayload } from "./fence-guard";
import { auditReplicaSetOplog, type OplogAuditOptions } from "./oplog-checker";
import type { TargetDocumentEvaluation } from "./mutation-detector";
import type { RollbackSafetyLayerResult } from "./rollback-types";

export interface RollbackSafetyEvaluationOptions {
  coordinatorId: string;
  minEpoch?: number;
  lockPayload?: MigrationLockPayload;
  oplogOptions?: OplogAuditOptions;
  documentEvaluations: TargetDocumentEvaluation[];
}

export interface ThreeLayerSafetyResult {
  layerA: RollbackSafetyLayerResult;
  layerB: RollbackSafetyLayerResult;
  layerC: RollbackSafetyLayerResult;
  allLayersPassed: boolean;
  canProceedWithRollbackPlan: boolean;
}

/**
 * Evaluates Layer A (Maintenance Freeze): Lock must be active, lease valid, epoch current.
 */
export function evaluateLayerAFreeze(
  lockPayload: MigrationLockPayload | undefined,
  coordinatorId: string,
  minEpoch = 1
): RollbackSafetyLayerResult {
  if (!lockPayload) {
    return {
      passed: false,
      status: "NOT_CONFIGURED",
      layer: "LAYER_A_FREEZE",
      name: "Maintenance Freeze Gate",
      message: "NOT_CONFIGURED: Migration maintenance lock document is missing. Active freeze required.",
      details: { coordinatorId },
    };
  }

  const check = validateMigrationLock(lockPayload, coordinatorId, minEpoch);

  if (!check.isValid) {
    return {
      passed: false,
      status: "FAIL",
      layer: "LAYER_A_FREEZE",
      name: "Maintenance Freeze Gate",
      message: `FAILED: Maintenance freeze verification failed: ${check.error}`,
      details: {
        isLocked: check.isLocked,
        isExpired: check.isExpired,
        isStaleEpoch: check.isStaleEpoch,
        currentEpoch: check.currentEpoch,
        minEpoch,
      },
    };
  }

  return {
    passed: true,
    status: "PASS",
    layer: "LAYER_A_FREEZE",
    name: "Maintenance Freeze Gate",
    message: "PASSED: Maintenance freeze is active, lock owned by coordinator, epoch fresh.",
    details: { currentEpoch: check.currentEpoch, coordinatorId },
  };
}

/**
 * Evaluates Layer B (Oplog Inspection): Inspected window complete, zero external writes, no rollover.
 */
export function evaluateLayerBOplog(oplogOptions?: OplogAuditOptions): RollbackSafetyLayerResult {
  if (!oplogOptions || oplogOptions.isConfigured === false) {
    return {
      passed: false,
      status: "NOT_CONFIGURED",
      layer: "LAYER_B_OPLOG",
      name: "Replica Set Oplog Inspection Gate",
      message: "NOT_CONFIGURED: Replica set oplog inspection is not configured or no oplog evidence provided.",
      details: { isConfigured: false },
    };
  }

  const check = auditReplicaSetOplog(oplogOptions);

  if (!check.canProceed) {
    return {
      passed: false,
      status: "FAIL",
      layer: "LAYER_B_OPLOG",
      name: "Replica Set Oplog Inspection Gate",
      message: `FAILED: ${check.message}`,
      details: {
        status: check.status,
        mutationsDetected: check.externalMutationsDetected,
        isRolledOver: check.isRolledOver,
        hasPrivileges: check.hasPrivileges,
      },
    };
  }

  return {
    passed: true,
    status: "PASS",
    layer: "LAYER_B_OPLOG",
    name: "Replica Set Oplog Inspection Gate",
    message: "PASSED: Complete oplog inspected with zero post-migration business mutations.",
    details: { status: check.status, entriesInspected: check.totalOplogEntriesInspected },
  };
}

/**
 * Evaluates Layer C (Document Integrity & Dependency Graph):
 * Checks document evaluations and resolves cascading dependency blocks across inventory and finance.
 */
export function evaluateLayerCIntegrity(
  evaluations: TargetDocumentEvaluation[]
): RollbackSafetyLayerResult {
  if (!evaluations || evaluations.length === 0) {
    return {
      passed: false,
      status: "NOT_VERIFIED",
      layer: "LAYER_C_INTEGRITY",
      name: "Document Integrity & Dependency Gate",
      message: "NOT_VERIFIED: Zero target documents evaluated. Empty dataset or missing migration manifest cannot produce Integrity PASS.",
      details: { verifiedDocuments: 0 },
    };
  }

  const conflicts = evaluations.filter((e) => e.status === "CONFLICT");
  const missingPreImages = evaluations.filter((e) => e.status === "MISSING_PREIMAGE");
  const hashMismatches = evaluations.filter((e) => e.status === "HASH_MISMATCH");

  // Dependency Guard: Check for inventory or financial mutations that cascade
  const inventoryConflicts = conflicts.filter((c) =>
    c.targetCollection.includes("inventory") || c.targetCollection.includes("stock")
  );
  const financialConflicts = conflicts.filter((c) =>
    c.targetCollection.includes("account") ||
    c.targetCollection.includes("journal") ||
    c.targetCollection.includes("payment") ||
    c.targetCollection.includes("order")
  );

  if (conflicts.length > 0 || missingPreImages.length > 0 || hashMismatches.length > 0) {
    return {
      passed: false,
      status: "FAIL",
      layer: "LAYER_C_INTEGRITY",
      name: "Document Integrity & Dependency Gate",
      message:
        `FAILED: Document integrity violations detected! ` +
        `Conflicts: ${conflicts.length} (Inventory: ${inventoryConflicts.length}, Financial: ${financialConflicts.length}), ` +
        `Missing Pre-Images: ${missingPreImages.length}, Hash Mismatches: ${hashMismatches.length}.`,
      details: {
        conflictCount: conflicts.length,
        inventoryConflictsCount: inventoryConflicts.length,
        financialConflictsCount: financialConflicts.length,
        sampleConflicts: conflicts.slice(0, 5).map((c) => ({
          targetId: c.targetId,
          targetCollection: c.targetCollection,
          reason: c.conflictReason,
        })),
      },
    };
  }

  return {
    passed: true,
    status: "PASS",
    layer: "LAYER_C_INTEGRITY",
    name: "Document Integrity & Dependency Gate",
    message: "PASSED: All target documents verified clean and identical to post-migration baseline.",
    details: { verifiedDocuments: evaluations.length },
  };
}

/**
 * Runs all three independent safety gates.
 */
export function evaluateThreeLayerSafety(
  options: RollbackSafetyEvaluationOptions
): ThreeLayerSafetyResult {
  const layerA = evaluateLayerAFreeze(
    options.lockPayload,
    options.coordinatorId,
    options.minEpoch ?? 1
  );
  const layerB = evaluateLayerBOplog(options.oplogOptions);
  const layerC = evaluateLayerCIntegrity(options.documentEvaluations);

  const allLayersPassed = layerA.passed && layerB.passed && layerC.passed;

  return {
    layerA,
    layerB,
    layerC,
    allLayersPassed,
    canProceedWithRollbackPlan: allLayersPassed,
  };
}
