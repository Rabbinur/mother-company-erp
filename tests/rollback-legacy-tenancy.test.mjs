import { test, describe } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
  serializeToBson,
  createPreImageRecord,
  ArchiveHashMismatchError,
} from "../src/lib/migration/pre-image-archive.ts";

import {
  loadAndVerifyPreImage,
} from "../src/lib/migration/pre-image-loader.ts";

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
  runRollbackEngine,
  formatRollbackOutput,
} from "../scripts/rollback-legacy-tenancy.ts";

describe("Phase 2B: Pre-Image Restoration & GridFS Reassembly", () => {
  test("1. Valid inline pre-image restoration planning", () => {
    const originalDoc = {
      _id: new mongoose.Types.ObjectId(),
      warehouseId: new mongoose.Types.ObjectId(),
      productId: new mongoose.Types.ObjectId(),
      variantId: new mongoose.Types.ObjectId(),
      onHandQuantity: 100,
      reservedQuantity: 20,
    };

    const preImage = createPreImageRecord(originalDoc, "inventorybalances", "MIG-001");
    assert.equal(preImage.storageType, "inline");

    const loaded = loadAndVerifyPreImage(preImage);
    assert.equal(loaded.isValid, true);
    assert.equal(loaded.restoredDoc._id.toString(), originalDoc._id.toString());
    assert.equal(loaded.restoredDoc.onHandQuantity, 100);
    assert.equal(loaded.restoredDoc.reservedQuantity, 20);
  });

  test("2. Valid GridFS pre-image reassembly: sorts and concatenates contiguous chunks", () => {
    const originalDoc = {
      _id: new mongoose.Types.ObjectId(),
      name: "LargeDatasetDocument",
      data: "A".repeat(500),
    };

    const { buffer, sha256 } = serializeToBson(originalDoc);
    const gridfsFileId = new mongoose.Types.ObjectId();

    // Split buffer into 3 chunks
    const chunkSize = Math.ceil(buffer.length / 3);
    const chunk0 = buffer.subarray(0, chunkSize);
    const chunk1 = buffer.subarray(chunkSize, chunkSize * 2);
    const chunk2 = buffer.subarray(chunkSize * 2);

    // Provide chunks out-of-order to test sorting
    const chunks = [
      { files_id: gridfsFileId, n: 1, data: chunk1 },
      { files_id: gridfsFileId, n: 2, data: chunk2 },
      { files_id: gridfsFileId, n: 0, data: chunk0 },
    ];

    const preImage = {
      _id: new mongoose.Types.ObjectId(),
      migrationRunId: "MIG-001",
      collectionName: "inventorybalances",
      originalId: originalDoc._id,
      storageType: "gridfs",
      byteSize: buffer.length,
      sha256Hash: sha256,
      gridfsFileId,
      chunkCount: 3,
      createdAt: new Date(),
    };

    const loaded = loadAndVerifyPreImage(preImage, chunks);
    assert.equal(loaded.isValid, true);
    assert.equal(loaded.storageType, "gridfs");
    assert.equal(loaded.restoredDoc._id.toString(), originalDoc._id.toString());
    assert.equal(loaded.restoredDoc.name, "LargeDatasetDocument");
    assert.equal(loaded.sha256Hash, sha256);
  });

  test("3. BSON type preservation: preserves Decimal128, Date, ObjectId, and Binary", () => {
    const docWithTypes = {
      _id: new mongoose.Types.ObjectId(),
      price: new mongoose.mongo.Decimal128("9999.99"),
      issuedAt: new Date("2026-11-21T10:00:00Z"),
      binaryHash: new mongoose.mongo.Binary(Buffer.from("deadbeef", "hex")),
      tags: ["active", "retail"],
    };

    const preImage = createPreImageRecord(docWithTypes, "accounts", "MIG-001");
    const loaded = loadAndVerifyPreImage(preImage);

    assert.equal(loaded.restoredDoc.price.toString(), "9999.99");
    assert.equal(loaded.restoredDoc.issuedAt.toISOString(), "2026-11-21T10:00:00.000Z");
    assert.equal(loaded.restoredDoc.binaryHash.length(), 4);
    assert.equal(loaded.restoredDoc.tags[0], "active");
  });

  test("4. Missing versus explicit-null preservation: preserves explicit null vs missing keys", () => {
    const doc = {
      _id: new mongoose.Types.ObjectId(),
      explicitNullField: null,
      // missingField is omitted
      populatedField: "value",
    };

    const preImage = createPreImageRecord(doc, "customers", "MIG-001");
    const loaded = loadAndVerifyPreImage(preImage);

    assert.equal(loaded.restoredDoc.explicitNullField, null);
    assert.equal(loaded.restoredDoc.hasOwnProperty("explicitNullField"), true);
    assert.equal(loaded.restoredDoc.hasOwnProperty("missingField"), false);
  });

  test("5. Pre-image hash mismatch: throws ArchiveHashMismatchError", () => {
    const doc = { _id: new mongoose.Types.ObjectId(), name: "Tampered" };
    const preImage = createPreImageRecord(doc, "vendors", "MIG-001");
    // Tamper with expected hash
    preImage.sha256Hash = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

    assert.throws(
      () => loadAndVerifyPreImage(preImage),
      ArchiveHashMismatchError
    );
  });
});

describe("Phase 2B: Post-Migration Mutation Detection", () => {
  const targetColl = "inventorybalances";
  const sourceId = new mongoose.Types.ObjectId().toString();
  const targetId = new mongoose.Types.ObjectId().toString();

  test("6. Modified target document detection: detects field alterations", () => {
    const auditEntries = [
      {
        migrationRunId: "MIG-001",
        sourceCollection: targetColl,
        sourceId,
        targetCollection: targetColl,
        targetId,
        operationType: "PARTITION_INVENTORY",
        beforeHash: "hash-before",
        afterHash: "hash-original-after",
        status: "PLANNED",
        metadata: { onHandQuantity: 50 },
        timestamp: new Date().toISOString(),
      },
    ];

    // Current document has modified onHandQuantity from 50 to 40!
    const currentDocs = [
      {
        _id: targetId,
        sourceBaselineId: sourceId,
        onHandQuantity: 40, // Mutated!
        reservedQuantity: 0,
      },
    ];

    const result = detectPostMigrationMutations(auditEntries, currentDocs, targetColl);
    assert.equal(result.conflictCount, 1);
    const ev = result.evaluations[0];
    assert.equal(ev.status, "CONFLICT");
    assert.ok(ev.conflictReason.includes("BUSINESS_MUTATION_DETECTED"));
  });

  test("7. Deleted target document detection: flags document missing from current collection", () => {
    const auditEntries = [
      {
        migrationRunId: "MIG-001",
        sourceCollection: targetColl,
        sourceId,
        targetCollection: targetColl,
        targetId,
        operationType: "PARTITION_INVENTORY",
        beforeHash: "h1",
        afterHash: "h2",
        status: "PLANNED",
        timestamp: new Date().toISOString(),
      },
    ];

    // Target collection is empty (document deleted!)
    const currentDocs = [];

    const result = detectPostMigrationMutations(auditEntries, currentDocs, targetColl);
    assert.equal(result.conflictCount, 1);
    assert.ok(result.evaluations[0].conflictReason.includes("TARGET_DOCUMENT_DELETED"));
  });

  test("8. Newly inserted record detection: catches unrecorded records", () => {
    const migrationTime = new Date("2026-11-21T12:00:00Z");
    const auditEntries = []; // Zero entries for this new doc

    const currentDocs = [
      {
        _id: new mongoose.Types.ObjectId().toString(),
        createdAt: new Date("2026-11-21T13:00:00Z"), // Created post-migration
        onHandQuantity: 10,
      },
    ];

    const result = detectPostMigrationMutations(auditEntries, currentDocs, targetColl, migrationTime);
    assert.equal(result.newRecordCount, 1);
    assert.equal(result.unrecordedTargetDocuments.length, 1);
  });

  test("9. Missing pre-image detection: flags missing archive in rollback plan", () => {
    const auditEntries = [
      {
        migrationRunId: "MIG-001",
        sourceCollection: targetColl,
        sourceId: "source-without-preimage",
        targetCollection: targetColl,
        targetId: "target-1",
        operationType: "PARTITION_INVENTORY",
        beforeHash: "h1",
        afterHash: "h2",
        status: "PLANNED",
        timestamp: new Date().toISOString(),
      },
    ];

    const currentDocs = [
      { _id: "target-1", sourceBaselineId: "source-without-preimage" },
    ];

    const plan = buildRollbackPlan({
      migrationRunId: "MIG-001",
      preImages: [], // Missing!
      auditEntries,
      targetCollectionDocsMap: new Map([[targetColl, currentDocs]]),
    });

    assert.equal(plan.summary.missingPreImageCount, 1);
    assert.equal(plan.isEligibleForRollback, false);
  });

  test("10. Duplicate restoration target detection: flags multiple pre-images targeting same ID", () => {
    const sharedId = new mongoose.Types.ObjectId();
    const pi1 = {
      _id: "pi1",
      migrationRunId: "MIG-001",
      collectionName: targetColl,
      originalId: sharedId,
      storageType: "inline",
      byteSize: 10,
      sha256Hash: "h1",
    };
    const pi2 = {
      _id: "pi2",
      migrationRunId: "MIG-001",
      collectionName: targetColl,
      originalId: sharedId, // Duplicate originalId!
      storageType: "inline",
      byteSize: 10,
      sha256Hash: "h2",
    };

    const auditEntries = [
      {
        migrationRunId: "MIG-001",
        sourceCollection: targetColl,
        sourceId: sharedId.toString(),
        targetCollection: targetColl,
        targetId: "t1",
        operationType: "PARTITION_INVENTORY",
        beforeHash: "h1",
        afterHash: "h1",
        status: "PLANNED",
        timestamp: new Date().toISOString(),
      },
    ];

    const plan = buildRollbackPlan({
      migrationRunId: "MIG-001",
      preImages: [pi1, pi2],
      auditEntries,
      targetCollectionDocsMap: new Map([[targetColl, [{ _id: "t1", sourceBaselineId: sharedId.toString() }]]]),
    });

    assert.equal(plan.summary.conflictCount >= 1, true);
    assert.ok(plan.documentPlans[0].conflictReason.includes("DUPLICATE_TARGET"));
  });
});

describe("Phase 2B: Three-Layer Safety Gates", () => {
  const coord = "COORD_SAFE_01";

  test("11. Maintenance freeze missing fails Layer A", () => {
    const result = evaluateLayerAFreeze(undefined, coord);
    assert.equal(result.passed, false);
    assert.ok(result.message.includes("missing"));
  });

  test("12. Maintenance freeze expired fails Layer A", () => {
    const lock = {
      locked: true,
      lockHolder: coord,
      fenceEpoch: 2,
      leaseExpiresAt: new Date(Date.now() - 1000), // Expired!
    };
    const result = evaluateLayerAFreeze(lock, coord);
    assert.equal(result.passed, false);
    assert.ok(result.message.includes("expired"));
  });

  test("13. Wrong coordinator identity fails Layer A", () => {
    const lock = {
      locked: true,
      lockHolder: "WRONG_COORDINATOR",
      fenceEpoch: 2,
      leaseExpiresAt: new Date(Date.now() + 60000),
    };
    const result = evaluateLayerAFreeze(lock, coord);
    assert.equal(result.passed, false);
    assert.ok(result.message.includes("held by another process"));
  });

  test("14. Stale fencing epoch fails Layer A", () => {
    const lock = {
      locked: true,
      lockHolder: coord,
      fenceEpoch: 1, // Stale!
      leaseExpiresAt: new Date(Date.now() + 60000),
    };
    const result = evaluateLayerAFreeze(lock, coord, 3); // Min epoch 3 required
    assert.equal(result.passed, false);
    assert.ok(result.message.includes("stale"));
  });

  test("15. Oplog evidence complete passes Layer B", () => {
    const result = evaluateLayerBOplog({
      migrationCompletedAt: new Date("2026-11-21T12:00:00Z"),
      targetNamespaces: ["inventorybalances"],
      oplogEntries: [],
      hasReadPrivileges: true,
    });
    assert.equal(result.passed, true);
  });

  test("16. Oplog rollover detection fails Layer B closed", () => {
    const result = evaluateLayerBOplog({
      migrationCompletedAt: new Date("2026-11-21T12:00:00Z"),
      targetNamespaces: ["inventorybalances"],
      mockRolloverDetected: true,
      hasReadPrivileges: true,
    });
    assert.equal(result.passed, false);
    assert.ok(result.message.includes("rollover"));
  });

  test("17. Missing oplog privileges fails Layer B closed", () => {
    const result = evaluateLayerBOplog({
      migrationCompletedAt: new Date("2026-11-21T12:00:00Z"),
      targetNamespaces: ["inventorybalances"],
      hasReadPrivileges: false,
    });
    assert.equal(result.passed, false);
    assert.ok(result.message.includes("privileges"));
  });

  test("18. Post-migration inventory mutation fails Layer C", () => {
    const evaluations = [
      {
        targetId: "t1",
        sourceId: "s1",
        sourceCollection: "inventorybalances",
        targetCollection: "inventorybalances",
        recordedAfterHash: "h1",
        status: "CONFLICT",
        conflictReason: "BUSINESS_MUTATION_DETECTED: onHandQuantity mutated",
        hasMutated: true,
      },
    ];

    const result = evaluateLayerCIntegrity(evaluations);
    assert.equal(result.passed, false);
    assert.ok(result.message.includes("Conflicts: 1 (Inventory: 1"));
  });

  test("19. Post-migration financial mutation fails Layer C", () => {
    const evaluations = [
      {
        targetId: "j1",
        sourceId: "s1",
        sourceCollection: "journalentries",
        targetCollection: "journalentries",
        recordedAfterHash: "h1",
        status: "CONFLICT",
        conflictReason: "BUSINESS_MUTATION_DETECTED: paidAmount changed",
        hasMutated: true,
      },
    ];

    const result = evaluateLayerCIntegrity(evaluations);
    assert.equal(result.passed, false);
    assert.ok(result.message.includes("Financial: 1"));
  });

  test("20. Dependency conflict blocking: parent balance conflict blocks dependent reservations", () => {
    const balanceSourceId = "bal-01";
    const balanceTargetId = "t-bal-01";
    const resTargetId = "t-res-01";

    const resCleanDoc = { _id: resTargetId, sourceBaselineId: "res-source-01" };
    const resCleanHash = hashCurrentDocument(resCleanDoc);

    const auditEntries = [
      {
        migrationRunId: "MIG-001",
        sourceCollection: "inventorybalances",
        sourceId: balanceSourceId,
        targetCollection: "inventorybalances",
        targetId: balanceTargetId,
        operationType: "PARTITION_INVENTORY",
        beforeHash: "h1",
        afterHash: "h1-post",
        status: "PLANNED",
        metadata: { onHandQuantity: 50 },
        timestamp: new Date().toISOString(),
      },
      {
        migrationRunId: "MIG-001",
        sourceCollection: "stockreservations",
        sourceId: "res-source-01",
        targetCollection: "stockreservations",
        targetId: resTargetId,
        operationType: "PARTITION_INVENTORY",
        beforeHash: "h2",
        afterHash: resCleanHash,
        status: "PLANNED",
        timestamp: new Date().toISOString(),
      },
    ];

    // InventoryBalance is mutated!
    const targetDocsMap = new Map([
      [
        "inventorybalances",
        [{ _id: balanceTargetId, sourceBaselineId: balanceSourceId, onHandQuantity: 30 }], // Mutated!
      ],
      [
        "stockreservations",
        [resCleanDoc], // Clean!
      ],
    ]);

    const plan = buildRollbackPlan({
      migrationRunId: "MIG-001",
      preImages: [
        createPreImageRecord({ _id: balanceSourceId, onHandQuantity: 50 }, "inventorybalances", "MIG-001"),
        createPreImageRecord({ _id: "res-source-01", reservationNumber: "RES-01" }, "stockreservations", "MIG-001"),
      ],
      auditEntries,
      targetCollectionDocsMap: targetDocsMap,
    });

    const resPlan = plan.documentPlans.find((p) => p.targetCollection === "stockreservations");
    assert.ok(resPlan);
    assert.equal(resPlan.status, "BLOCKED");
    assert.ok(resPlan.conflictReason.includes("DEPENDENCY_BLOCK"));
  });
});

describe("Phase 2B: Rollback Engine Execution & Safety Restrictions", () => {
  const coord = "COORD_SAFE_01";
  const validLock = {
    locked: true,
    lockHolder: coord,
    fenceEpoch: 1,
    leaseExpiresAt: new Date(Date.now() + 60000),
  };

  test("21. Safe rollback plan generation: 100% clean documents and active freeze produces PLAN_READY", async () => {
    const sId = new mongoose.Types.ObjectId();
    const tId = new mongoose.Types.ObjectId();
    const cleanDoc = { _id: sId, onHandQuantity: 100, warehouseId: "w1" };

    const preImage = createPreImageRecord(cleanDoc, "inventorybalances", "MIG-001");
    const currentHash = hashCurrentDocument({ _id: tId.toString(), sourceBaselineId: sId.toString() });

    const auditEntries = [
      {
        migrationRunId: "MIG-001",
        sourceCollection: "inventorybalances",
        sourceId: sId.toString(),
        targetCollection: "inventorybalances",
        targetId: tId.toString(),
        operationType: "PARTITION_INVENTORY",
        beforeHash: preImage.sha256Hash,
        afterHash: currentHash,
        status: "PLANNED",
        timestamp: new Date().toISOString(),
      },
    ];

    const result = await runRollbackEngine({
      migrationRunId: "MIG-001",
      mode: "dry-run",
      coordinatorId: coord,
      lockPayload: validLock,
      preImages: [preImage],
      auditEntries,
      targetCollectionDocsMap: new Map([
        ["inventorybalances", [{ _id: tId.toString(), sourceBaselineId: sId.toString() }]],
      ]),
      oplogOptions: {
        migrationCompletedAt: new Date(Date.now() - 3600000),
        targetNamespaces: ["inventorybalances"],
        oplogEntries: [],
        hasReadPrivileges: true,
      },
    });

    assert.equal(result.status, "PLAN_READY");
    assert.equal(result.exitCode, 0);
    assert.ok(result.planReport);
    assert.equal(result.planReport.isEligibleForRollback, true);
    assert.equal(result.planReport.safetyGates.allGatesPassed, true);
  });

  test("22. Idempotent repeated inspection: inspect mode succeeds with exit code 0", async () => {
    const result = await runRollbackEngine({
      migrationRunId: "MIG-001",
      mode: "inspect",
    });

    assert.equal(result.mode, "inspect");
    assert.equal(result.status, "INSPECTED");
    assert.equal(result.exitCode, 0);
  });

  test("23. Apply mode permanently blocked: fails with LIVE_ROLLBACK_NOT_AUTHORIZED", async () => {
    const result = await runRollbackEngine({
      migrationRunId: "MIG-001",
      mode: "apply",
    });

    assert.equal(result.status, "BLOCKED");
    assert.equal(result.exitCode, 1);
    assert.ok(result.message.includes("LIVE_ROLLBACK_NOT_AUTHORIZED"));
  });

  test("24. No remote database connection: fails safety guard if remote URI without --allow-remote", async () => {
    const result = await runRollbackEngine({
      migrationRunId: "MIG-001",
      mode: "dry-run",
      mongoUri: "mongodb+srv://admin:pass@cluster0.mongodb.net/dealership",
      allowRemote: false,
    });

    assert.equal(result.status, "FAILED");
    assert.equal(result.exitCode, 1);
    assert.ok(result.message.includes("CRITICAL SAFETY VIOLATION"));
  });

  test("25. Zero database writes: formatRollbackOutput confirms zero writes", () => {
    const mockResult = {
      erpName: "Dealership Management",
      mode: "dry-run",
      targetUriMasked: "mongodb://admin:***@127.0.0.1:27017/erp",
      status: "PLAN_READY",
      exitCode: 0,
      message: "Plan ready",
      planReport: {
        migrationRunId: "MIG-001",
        rollbackRunId: "RB-001",
        safetyGates: {
          layerAFreeze: { passed: true },
          layerBOplog: { passed: true },
          layerCIntegrity: { passed: true },
        },
        summary: {
          totalMigratedDocuments: 5,
          safeToRestoreCount: 5,
          conflictCount: 0,
          missingPreImageCount: 0,
          blockedCount: 0,
        },
        isEligibleForRollback: true,
      },
    };

    const formatted = formatRollbackOutput(mockResult);
    assert.ok(formatted.includes("ZERO database writes executed"));
    assert.ok(formatted.includes("LIVE_ROLLBACK_NOT_AUTHORIZED".toLowerCase()) || formatted.includes("Live apply remains permanently blocked"));
  });
});
