/**
 * Phase 2B — Deterministic Rollback Planner
 * Project: Dealership Management (Mother Company ERP)
 *
 * Implements deterministic rollback planning, pre-image mapping, dependency cascade blocking,
 * and comprehensive summary reporting.
 */

import crypto from "crypto";

import { ERP_SYSTEM_NAME } from "./constants";
import type { PreImageRecord } from "./pre-image-archive";
import type { MigrationAuditEntry } from "./audit-manifest";
import { loadAndVerifyPreImage, type GridFsChunk } from "./pre-image-loader";
import {
  detectPostMigrationMutations,
  type TargetDocumentEvaluation,
} from "./mutation-detector";
import {
  evaluateThreeLayerSafety,
  type ThreeLayerSafetyResult,
} from "./rollback-safety";
import type { MigrationLockPayload } from "./fence-guard";
import type { OplogAuditOptions } from "./oplog-checker";
import type {
  RollbackDocumentPlan,
  RollbackPlanReport,
  RollbackPlanSummary,
  RestorationEligibilityStatus,
} from "./rollback-types";

export interface RollbackPlannerOptions {
  migrationRunId: string;
  rollbackRunId?: string;
  mode?: "inspect" | "dry-run" | "apply";
  coordinatorId?: string;
  minEpoch?: number;
  lockPayload?: MigrationLockPayload;
  oplogOptions?: OplogAuditOptions;
  preImages?: PreImageRecord[];
  auditEntries?: MigrationAuditEntry[];
  targetCollectionDocsMap?: Map<string, any[]>;
  gridfsChunks?: GridFsChunk[];
}

/**
 * Builds a deterministic rollback plan and evaluates three-layer safety gates.
 */
export function buildRollbackPlan(options: RollbackPlannerOptions): RollbackPlanReport {
  const timestamp = new Date().toISOString();
  const migrationRunId = options.migrationRunId;
  const rollbackRunId =
    options.rollbackRunId ||
    `RB-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const mode = options.mode || "dry-run";
  const coordinatorId = options.coordinatorId || "COORDINATOR_PROCESS";

  const preImages = options.preImages || [];
  const auditEntries = options.auditEntries || [];
  const targetCollectionDocsMap = options.targetCollectionDocsMap || new Map();
  const gridfsChunks = options.gridfsChunks || [];

  // Index pre-images by originalId
  const preImageMap = new Map<string, PreImageRecord>();
  const duplicateTargetMap = new Map<string, number>();

  for (const pi of preImages) {
    const origIdStr = pi.originalId.toString();
    const count = (duplicateTargetMap.get(origIdStr) || 0) + 1;
    duplicateTargetMap.set(origIdStr, count);
    preImageMap.set(origIdStr, pi);
  }

  // 1. Run mutation detection across all target collections
  const allEvaluations: TargetDocumentEvaluation[] = [];

  for (const [collName, docs] of targetCollectionDocsMap.entries()) {
    const relevantAuditEntries = auditEntries.filter(
      (e) => e.targetCollection === collName || e.sourceCollection === collName
    );
    const detectionResult = detectPostMigrationMutations(
      relevantAuditEntries,
      docs,
      collName
    );
    allEvaluations.push(...detectionResult.evaluations);
  }

  // 2. Build Document Plans
  const documentPlans: RollbackDocumentPlan[] = [];
  const conflictingSourceIds = new Set<string>();

  // First pass: identify document statuses and conflicting sources
  for (const evalItem of allEvaluations) {
    const preImage = preImageMap.get(evalItem.sourceId);

    let status: RestorationEligibilityStatus = "SAFE_TO_RESTORE";
    let conflictReason = evalItem.conflictReason;

    // Check if duplicate restoration target was detected
    const targetCount = duplicateTargetMap.get(evalItem.sourceId) || 0;
    if (targetCount > 1) {
      status = "CONFLICT";
      conflictReason = `DUPLICATE_TARGET: Multiple pre-images or partitions target the same legacy ID: ${evalItem.sourceId}`;
      conflictingSourceIds.add(evalItem.sourceId);
    } else if (evalItem.status === "CONFLICT") {
      status = "CONFLICT";
      conflictingSourceIds.add(evalItem.sourceId);
    } else if (!preImage) {
      status = "MISSING_PREIMAGE";
      conflictReason = `MISSING_PREIMAGE: No verified pre-image archive exists for legacy ID: ${evalItem.sourceId}`;
      conflictingSourceIds.add(evalItem.sourceId);
    } else {
      // Validate Pre-Image Integrity & Hash
      try {
        const loaded = loadAndVerifyPreImage(preImage, gridfsChunks);
        if (loaded.sha256Hash !== preImage.sha256Hash) {
          status = "HASH_MISMATCH";
          conflictReason = `HASH_MISMATCH: Pre-image hash ${loaded.sha256Hash} != expected ${preImage.sha256Hash}`;
          conflictingSourceIds.add(evalItem.sourceId);
        }
      } catch (err: any) {
        status = err.name === "ArchiveHashMismatchError" ? "HASH_MISMATCH" : "CONFLICT";
        conflictReason = `PREIMAGE_LOAD_FAILED: ${err.message}`;
        conflictingSourceIds.add(evalItem.sourceId);
      }
    }

    documentPlans.push({
      originalId: evalItem.sourceId,
      sourceCollection: evalItem.sourceCollection,
      targetCollection: evalItem.targetCollection,
      targetId: evalItem.targetId,
      preImageArchiveId: preImage ? preImage._id.toString() : "MISSING",
      originalHash: preImage ? preImage.sha256Hash : "UNKNOWN",
      currentHash: evalItem.currentHash,
      expectedHash: evalItem.recordedAfterHash,
      storageType: preImage?.storageType || "inline",
      status,
      conflictReason,
      gridfsFileId: preImage?.gridfsFileId ? preImage.gridfsFileId.toString() : undefined,
      chunkCount: preImage?.chunkCount,
    });
  }

  // Second pass: Dependency Cascade Guard
  // If parent InventoryBalance has conflict, block dependent stock movements/reservations
  for (const plan of documentPlans) {
    if (plan.status === "SAFE_TO_RESTORE") {
      // Check if related inventory or financial entity has a conflict
      if (
        (plan.targetCollection.includes("movement") || plan.targetCollection.includes("reservation")) &&
        conflictingSourceIds.size > 0
      ) {
        plan.status = "BLOCKED";
        plan.conflictReason =
          "DEPENDENCY_BLOCK: Dependent inventory movement/reservation blocked due to parent balance conflict";
      }
    }
  }

  // 3. Evaluate Three-Layer Safety Gates
  const defaultOplogOptions: OplogAuditOptions = options.oplogOptions || {
    migrationCompletedAt: new Date(Date.now() - 3600000),
    targetNamespaces: ["inventorybalances", "orders"],
    oplogEntries: [],
    hasReadPrivileges: true,
  };

  const safetyResult: ThreeLayerSafetyResult = evaluateThreeLayerSafety({
    coordinatorId,
    minEpoch: options.minEpoch ?? 1,
    lockPayload: options.lockPayload,
    oplogOptions: defaultOplogOptions,
    documentEvaluations: allEvaluations,
  });

  // 4. Summarize
  const safeCount = documentPlans.filter((p) => p.status === "SAFE_TO_RESTORE").length;
  const conflictCount = documentPlans.filter((p) => p.status === "CONFLICT").length;
  const missingPreImageCount = documentPlans.filter((p) => p.status === "MISSING_PREIMAGE").length;
  const hashMismatchCount = documentPlans.filter((p) => p.status === "HASH_MISMATCH").length;
  const unverifiedCount = documentPlans.filter((p) => p.status === "UNVERIFIED").length;
  const blockedCount = documentPlans.filter((p) => p.status === "BLOCKED").length;

  const isEligibleForRollback =
    safetyResult.allLayersPassed &&
    conflictCount === 0 &&
    missingPreImageCount === 0 &&
    hashMismatchCount === 0 &&
    blockedCount === 0 &&
    documentPlans.length > 0;

  const summary: RollbackPlanSummary = {
    totalMigratedDocuments: documentPlans.length,
    safeToRestoreCount: safeCount,
    conflictCount,
    missingPreImageCount,
    hashMismatchCount,
    unverifiedCount,
    blockedCount,
    isEligibleForRollback,
  };

  return {
    timestamp,
    erpName: ERP_SYSTEM_NAME,
    migrationRunId,
    rollbackRunId,
    mode,
    safetyGates: {
      layerAFreeze: safetyResult.layerA,
      layerBOplog: safetyResult.layerB,
      layerCIntegrity: safetyResult.layerC,
      allGatesPassed: safetyResult.allLayersPassed,
    },
    summary,
    documentPlans,
    isEligibleForRollback,
  };
}
