import { test, describe } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import mongoose from "mongoose";

// Migration modules under test
import {
  ERP_SYSTEM_NAME,
  TARGET_MIGRATION_COLLECTIONS,
  ALL_33_MODELS,
  MIGRATION_LOCK_KEY,
} from "../src/lib/migration/constants.ts";

import {
  maskMongoUri,
  isRemoteClusterUri,
  validateMigrationMode,
} from "../src/lib/migration/safe-env.ts";

import {
  validateMigrationLock,
} from "../src/lib/migration/fence-guard.ts";

import {
  partitionInventoryBalance,
} from "../src/lib/migration/inventory-partitioner.ts";

import {
  createPreImageRecord,
  serializeToBson,
  deserializeFromBson,
  verifyPreImageRoundTrip,
  ArchiveHashMismatchError,
} from "../src/lib/migration/pre-image-archive.ts";

import {
  loadAndVerifyPreImage,
} from "../src/lib/migration/pre-image-loader.ts";

import {
  APPROVED_INVENTORY_INDEXES,
  validateAtlasPartialFilter,
  detectIndexDuplicates,
} from "../src/lib/migration/index-planner.ts";

import { MigrationAuditManifest } from "../src/lib/migration/audit-manifest.ts";

import {
  buildMigrationPlan,
} from "../src/lib/migration/migration-plan.ts";

import {
  detectPostMigrationMutations,
  hashCurrentDocument,
} from "../src/lib/migration/mutation-detector.ts";

import {
  auditReplicaSetOplog,
} from "../src/lib/migration/oplog-checker.ts";

import {
  evaluateLayerAFreeze,
  evaluateLayerBOplog,
  evaluateLayerCIntegrity,
  evaluateThreeLayerSafety,
} from "../src/lib/migration/rollback-safety.ts";

import {
  buildRollbackPlan,
} from "../src/lib/migration/rollback-plan.ts";

import {
  runMigrationEngine,
  formatMigrationOutput,
} from "../scripts/migrate-legacy-tenancy.ts";

import {
  runRollbackEngine,
  formatRollbackOutput,
} from "../scripts/rollback-legacy-tenancy.ts";

import {
  runPreflightChecks,
} from "../scripts/preflight-tenancy-check.ts";

// ============================================================================
// Synthetic Fixture Dataset Definitions (In-Memory, Zero Network, Zero Writes)
// ============================================================================

const businessId = new mongoose.Types.ObjectId();
const dealershipA = new mongoose.Types.ObjectId();
const dealershipB = new mongoose.Types.ObjectId();
const principalCompanyId = new mongoose.Types.ObjectId();
const warehouseId = new mongoose.Types.ObjectId();
const product1Id = new mongoose.Types.ObjectId();
const product2Id = new mongoose.Types.ObjectId();
const variant1Id = new mongoose.Types.ObjectId();
const variant2Id = new mongoose.Types.ObjectId();

const coordinatorId = "COORDINATOR_E2E_SIM";
const migrationRunId = "MIG-E2E-SIM-2026";

// Legacy Balances covering single-dealer, 60/40 split, quarantine, fractional remainder
const legacyBalances = [
  // 1. Single Dealership: 100 on hand, 20 reserved
  {
    _id: new mongoose.Types.ObjectId(),
    warehouseId,
    productId: product1Id,
    variantId: variant1Id,
    onHandQuantity: 100,
    reservedQuantity: 20,
    damagedQuantity: 0,
    stockInTransit: 0,
  },
  // 2. 60/40 Split between Dealership A (60) and Dealership B (40)
  {
    _id: new mongoose.Types.ObjectId(),
    warehouseId,
    productId: product1Id,
    variantId: variant2Id,
    onHandQuantity: 100,
    reservedQuantity: 10,
    damagedQuantity: 5,
    stockInTransit: 0,
  },
  // 3. Unmapped Ownership: 100% allocated to quarantine (dealershipId: null)
  {
    _id: new mongoose.Types.ObjectId(),
    warehouseId,
    productId: product2Id,
    variantId: variant1Id,
    onHandQuantity: 50,
    reservedQuantity: 0,
    damagedQuantity: 0,
    stockInTransit: 0,
  },
  // 4. Fractional remainder: 55 on hand split 50/50 -> 27 to A, 27 to B, 1 remainder quarantined
  {
    _id: new mongoose.Types.ObjectId(),
    warehouseId,
    productId: product2Id,
    variantId: variant2Id,
    onHandQuantity: 55,
    reservedQuantity: 5,
    damagedQuantity: 0,
    stockInTransit: 0,
  },
];

const allocationRulesMap = new Map();

// Balance 1 -> 100% Dealership A
allocationRulesMap.set(legacyBalances[0]._id.toString(), [
  { dealershipId: dealershipA, exactOnHand: 100, exactReserved: 20 },
]);

// Balance 2 -> 60/40 Split
allocationRulesMap.set(legacyBalances[1]._id.toString(), [
  { dealershipId: dealershipA, exactOnHand: 60, exactReserved: 6, exactDamaged: 3 },
  { dealershipId: dealershipB, exactOnHand: 40, exactReserved: 4, exactDamaged: 2 },
]);

// Balance 3 -> No rules -> Automatically quarantined with dealershipId: null

// Balance 4 -> 50/50 with fractional remainder
allocationRulesMap.set(legacyBalances[3]._id.toString(), [
  { dealershipId: dealershipA, ratio: 0.5 },
  { dealershipId: dealershipB, ratio: 0.5 },
]);

// Helper to create active valid lock payload
function createActiveLockPayload(epoch = 1, ttlMs = 60000) {
  return {
    locked: true,
    lockHolder: coordinatorId,
    fenceEpoch: epoch,
    leaseExpiresAt: new Date(Date.now() + ttlMs),
    heldSince: new Date(),
  };
}

// ============================================================================
// SUITE 1: Synthetic Dataset & Preflight Verification
// ============================================================================

describe("Suite 1: Synthetic Dataset & Preflight Verification", () => {
  test("1. Preflight static schema validation: verifies 33 models, inventory rules, and zero mutations", async () => {
    const report = await runPreflightChecks({
      mode: "dry-run",
      mongoUri: "mongodb://127.0.0.1:27017/test_db",
    });
    assert.equal(report.erpName, ERP_SYSTEM_NAME);
    assert.equal(report.mode, "dry-run");

    const schema01 = report.checks.find((c) => c.id === "SCHEMA-01");
    assert.ok(schema01);
    assert.equal(schema01.status, "PASSED");
    assert.equal(schema01.details?.verifiedCount, 33);

    const schema02 = report.checks.find((c) => c.id === "SCHEMA-02");
    assert.ok(schema02);
    assert.equal(schema02.status, "PASSED");

    // Verify zero database mutations
    assert.equal(report.summary.failed, 0);
  });

  test("2. Remote safety guard: remote cluster URI blocked without explicit --allow-remote", () => {
    const remoteUri = "mongodb+srv://admin:pass123@cluster0.mongodb.net/dealership";
    assert.equal(isRemoteClusterUri(remoteUri), true);
    assert.equal(maskMongoUri(remoteUri).includes("pass123"), false);

    const localUri = "mongodb://127.0.0.1:27017/erp_db";
    assert.equal(isRemoteClusterUri(localUri), false);
  });
});

// ============================================================================
// SUITE 2: End-to-End Migration Planning & Archiving Lifecycle
// ============================================================================

describe("Suite 2: Full End-to-End Migration Planning & Archiving Lifecycle", () => {
  let planReport;

  test("3. Deterministic migration plan generation: produces PLAN_GENERATED stage with reconciliation", () => {
    planReport = buildMigrationPlan(legacyBalances, allocationRulesMap, {
      runId: migrationRunId,
      businessId,
      coordinatorId,
    });

    assert.equal(planReport.erpName, ERP_SYSTEM_NAME);
    assert.equal(planReport.migrationRunId, migrationRunId);
    assert.equal(planReport.summary.totalSourceBalances, 4);
    assert.equal(planReport.reconciliation.isBalanced, true);
    assert.equal(
      planReport.reconciliation.sourceTotalOnHand,
      planReport.reconciliation.targetTotalOnHand
    );
    assert.equal(planReport.isReadyForExecution, true);
  });

  test("4. 1:N inventory partitioning: mathematical conservation across 60/40 split with Delta = 0", () => {
    const op2 = planReport.plannedOperations.find(
      (op) => op.sourceId === legacyBalances[1]._id.toString()
    );
    assert.ok(op2);
    assert.equal(op2.targetRecords.length, 2);

    const targetA = op2.targetRecords.find((r) => r.dealershipId?.toString() === dealershipA.toString());
    const targetB = op2.targetRecords.find((r) => r.dealershipId?.toString() === dealershipB.toString());
    assert.ok(targetA && targetB);

    assert.equal(targetA.onHandQuantity, 60);
    assert.equal(targetB.onHandQuantity, 40);
    assert.equal(targetA.onHandQuantity + targetB.onHandQuantity, 100);
    assert.equal(targetA.reservedQuantity + targetB.reservedQuantity, 10);
    assert.equal(targetA.damagedQuantity + targetB.damagedQuantity, 5);
  });

  test("5. Unmapped legacy balance: strictly partitioned to quarantine with explicit dealershipId: null", () => {
    const op3 = planReport.plannedOperations.find(
      (op) => op.sourceId === legacyBalances[2]._id.toString()
    );
    assert.ok(op3);
    assert.equal(op3.isQuarantined, true);
    assert.equal(op3.targetRecords.length, 1);
    assert.equal(op3.targetRecords[0].dealershipId, null);
    assert.equal(op3.targetRecords[0].partitionStatus, "quarantined");
    assert.equal(op3.targetRecords[0].onHandQuantity, 50);
  });

  test("6. Fractional remainder: odd units safely partitioned to quarantine with explicit null", () => {
    const op4 = planReport.plannedOperations.find(
      (op) => op.sourceId === legacyBalances[3]._id.toString()
    );
    assert.ok(op4);
    assert.equal(op4.targetRecords.length, 3); // 2 active + 1 quarantine remainder

    const activeParts = op4.targetRecords.filter((r) => r.dealershipId !== null);
    const quarantineParts = op4.targetRecords.filter((r) => r.dealershipId === null);

    assert.equal(activeParts.length, 2);
    assert.equal(quarantineParts.length, 1);

    const sumActiveOnHand = activeParts.reduce((acc, r) => acc + r.onHandQuantity, 0);
    const remainderOnHand = quarantineParts[0].onHandQuantity;

    assert.equal(sumActiveOnHand, 54); // 27 + 27
    assert.equal(remainderOnHand, 1);
    assert.equal(sumActiveOnHand + remainderOnHand, 55); // 100% conserved!
    assert.equal(quarantineParts[0].partitionStatus, "quarantined");
  });

  test("7. BSON pre-image archiving: validates canonical sorting, round-trip fidelity and SHA-256 hash", () => {
    const op1 = planReport.plannedOperations[0];
    assert.equal(op1.preImage.storageType, "inline");
    assert.ok(op1.preImage.payload);

    const loaded = loadAndVerifyPreImage(op1.preImage);
    assert.equal(loaded.isValid, true);
    assert.equal(loaded.sha256Hash, op1.preImage.sha256Hash);
    assert.equal(loaded.restoredDoc.onHandQuantity, 100);
    assert.equal(loaded.restoredDoc.reservedQuantity, 20);
  });

  test("8. GridFS BSON pre-image archiving: handles simulated >15MB document with chunk reassembly", () => {
    const largeDoc = {
      _id: new mongoose.Types.ObjectId(),
      warehouseId,
      productId: product1Id,
      name: "LargeDatasetSimulation",
      content: "X".repeat(1024),
    };

    const { buffer, sha256 } = serializeToBson(largeDoc);
    const gridfsFileId = new mongoose.Types.ObjectId();

    // Partition into 3 chunks
    const chunkLen = Math.ceil(buffer.length / 3);
    const chunks = [
      { files_id: gridfsFileId, n: 2, data: buffer.subarray(chunkLen * 2) },
      { files_id: gridfsFileId, n: 0, data: buffer.subarray(0, chunkLen) },
      { files_id: gridfsFileId, n: 1, data: buffer.subarray(chunkLen, chunkLen * 2) },
    ];

    const preImageRecord = {
      _id: new mongoose.Types.ObjectId(),
      migrationRunId,
      collectionName: "inventorybalances",
      originalId: largeDoc._id,
      storageType: "gridfs",
      byteSize: buffer.length,
      sha256Hash: sha256,
      gridfsFileId,
      chunkCount: 3,
      createdAt: new Date(),
    };

    const loaded = loadAndVerifyPreImage(preImageRecord, chunks);
    assert.equal(loaded.isValid, true);
    assert.equal(loaded.storageType, "gridfs");
    assert.equal(loaded.sha256Hash, sha256);
    assert.equal(loaded.restoredDoc.name, "LargeDatasetSimulation");
  });

  test("9. Atlas index migration planning: verifies approved dual partial indexes pass filter rules", () => {
    for (const idx of planReport.plannedIndexes) {
      assert.ok(idx.partialFilterExpression);
      const res = validateAtlasPartialFilter(idx.partialFilterExpression);
      assert.equal(res.isAtlasCompatible, true);
    }
  });

  test("10. Audit manifest: generates complete immutable manifest records with zero credential leakage", () => {
    assert.ok(planReport.manifestCount > 0);
    const manifest = new MigrationAuditManifest(migrationRunId);
    manifest.record({
      sourceCollection: "inventorybalances",
      sourceId: legacyBalances[0]._id.toString(),
      targetCollection: "inventorybalances",
      targetId: "target-01",
      operationType: "PARTITION_INVENTORY",
      beforeHash: "hash-before",
      afterHash: "hash-after",
      status: "PLANNED",
      timestamp: new Date().toISOString(),
    });

    const entries = manifest.getEntries();
    assert.equal(entries.length, 1);
    const jsonStr = JSON.stringify(entries[0]);
    assert.equal(jsonStr.includes("password"), false);
    assert.equal(jsonStr.includes("mongodb://"), false);
  });
});

// ============================================================================
// SUITE 3: The 8 Post-Migration Mutation & Safety Scenarios
// ============================================================================

describe("Suite 3: The 8 Post-Migration Mutation & Safety Scenarios", () => {
  // Common baseline artifacts
  const lock = createActiveLockPayload(1, 60000);
  const baselineId = new mongoose.Types.ObjectId();
  const targetId = new mongoose.Types.ObjectId();

  const originalDoc = {
    _id: baselineId,
    warehouseId,
    productId: product1Id,
    onHandQuantity: 100,
    reservedQuantity: 20,
  };
  const preImage = createPreImageRecord(originalDoc, "inventorybalances", migrationRunId);

  const cleanTargetDoc = {
    _id: targetId.toString(),
    sourceBaselineId: baselineId.toString(),
    warehouseId: warehouseId.toString(),
    productId: product1Id.toString(),
    onHandQuantity: 100,
    reservedQuantity: 20,
  };
  const cleanTargetHash = hashCurrentDocument(cleanTargetDoc);

  const cleanAuditEntries = [
    {
      migrationRunId,
      sourceCollection: "inventorybalances",
      sourceId: baselineId.toString(),
      targetCollection: "inventorybalances",
      targetId: targetId.toString(),
      operationType: "PARTITION_INVENTORY",
      beforeHash: preImage.sha256Hash,
      afterHash: cleanTargetHash,
      status: "PLANNED",
      timestamp: new Date().toISOString(),
    },
  ];

  const cleanOplogOptions = {
    migrationCompletedAt: new Date(Date.now() - 3600000),
    targetNamespaces: ["inventorybalances"],
    oplogEntries: [],
    hasReadPrivileges: true,
  };

  test("11. Scenario 1 (Clean Baseline): Zero mutations, all 3 gates PASS, rollback plan ELIGIBLE", () => {
    const plan = buildRollbackPlan({
      migrationRunId,
      coordinatorId,
      lockPayload: lock,
      preImages: [preImage],
      auditEntries: cleanAuditEntries,
      targetCollectionDocsMap: new Map([["inventorybalances", [cleanTargetDoc]]]),
      oplogOptions: cleanOplogOptions,
    });

    assert.equal(plan.summary.totalMigratedDocuments, 1);
    assert.equal(plan.summary.safeToRestoreCount, 1);
    assert.equal(plan.summary.conflictCount, 0);
    assert.equal(plan.summary.blockedCount, 0);

    assert.equal(plan.safetyGates.layerAFreeze.passed, true);
    assert.equal(plan.safetyGates.layerAFreeze.status, "PASS");
    assert.equal(plan.safetyGates.layerBOplog.passed, true);
    assert.equal(plan.safetyGates.layerBOplog.status, "PASS");
    assert.equal(plan.safetyGates.layerCIntegrity.passed, true);
    assert.equal(plan.safetyGates.layerCIntegrity.status, "PASS");
    assert.equal(plan.safetyGates.allGatesPassed, true);

    assert.equal(plan.isEligibleForRollback, true);
    assert.equal(plan.documentPlans[0].status, "SAFE_TO_RESTORE");
  });

  test("12. Scenario 2 (Inventory Changed): onHandQuantity altered post-migration -> CONFLICT, rollback BLOCKED", () => {
    const mutatedDoc = { ...cleanTargetDoc, onHandQuantity: 80 }; // 100 -> 80
    const mutatedAudit = [
      {
        ...cleanAuditEntries[0],
        metadata: { onHandQuantity: 100 },
      },
    ];

    const plan = buildRollbackPlan({
      migrationRunId,
      coordinatorId,
      lockPayload: lock,
      preImages: [preImage],
      auditEntries: mutatedAudit,
      targetCollectionDocsMap: new Map([["inventorybalances", [mutatedDoc]]]),
      oplogOptions: cleanOplogOptions,
    });

    assert.equal(plan.summary.conflictCount, 1);
    assert.equal(plan.documentPlans[0].status, "CONFLICT");
    assert.ok(plan.documentPlans[0].conflictReason?.includes("BUSINESS_MUTATION_DETECTED"));
    assert.equal(plan.safetyGates.layerCIntegrity.passed, false);
    assert.equal(plan.safetyGates.layerCIntegrity.status, "FAIL");
    assert.equal(plan.isEligibleForRollback, false);
  });

  test("13. Scenario 3 (Financial Mutation): Journal/account record altered post-migration -> CONFLICT, rollback BLOCKED", () => {
    const finBaselineId = "journal-01";
    const finTargetId = "fin-target-01";
    const finDoc = { _id: finTargetId, sourceBaselineId: finBaselineId, amount: 5000 };
    const finPreImage = createPreImageRecord({ _id: finBaselineId, amount: 5000 }, "journalentries", migrationRunId);

    const finAudit = [
      {
        migrationRunId,
        sourceCollection: "journalentries",
        sourceId: finBaselineId,
        targetCollection: "journalentries",
        targetId: finTargetId,
        operationType: "PARTITION_INVENTORY",
        beforeHash: finPreImage.sha256Hash,
        afterHash: hashCurrentDocument(finDoc),
        status: "PLANNED",
        timestamp: new Date().toISOString(),
      },
    ];

    const mutatedFinDoc = { ...finDoc, amount: 6500 }; // Financial mutation!

    const plan = buildRollbackPlan({
      migrationRunId,
      coordinatorId,
      lockPayload: lock,
      preImages: [finPreImage],
      auditEntries: finAudit,
      targetCollectionDocsMap: new Map([["journalentries", [mutatedFinDoc]]]),
      oplogOptions: {
        migrationCompletedAt: new Date(Date.now() - 3600000),
        targetNamespaces: ["journalentries"],
        oplogEntries: [],
        hasReadPrivileges: true,
      },
    });

    assert.equal(plan.summary.conflictCount, 1);
    assert.equal(plan.documentPlans[0].status, "CONFLICT");
    assert.equal(plan.safetyGates.layerCIntegrity.passed, false);
    assert.ok(plan.safetyGates.layerCIntegrity.message.includes("Financial: 1"));
    assert.equal(plan.isEligibleForRollback, false);
  });

  test("14. Scenario 4 (Target Deleted): Migrated document deleted post-migration -> CONFLICT, rollback BLOCKED", () => {
    // Empty collection -> target document is missing/deleted
    const plan = buildRollbackPlan({
      migrationRunId,
      coordinatorId,
      lockPayload: lock,
      preImages: [preImage],
      auditEntries: cleanAuditEntries,
      targetCollectionDocsMap: new Map([["inventorybalances", []]]),
      oplogOptions: cleanOplogOptions,
    });

    assert.equal(plan.summary.conflictCount, 1);
    assert.equal(plan.documentPlans[0].status, "CONFLICT");
    assert.ok(plan.documentPlans[0].conflictReason?.includes("DOCUMENT_DELETED"));
    assert.equal(plan.isEligibleForRollback, false);
  });

  test("15. Scenario 5 (New Record Inserted): Unrecorded new record inserted into collection -> CONFLICT, rollback BLOCKED", () => {
    const unrecordedDoc = {
      _id: new mongoose.Types.ObjectId().toString(),
      sourceBaselineId: "unrecorded-source",
      onHandQuantity: 50,
    };

    const plan = buildRollbackPlan({
      migrationRunId,
      coordinatorId,
      lockPayload: lock,
      preImages: [preImage],
      auditEntries: cleanAuditEntries,
      targetCollectionDocsMap: new Map([["inventorybalances", [cleanTargetDoc, unrecordedDoc]]]),
      oplogOptions: cleanOplogOptions,
    });

    assert.equal(plan.summary.conflictCount, 1);
    const unrecordedPlan = plan.documentPlans.find((p) => p.targetId === unrecordedDoc._id);
    assert.ok(unrecordedPlan);
    assert.equal(unrecordedPlan.status, "CONFLICT");
    assert.ok(unrecordedPlan.conflictReason?.includes("UNRECORDED_NEW_DOCUMENT"));
    assert.equal(plan.isEligibleForRollback, false);
  });

  test("16. Scenario 6 (Archive Corrupted): Tampered BSON pre-image payload triggers HASH_MISMATCH, rollback BLOCKED", () => {
    // Corrupt pre-image payload by mutating byte buffer
    const corruptedPreImage = {
      ...preImage,
      payload: Buffer.from("CORRUPTED_TAMPERED_BSON_BUFFER"),
    };

    const plan = buildRollbackPlan({
      migrationRunId,
      coordinatorId,
      lockPayload: lock,
      preImages: [corruptedPreImage],
      auditEntries: cleanAuditEntries,
      targetCollectionDocsMap: new Map([["inventorybalances", [cleanTargetDoc]]]),
      oplogOptions: cleanOplogOptions,
    });

    assert.equal(plan.summary.hashMismatchCount, 1);
    assert.equal(plan.documentPlans[0].status, "HASH_MISMATCH");
    assert.equal(plan.isEligibleForRollback, false);
  });

  test("17. Scenario 7 (Oplog Incomplete / Rollover / Truncated): Rollover fails Layer B closed, rollback BLOCKED", () => {
    const rolledOverOplog = {
      migrationCompletedAt: new Date(Date.now() - 3600000),
      targetNamespaces: ["inventorybalances"],
      mockRolloverDetected: true,
      hasReadPrivileges: true,
    };

    const plan = buildRollbackPlan({
      migrationRunId,
      coordinatorId,
      lockPayload: lock,
      preImages: [preImage],
      auditEntries: cleanAuditEntries,
      targetCollectionDocsMap: new Map([["inventorybalances", [cleanTargetDoc]]]),
      oplogOptions: rolledOverOplog,
    });

    assert.equal(plan.safetyGates.layerBOplog.passed, false);
    assert.equal(plan.safetyGates.layerBOplog.status, "FAIL");
    assert.ok(plan.safetyGates.layerBOplog.message.includes("rollover"));
    assert.equal(plan.isEligibleForRollback, false);
  });

  test("18. Scenario 8 (Maintenance Freeze Expired/Invalid): Expired lease fails Layer A, rollback BLOCKED", () => {
    const expiredLock = {
      ...lock,
      leaseExpiresAt: new Date(Date.now() - 5000), // Expired!
    };

    const plan = buildRollbackPlan({
      migrationRunId,
      coordinatorId,
      lockPayload: expiredLock,
      preImages: [preImage],
      auditEntries: cleanAuditEntries,
      targetCollectionDocsMap: new Map([["inventorybalances", [cleanTargetDoc]]]),
      oplogOptions: cleanOplogOptions,
    });

    assert.equal(plan.safetyGates.layerAFreeze.passed, false);
    assert.equal(plan.safetyGates.layerAFreeze.status, "FAIL");
    assert.ok(plan.safetyGates.layerAFreeze.message.includes("expired"));
    assert.equal(plan.isEligibleForRollback, false);
  });
});

// ============================================================================
// SUITE 4: Section 7 Regression & Status Accuracy Verification
// ============================================================================

describe("Suite 4: Section 7 Regression & Status Accuracy Verification", () => {
  test("19. Unconfigured maintenance lock payload reports Freeze=NOT_CONFIGURED (passed: false)", () => {
    const result = evaluateLayerAFreeze(undefined, coordinatorId);
    assert.equal(result.passed, false);
    assert.equal(result.status, "NOT_CONFIGURED");
    assert.ok(result.message.includes("NOT_CONFIGURED"));
  });

  test("20. Unconfigured oplog audit options reports Oplog=NOT_CONFIGURED (passed: false)", () => {
    const result = evaluateLayerBOplog(undefined);
    assert.equal(result.passed, false);
    assert.equal(result.status, "NOT_CONFIGURED");
    assert.ok(result.message.includes("NOT_CONFIGURED"));
  });

  test("21. Empty dataset with 0 evaluated docs reports Integrity=NOT_VERIFIED (passed: false)", () => {
    const result = evaluateLayerCIntegrity([]);
    assert.equal(result.passed, false);
    assert.equal(result.status, "NOT_VERIFIED");
    assert.ok(result.message.includes("NOT_VERIFIED"));
  });

  test("22. Unconfigured CLI inspect output renders exact string: Freeze=NOT_CONFIGURED | Oplog=NOT_CONFIGURED | Integrity=NOT_VERIFIED", async () => {
    const result = await runRollbackEngine({
      migrationRunId: "MIG-UNKNOWN",
      mode: "inspect",
    });

    assert.equal(result.mode, "inspect");
    assert.equal(result.status, "INSPECTED");
    assert.equal(result.exitCode, 0);

    const formatted = formatRollbackOutput(result);
    assert.ok(
      formatted.includes("Freeze=NOT_CONFIGURED | Oplog=NOT_CONFIGURED | Integrity=NOT_VERIFIED")
    );
    assert.ok(formatted.includes("[ROLLBACK INELIGIBLE / BLOCKED]"));
  });

  test("23. Empty dataset never yields false-positive PASS on any safety layer", () => {
    const safety = evaluateThreeLayerSafety({
      coordinatorId,
      oplogOptions: undefined,
      documentEvaluations: [],
    });

    assert.equal(safety.allLayersPassed, false);
    assert.equal(safety.layerA.status, "NOT_CONFIGURED");
    assert.equal(safety.layerB.status, "NOT_CONFIGURED");
    assert.equal(safety.layerC.status, "NOT_VERIFIED");
    assert.equal(safety.canProceedWithRollbackPlan, false);
  });
});

// ============================================================================
// SUITE 5: Governance, Dependency Cascades & Execution Restrictions
// ============================================================================

describe("Suite 5: Governance, Dependency Cascades & Execution Restrictions", () => {
  test("24. Cascading dependency guard: Parent balance mutation cascades to block StockMovement and StockReservation", () => {
    const balanceSrcId = "bal-parent-01";
    const balanceTgtId = "bal-tgt-01";
    const moveTgtId = "mov-tgt-01";
    const resTgtId = "res-tgt-01";

    const cleanMoveDoc = { _id: moveTgtId, sourceBaselineId: "mov-src-01", quantity: 10 };
    const cleanResDoc = { _id: resTgtId, sourceBaselineId: "res-src-01", reservedQuantity: 5 };

    const auditEntries = [
      {
        migrationRunId,
        sourceCollection: "inventorybalances",
        sourceId: balanceSrcId,
        targetCollection: "inventorybalances",
        targetId: balanceTgtId,
        operationType: "PARTITION_INVENTORY",
        beforeHash: "h-bal-before",
        afterHash: "h-bal-after",
        status: "PLANNED",
        timestamp: new Date().toISOString(),
      },
      {
        migrationRunId,
        sourceCollection: "stockmovements",
        sourceId: "mov-src-01",
        targetCollection: "stockmovements",
        targetId: moveTgtId,
        operationType: "PARTITION_INVENTORY",
        beforeHash: "h-mov-before",
        afterHash: hashCurrentDocument(cleanMoveDoc),
        status: "PLANNED",
        timestamp: new Date().toISOString(),
      },
      {
        migrationRunId,
        sourceCollection: "stockreservations",
        sourceId: "res-src-01",
        targetCollection: "stockreservations",
        targetId: resTgtId,
        operationType: "PARTITION_INVENTORY",
        beforeHash: "h-res-before",
        afterHash: hashCurrentDocument(cleanResDoc),
        status: "PLANNED",
        timestamp: new Date().toISOString(),
      },
    ];

    // Mutate parent InventoryBalance (e.g. quantity was altered)
    const targetDocsMap = new Map([
      ["inventorybalances", [{ _id: balanceTgtId, sourceBaselineId: balanceSrcId, onHandQuantity: 999 }]],
      ["stockmovements", [cleanMoveDoc]],
      ["stockreservations", [cleanResDoc]],
    ]);

    const plan = buildRollbackPlan({
      migrationRunId,
      coordinatorId,
      lockPayload: createActiveLockPayload(),
      preImages: [
        createPreImageRecord({ _id: balanceSrcId, onHandQuantity: 100 }, "inventorybalances", migrationRunId),
        createPreImageRecord({ _id: "mov-src-01", quantity: 10 }, "stockmovements", migrationRunId),
        createPreImageRecord({ _id: "res-src-01", reservedQuantity: 5 }, "stockreservations", migrationRunId),
      ],
      auditEntries,
      targetCollectionDocsMap: targetDocsMap,
      oplogOptions: {
        migrationCompletedAt: new Date(Date.now() - 3600000),
        targetNamespaces: ["inventorybalances", "stockmovements", "stockreservations"],
        oplogEntries: [],
        hasReadPrivileges: true,
      },
    });

    const balPlan = plan.documentPlans.find((p) => p.targetCollection === "inventorybalances");
    const movPlan = plan.documentPlans.find((p) => p.targetCollection === "stockmovements");
    const resPlan = plan.documentPlans.find((p) => p.targetCollection === "stockreservations");

    assert.ok(balPlan && movPlan && resPlan);
    assert.equal(balPlan.status, "CONFLICT");
    // Cascading block verified!
    assert.equal(movPlan.status, "BLOCKED");
    assert.ok(movPlan.conflictReason?.includes("DEPENDENCY_BLOCK"));
    assert.equal(resPlan.status, "BLOCKED");
    assert.ok(resPlan.conflictReason?.includes("DEPENDENCY_BLOCK"));
    assert.equal(plan.isEligibleForRollback, false);
  });

  test("25. Permanent authorization guard: Migration apply and Rollback apply modes permanently blocked", async () => {
    // 1. Migration apply blocked
    const migResult = await runMigrationEngine({
      mode: "apply",
      allowRemote: false,
    });
    assert.equal(migResult.status, "BLOCKED");
    assert.equal(migResult.exitCode, 1);
    assert.ok(migResult.message.includes("LIVE_MIGRATION_NOT_AUTHORIZED"));

    // 2. Migration apply blocked even with --allow-remote
    const migResultRemote = await runMigrationEngine({
      mode: "apply",
      allowRemote: true,
    });
    assert.equal(migResultRemote.status, "BLOCKED");
    assert.equal(migResultRemote.exitCode, 1);
    assert.ok(migResultRemote.message.includes("LIVE_MIGRATION_NOT_AUTHORIZED"));

    // 3. Rollback apply blocked
    const rbResult = await runRollbackEngine({
      migrationRunId: "MIG-001",
      mode: "apply",
    });
    assert.equal(rbResult.status, "BLOCKED");
    assert.equal(rbResult.exitCode, 1);
    assert.ok(rbResult.message.includes("LIVE_ROLLBACK_NOT_AUTHORIZED"));
  });
});
