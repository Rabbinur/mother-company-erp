import { test, describe } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
  partitionInventoryBalance,
  InventoryReconciliationError,
  DuplicateTargetKeyError,
} from "../src/lib/migration/inventory-partitioner.ts";

import {
  createPreImageRecord,
  serializeToBson,
  deserializeFromBson,
  verifyPreImageRoundTrip,
  detectOrphanedGridFsChunks,
  canonicalSort,
  ArchiveHashMismatchError,
  GRIDFS_THRESHOLD_BYTES,
} from "../src/lib/migration/pre-image-archive.ts";

import {
  APPROVED_INVENTORY_INDEXES,
  validateAtlasPartialFilter,
  detectIndexDuplicates,
  matchesPartialFilter,
} from "../src/lib/migration/index-planner.ts";

import {
  validateMigrationLock,
  simulateTransactionBarrierCheck,
} from "../src/lib/migration/fence-guard.ts";

import {
  runMigrationEngine,
  formatMigrationOutput,
} from "../scripts/migrate-legacy-tenancy.ts";

describe("Phase 2B: Inventory 1:N Partitioning & Quantity Reconciliation", () => {
  const businessId = new mongoose.Types.ObjectId();
  const warehouseId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  const variantId = new mongoose.Types.ObjectId();
  const dealershipA = new mongoose.Types.ObjectId();
  const dealershipB = new mongoose.Types.ObjectId();

  test("Normal 1:N inventory partition: 100% allocated to single dealership", () => {
    const legacy = {
      _id: new mongoose.Types.ObjectId(),
      warehouseId,
      productId,
      variantId,
      onHandQuantity: 100,
      reservedQuantity: 20,
      damagedQuantity: 5,
      stockInTransit: 10,
    };

    const result = partitionInventoryBalance(legacy, businessId, "RUN-001", [
      { dealershipId: dealershipA, exactOnHand: 100, exactReserved: 20, exactDamaged: 5, exactInTransit: 10 },
    ]);

    assert.equal(result.targetPartitions.length, 1);
    const target = result.targetPartitions[0];
    assert.equal(target.dealershipId.toString(), dealershipA.toString());
    assert.equal(target.onHandQuantity, 100);
    assert.equal(target.reservedQuantity, 20);
    assert.equal(target.availableQuantity, 80);
    assert.equal(target.damagedQuantity, 5);
    assert.equal(target.stockInTransit, 10);
    assert.equal(target.partitionStatus, "active");
    assert.equal(result.reconciliation.isBalanced, true);
    assert.equal(result.reconciliation.onHandDelta, 0);
  });

  test("Multiple dealership partitions: split between dealerships with zero delta", () => {
    const legacy = {
      _id: new mongoose.Types.ObjectId(),
      warehouseId,
      productId,
      variantId,
      onHandQuantity: 100,
      reservedQuantity: 20,
      damagedQuantity: 0,
      stockInTransit: 0,
    };

    const result = partitionInventoryBalance(legacy, businessId, "RUN-001", [
      { dealershipId: dealershipA, exactOnHand: 60, exactReserved: 12 },
      { dealershipId: dealershipB, exactOnHand: 40, exactReserved: 8 },
    ]);

    assert.equal(result.targetPartitions.length, 2);
    assert.equal(result.reconciliation.isBalanced, true);
    assert.equal(result.reconciliation.totalOnHand, 100);
    assert.equal(result.reconciliation.totalReserved, 20);
  });

  test("Unresolved ownership quarantine: allocates 100% to quarantine with dealershipId: null", () => {
    const legacy = {
      _id: new mongoose.Types.ObjectId(),
      warehouseId,
      productId,
      variantId,
      onHandQuantity: 50,
      reservedQuantity: 10,
      damagedQuantity: 2,
      stockInTransit: 0,
    };

    // No allocations passed -> 100% quarantine
    const result = partitionInventoryBalance(legacy, businessId, "RUN-001", []);

    assert.equal(result.targetPartitions.length, 1);
    const target = result.targetPartitions[0];
    assert.equal(target.dealershipId, null); // EXPLICIT NULL
    assert.equal(target.partitionStatus, "quarantined");
    assert.equal(target.onHandQuantity, 50);
    assert.equal(result.isQuarantined, true);
    assert.equal(result.reconciliation.isBalanced, true);
  });

  test("Missing versus explicit-null dealershipId: quarantine strictly produces explicit null", () => {
    const legacy = {
      _id: new mongoose.Types.ObjectId(),
      warehouseId,
      productId,
      variantId,
      onHandQuantity: 30,
      reservedQuantity: 0,
      damagedQuantity: 0,
      stockInTransit: 0,
    };

    const result = partitionInventoryBalance(legacy, businessId, "RUN-001", []);
    const target = result.targetPartitions[0];
    assert.ok(target.hasOwnProperty("dealershipId"));
    assert.equal(target.dealershipId, null);
    assert.notEqual(target.dealershipId, undefined);
  });

  test("Fractional remainder is safely quarantined with dealershipId: null", () => {
    const legacy = {
      _id: new mongoose.Types.ObjectId(),
      warehouseId,
      productId,
      variantId,
      onHandQuantity: 101, // odd quantity
      reservedQuantity: 0,
      damagedQuantity: 0,
      stockInTransit: 0,
    };

    // Split 50% to Dealership A (floor = 50), remainder 51 goes to quarantine
    const result = partitionInventoryBalance(legacy, businessId, "RUN-001", [
      { dealershipId: dealershipA, ratio: 0.5 },
    ]);

    assert.equal(result.targetPartitions.length, 2);
    const active = result.targetPartitions.find((p) => p.partitionStatus === "active");
    const quarantined = result.targetPartitions.find((p) => p.partitionStatus === "quarantined");

    assert.equal(active.onHandQuantity, 50);
    assert.equal(quarantined.onHandQuantity, 51);
    assert.equal(quarantined.dealershipId, null);
    assert.equal(result.reconciliation.isBalanced, true);
  });

  test("Duplicate target inventory keys throws DuplicateTargetKeyError", () => {
    const legacy = {
      _id: new mongoose.Types.ObjectId(),
      warehouseId,
      productId,
      variantId,
      onHandQuantity: 100,
      reservedQuantity: 0,
      damagedQuantity: 0,
      stockInTransit: 0,
    };

    // Allocating twice to same dealership
    assert.throws(
      () =>
        partitionInventoryBalance(legacy, businessId, "RUN-001", [
          { dealershipId: dealershipA, exactOnHand: 50 },
          { dealershipId: dealershipA, exactOnHand: 50 }, // Duplicate!
        ]),
      DuplicateTargetKeyError
    );
  });

  test("Negative baseline inventory throws InventoryReconciliationError", () => {
    const corruptLegacy = {
      _id: new mongoose.Types.ObjectId(),
      warehouseId,
      productId,
      variantId,
      onHandQuantity: -10,
      reservedQuantity: 0,
      damagedQuantity: 0,
      stockInTransit: 0,
    };

    assert.throws(
      () => partitionInventoryBalance(corruptLegacy, businessId, "RUN-001", []),
      InventoryReconciliationError
    );
  });
});

describe("Phase 2B: BSON Pre-Image Archive & GridFS Fallback", () => {
  test("BSON pre-image round-trip preserves Decimal128, Date, ObjectId, and subdocuments", () => {
    const originalDoc = {
      _id: new mongoose.Types.ObjectId(),
      amount: new mongoose.mongo.Decimal128("12345.67"),
      date: new Date("2026-11-21T12:00:00Z"),
      subDoc: {
        code: "ITEM-01",
        tags: ["electronics", "mobile"],
      },
    };

    const { buffer, sha256 } = serializeToBson(originalDoc);
    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(/^[0-9a-f]{64}$/.test(sha256));

    const { isValid, restoredDoc } = verifyPreImageRoundTrip(buffer, sha256);
    assert.equal(isValid, true);
    assert.equal(restoredDoc._id.toString(), originalDoc._id.toString());
    assert.equal(restoredDoc.amount.toString(), "12345.67");
    assert.equal(restoredDoc.date.toISOString(), "2026-11-21T12:00:00.000Z");
    assert.equal(restoredDoc.subDoc.code, "ITEM-01");
  });

  test("Hash mismatch detection throws ArchiveHashMismatchError", () => {
    const doc = { _id: new mongoose.Types.ObjectId(), name: "Original" };
    const { buffer } = serializeToBson(doc);
    const corruptedHash = "0000000000000000000000000000000000000000000000000000000000000000";

    assert.throws(
      () => verifyPreImageRoundTrip(buffer, corruptedHash),
      ArchiveHashMismatchError
    );
  });

  test("GridFS fallback activates when document size >= 15 MB", () => {
    const doc = { _id: new mongoose.Types.ObjectId(), name: "LargeDoc" };
    const mockSize = 16 * 1024 * 1024; // 16 MB

    const preImage = createPreImageRecord(doc, "inventorybalances", "RUN-001", mockSize);

    assert.equal(preImage.storageType, "gridfs");
    assert.ok(preImage.gridfsFileId);
    assert.ok(preImage.chunkCount > 0);
    assert.equal(preImage.payload, undefined); // Not stored inline
  });

  test("Inline storage activates when document size < 15 MB", () => {
    const doc = { _id: new mongoose.Types.ObjectId(), name: "NormalDoc" };

    const preImage = createPreImageRecord(doc, "inventorybalances", "RUN-001");

    assert.equal(preImage.storageType, "inline");
    assert.ok(preImage.payload);
    assert.equal(preImage.gridfsFileId, undefined);
  });

  test("GridFS orphan detection identifies unlinked chunk records", () => {
    const file1 = { _id: new mongoose.Types.ObjectId() };
    const orphanedFileId = new mongoose.Types.ObjectId();

    const chunks = [
      { files_id: file1._id, n: 0 },
      { files_id: file1._id, n: 1 },
      { files_id: orphanedFileId, n: 0 }, // Orphan!
      { files_id: orphanedFileId, n: 1 }, // Orphan!
    ];

    const orphans = detectOrphanedGridFsChunks(chunks, [file1]);
    assert.equal(orphans.length, 2);
    assert.equal(orphans[0].files_id.toString(), orphanedFileId.toString());
  });
});

describe("Phase 2B: Index Migration Planner & Duplicate Key Detection", () => {
  test("Approved indexes pass Atlas partialFilterExpression compatibility", () => {
    for (const indexDef of APPROVED_INVENTORY_INDEXES) {
      const check = validateAtlasPartialFilter(indexDef.partialFilterExpression);
      assert.equal(check.isAtlasCompatible, true);
      assert.equal(check.violations.length, 0);
    }
  });

  test("Atlas validator catches forbidden operators like $expr and $ne", () => {
    const badFilter = { status: { $ne: "deleted" }, $expr: { $gt: ["$a", "$b"] } };
    const check = validateAtlasPartialFilter(badFilter);
    assert.equal(check.isAtlasCompatible, false);
    assert.equal(check.violations.length, 2);
  });

  test("detectIndexDuplicates catches duplicate active dealership tuples", () => {
    const activeIndex = APPROVED_INVENTORY_INDEXES[0]; // uniq_inv_active_dealership
    const dId = new mongoose.Types.ObjectId();
    const wId = new mongoose.Types.ObjectId();
    const pId = new mongoose.Types.ObjectId();
    const vId = new mongoose.Types.ObjectId();
    const bId = new mongoose.Types.ObjectId();

    const docs = [
      { _id: "1", businessId: bId, dealershipId: dId, warehouseId: wId, productId: pId, variantId: vId },
      { _id: "2", businessId: bId, dealershipId: dId, warehouseId: wId, productId: pId, variantId: vId }, // Duplicate!
      { _id: "3", businessId: bId, dealershipId: null, warehouseId: wId, productId: pId, variantId: vId }, // Quarantine (ignored by active filter)
    ];

    const result = detectIndexDuplicates(docs, activeIndex);
    assert.equal(result.hasDuplicates, true);
    assert.equal(result.duplicateCount, 1);
  });

  test("detectIndexDuplicates passes when active dealership stock is unique", () => {
    const activeIndex = APPROVED_INVENTORY_INDEXES[0];
    const wId = new mongoose.Types.ObjectId();
    const pId = new mongoose.Types.ObjectId();
    const vId = new mongoose.Types.ObjectId();
    const bId = new mongoose.Types.ObjectId();

    const docs = [
      { _id: "1", businessId: bId, dealershipId: new mongoose.Types.ObjectId(), warehouseId: wId, productId: pId, variantId: vId },
      { _id: "2", businessId: bId, dealershipId: new mongoose.Types.ObjectId(), warehouseId: wId, productId: pId, variantId: vId },
    ];

    const result = detectIndexDuplicates(docs, activeIndex);
    assert.equal(result.hasDuplicates, false);
  });
});

describe("Phase 2B: Fence Guard & Write-Barrier Integration", () => {
  const coordinatorId = "COORD_TEST_01";

  test("Valid active lock passes fence validation", () => {
    const lockPayload = {
      locked: true,
      armed: true,
      lockHolder: coordinatorId,
      fenceEpoch: 5,
      leaseExpiresAt: new Date(Date.now() + 60000),
    };

    const result = validateMigrationLock(lockPayload, coordinatorId, 1);
    assert.equal(result.isValid, true);
    assert.equal(result.currentEpoch, 5);
  });

  test("Missing lock document fails validation", () => {
    const result = validateMigrationLock(null, coordinatorId, 1);
    assert.equal(result.isValid, false);
    assert.ok(result.error.includes("does not exist"));
  });

  test("Expired TTL lease fails validation", () => {
    const expiredLock = {
      locked: true,
      armed: true,
      lockHolder: coordinatorId,
      fenceEpoch: 5,
      leaseExpiresAt: new Date(Date.now() - 1000), // Expired!
    };

    const result = validateMigrationLock(expiredLock, coordinatorId, 1);
    assert.equal(result.isValid, false);
    assert.equal(result.isExpired, true);
    assert.ok(result.error.includes("lease expired"));
  });

  test("Stale coordinator epoch fails validation", () => {
    const lockPayload = {
      locked: true,
      armed: true,
      lockHolder: coordinatorId,
      fenceEpoch: 2,
      leaseExpiresAt: new Date(Date.now() + 60000),
    };

    const result = validateMigrationLock(lockPayload, coordinatorId, 5); // Expected min epoch 5!
    assert.equal(result.isValid, false);
    assert.equal(result.isStaleEpoch, true);
    assert.ok(result.error.includes("stale"));
  });

  test("Lock held by different coordinator fails validation", () => {
    const lockPayload = {
      locked: true,
      armed: true,
      lockHolder: "ANOTHER_COORDINATOR",
      fenceEpoch: 5,
      leaseExpiresAt: new Date(Date.now() + 60000),
    };

    const result = validateMigrationLock(lockPayload, coordinatorId, 1);
    assert.equal(result.isValid, false);
    assert.ok(result.error.includes("held by another process"));
  });

  test("Simulate transaction write conflict throws WiredTiger error 112", () => {
    const activeLock = { locked: true, armed: true, fenceEpoch: 2 };
    const inFlightTxEpoch = 1; // Started before lock acquisition!

    const barrierCheck = simulateTransactionBarrierCheck(inFlightTxEpoch, activeLock);
    assert.equal(barrierCheck.canCommit, false);
    assert.equal(barrierCheck.writeConflict, true);
    assert.equal(barrierCheck.errorCode, 112);
  });
});

describe("Phase 2B: Migration Engine CLI & Safety Restrictions", () => {
  test("Dry-run produces complete verified plan and ZERO writes", async () => {
    const wId = new mongoose.Types.ObjectId();
    const pId = new mongoose.Types.ObjectId();
    const vId = new mongoose.Types.ObjectId();

    const sampleBalances = [
      {
        _id: new mongoose.Types.ObjectId(),
        warehouseId: wId,
        productId: pId,
        variantId: vId,
        onHandQuantity: 100,
        reservedQuantity: 10,
        damagedQuantity: 0,
        stockInTransit: 0,
      },
    ];

    const result = await runMigrationEngine({
      mode: "dry-run",
      sourceBalances: sampleBalances,
      businessName: "Test Dealership Enterprise",
    });

    assert.equal(result.status, "PLAN_READY");
    assert.equal(result.exitCode, 0);
    assert.ok(result.planReport);
    assert.equal(result.planReport.stage, "ARCHIVE_VERIFIED");
    assert.equal(result.planReport.summary.totalSourceBalances, 1);
    assert.equal(result.planReport.reconciliation.isBalanced, true);
  });

  test("Apply mode is ALWAYS BLOCKED with LIVE_MIGRATION_NOT_AUTHORIZED", async () => {
    const result = await runMigrationEngine({
      mode: "apply",
    });

    assert.equal(result.status, "BLOCKED");
    assert.equal(result.exitCode, 1);
    assert.ok(result.message.includes("LIVE_MIGRATION_NOT_AUTHORIZED"));
  });

  test("Allow-remote flag does NOT unblock apply mode", async () => {
    const result = await runMigrationEngine({
      mode: "apply",
      allowRemote: true,
      mongoUri: "mongodb+srv://admin:pass@cluster0.mongodb.net/erp",
    });

    assert.equal(result.status, "BLOCKED");
    assert.equal(result.exitCode, 1);
    assert.ok(result.message.includes("LIVE_MIGRATION_NOT_AUTHORIZED"));
  });

  test("Remote connection without --allow-remote fails critical safety guard", async () => {
    const result = await runMigrationEngine({
      mode: "dry-run",
      mongoUri: "mongodb+srv://admin:pass@cluster0.mongodb.net/erp",
      allowRemote: false,
    });

    assert.equal(result.status, "FAILED");
    assert.equal(result.exitCode, 1);
    assert.ok(result.message.includes("CRITICAL SAFETY VIOLATION"));
  });

  test("formatMigrationOutput formats expected terminal text", () => {
    const mockResult = {
      erpName: "Dealership Management",
      mode: "dry-run",
      targetUriMasked: "mongodb://admin:***@127.0.0.1:27017/erp",
      status: "PLAN_READY",
      exitCode: 0,
      message: "Dry-run plan ready",
    };

    const formatted = formatMigrationOutput(mockResult);
    assert.ok(formatted.includes("LEGACY TENANCY MIGRATION ENGINE — Dealership Management"));
    assert.ok(formatted.includes("[PLAN_READY]"));
  });
});
