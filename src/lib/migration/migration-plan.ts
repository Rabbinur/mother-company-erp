/**
 * Phase 2B — Tenancy Migration Planner & Execution Coordinator
 * Project: Dealership Management (Mother Company ERP)
 *
 * Implements deterministic migration plan generation, validation, pre-image archiving,
 * quarantine isolation, and stage separation.
 */

import crypto from "crypto";
import mongoose from "mongoose";

import { ERP_SYSTEM_NAME } from "./constants";
import {
  partitionInventoryBalance,
  type LegacyInventoryBalance,
  type DealershipAllocationRule,
  type PartitionTargetRecord,
} from "./inventory-partitioner";
import {
  createPreImageRecord,
  verifyPreImageRoundTrip,
  type PreImageRecord,
} from "./pre-image-archive";
import {
  APPROVED_INVENTORY_INDEXES,
  detectIndexDuplicates,
  type MigrationIndexDefinition,
} from "./index-planner";
import { MigrationAuditManifest } from "./audit-manifest";

export type MigrationStage =
  | "PLAN_GENERATED"
  | "PLAN_VALIDATED"
  | "ARCHIVE_VERIFIED"
  | "MIGRATION_AUTHORIZED"
  | "MIGRATION_EXECUTED";

export interface MigrationPlanOptions {
  runId?: string;
  businessId?: mongoose.Types.ObjectId | string;
  businessName?: string;
  ownerId?: mongoose.Types.ObjectId | string;
  coordinatorId?: string;
  mockLargeDocSize?: number;
}

export interface PlannedPartitionOperation {
  sourceId: string;
  sourceDoc: LegacyInventoryBalance;
  targetRecords: PartitionTargetRecord[];
  isQuarantined: boolean;
  preImage: PreImageRecord;
}

export interface MigrationPlanReport {
  timestamp: string;
  erpName: string;
  migrationRunId: string;
  stage: MigrationStage;
  businessId?: string;
  businessName?: string;
  ownerId?: string;
  summary: {
    totalSourceBalances: number;
    totalTargetPartitions: number;
    totalActivePartitions: number;
    totalQuarantinedPartitions: number;
    totalPreImages: number;
    totalInlinePreImages: number;
    totalGridFsPreImages: number;
    plannedIndexes: number;
  };
  reconciliation: {
    sourceTotalOnHand: number;
    targetTotalOnHand: number;
    isBalanced: boolean;
  };
  plannedOperations: PlannedPartitionOperation[];
  plannedIndexes: MigrationIndexDefinition[];
  manifestCount: number;
  isReadyForExecution: boolean;
}

/**
 * Builds a deterministic migration plan for legacy inventory balances.
 */
export function buildMigrationPlan(
  sourceBalances: LegacyInventoryBalance[],
  allocationRulesMap: Map<string, DealershipAllocationRule[]>,
  options: MigrationPlanOptions = {}
): MigrationPlanReport {
  const timestamp = new Date().toISOString();
  const runId =
    options.runId || `MIG-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const businessId = options.businessId || new mongoose.Types.ObjectId();
  const manifest = new MigrationAuditManifest(runId);

  const plannedOperations: PlannedPartitionOperation[] = [];

  let sourceTotalOnHand = 0;
  let targetTotalOnHand = 0;
  let totalInline = 0;
  let totalGridFs = 0;

  // 1. Plan Partitions & Pre-Images for each source balance
  for (const source of sourceBalances) {
    sourceTotalOnHand += source.onHandQuantity ?? 0;

    // A. Create Pre-Image Record
    const preImage = createPreImageRecord(
      source,
      "inventorybalances",
      runId,
      options.mockLargeDocSize
    );

    if (preImage.storageType === "inline") {
      totalInline++;
      if (preImage.payload) {
        verifyPreImageRoundTrip(preImage.payload, preImage.sha256Hash);
      }
    } else {
      totalGridFs++;
    }

    // B. Partition Balance
    const rules = allocationRulesMap.get(source._id.toString()) || [];
    const partitionResult = partitionInventoryBalance(source, businessId, runId, rules);

    for (const target of partitionResult.targetPartitions) {
      targetTotalOnHand += target.onHandQuantity;

      manifest.record({
        sourceCollection: "inventorybalances",
        sourceId: source._id.toString(),
        targetCollection: "inventorybalances",
        targetId: `${target.warehouseId}:${target.productId}:${target.variantId}:${target.dealershipId ?? "QUARANTINE"}`,
        operationType: target.dealershipId ? "PARTITION_INVENTORY" : "QUARANTINE_RECORD",
        beforeHash: preImage.sha256Hash,
        afterHash: crypto.createHash("sha256").update(JSON.stringify(target)).digest("hex"),
        status: "PLANNED",
        metadata: {
          partitionStatus: target.partitionStatus,
          onHandQuantity: target.onHandQuantity,
        },
      });
    }

    plannedOperations.push({
      sourceId: source._id.toString(),
      sourceDoc: source,
      targetRecords: partitionResult.targetPartitions,
      isQuarantined: partitionResult.isQuarantined,
      preImage,
    });
  }

  // 2. Validate Target Indexes against all planned target partitions
  const allTargetRecords = plannedOperations.flatMap((op) => op.targetRecords);
  for (const indexDef of APPROVED_INVENTORY_INDEXES) {
    const dupCheck = detectIndexDuplicates(allTargetRecords, indexDef);
    if (dupCheck.hasDuplicates) {
      throw new Error(
        `Pre-migration index duplicate check failed for '${indexDef.name}'. ` +
          `Found ${dupCheck.duplicateCount} duplicate tuples in planned partitions.`
      );
    }
  }

  // 3. Mathematical Reconciliation Check
  const isBalanced = sourceTotalOnHand === targetTotalOnHand;

  const totalActive = allTargetRecords.filter((t) => t.partitionStatus === "active").length;
  const totalQuarantined = allTargetRecords.filter(
    (t) => t.partitionStatus === "quarantined"
  ).length;

  return {
    timestamp,
    erpName: ERP_SYSTEM_NAME,
    migrationRunId: runId,
    stage: "ARCHIVE_VERIFIED", // Plan generated, validated, and archives verified
    businessId: businessId.toString(),
    businessName: options.businessName,
    ownerId: options.ownerId?.toString(),
    summary: {
      totalSourceBalances: sourceBalances.length,
      totalTargetPartitions: allTargetRecords.length,
      totalActivePartitions: totalActive,
      totalQuarantinedPartitions: totalQuarantined,
      totalPreImages: plannedOperations.length,
      totalInlinePreImages: totalInline,
      totalGridFsPreImages: totalGridFs,
      plannedIndexes: APPROVED_INVENTORY_INDEXES.length,
    },
    reconciliation: {
      sourceTotalOnHand,
      targetTotalOnHand,
      isBalanced,
    },
    plannedOperations,
    plannedIndexes: APPROVED_INVENTORY_INDEXES,
    manifestCount: manifest.getCount(),
    isReadyForExecution: isBalanced && plannedOperations.length > 0,
  };
}
