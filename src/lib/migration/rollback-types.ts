/**
 * Phase 2B — Rollback Types & Status Definitions
 * Project: Dealership Management (Mother Company ERP)
 */

export type RestorationEligibilityStatus =
  | "SAFE_TO_RESTORE"
  | "CONFLICT"
  | "MISSING_PREIMAGE"
  | "HASH_MISMATCH"
  | "UNVERIFIED"
  | "BLOCKED";

export type OplogInspectionStatus =
  | "COMPLETE"
  | "ROLLED_OVER"
  | "UNAUTHORIZED"
  | "INCOMPLETE"
  | "MUTATIONS_DETECTED";

export interface RollbackDocumentPlan {
  originalId: string;
  sourceCollection: string;
  targetCollection: string;
  targetId: string;
  preImageArchiveId: string;
  originalHash: string;
  currentHash?: string;
  expectedHash?: string;
  storageType: "inline" | "gridfs";
  status: RestorationEligibilityStatus;
  conflictReason?: string;
  gridfsFileId?: string;
  chunkCount?: number;
  dependencies?: string[];
}

export interface RollbackSafetyLayerResult {
  passed: boolean;
  layer: "LAYER_A_FREEZE" | "LAYER_B_OPLOG" | "LAYER_C_INTEGRITY";
  name: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface RollbackPlanSummary {
  totalMigratedDocuments: number;
  safeToRestoreCount: number;
  conflictCount: number;
  missingPreImageCount: number;
  hashMismatchCount: number;
  unverifiedCount: number;
  blockedCount: number;
  isEligibleForRollback: boolean;
}

export interface RollbackPlanReport {
  timestamp: string;
  erpName: string;
  migrationRunId: string;
  rollbackRunId: string;
  mode: "inspect" | "dry-run" | "apply";
  safetyGates: {
    layerAFreeze: RollbackSafetyLayerResult;
    layerBOplog: RollbackSafetyLayerResult;
    layerCIntegrity: RollbackSafetyLayerResult;
    allGatesPassed: boolean;
  };
  summary: RollbackPlanSummary;
  documentPlans: RollbackDocumentPlan[];
  isEligibleForRollback: boolean;
}
