import { test, describe } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
  maskMongoUri,
  isRemoteClusterUri,
  validateMigrationMode,
} from "../src/lib/migration/safe-env.ts";

import {
  runPreflightChecks,
  formatTerminalReport,
} from "../scripts/preflight-tenancy-check.ts";

describe("Phase 2B: Preflight Safe Environment & Secrets Masking", () => {
  test("maskMongoUri: Masks credentials in standard mongodb:// URI", () => {
    const raw = "mongodb://dbuser:superSecretPassword123@127.0.0.1:27017/erp_db";
    const masked = maskMongoUri(raw);
    assert.equal(masked, "mongodb://dbuser:***@127.0.0.1:27017/erp_db");
    assert.equal(masked.includes("superSecretPassword123"), false);
  });

  test("maskMongoUri: Masks credentials in Atlas mongodb+srv:// URI", () => {
    const raw = "mongodb+srv://admin_root:AtlasSecret_2026!@cluster0.xyz123.mongodb.net/dealership?retryWrites=true";
    const masked = maskMongoUri(raw);
    assert.equal(
      masked,
      "mongodb+srv://admin_root:***@cluster0.xyz123.mongodb.net/dealership?retryWrites=true"
    );
    assert.equal(masked.includes("AtlasSecret_2026!"), false);
  });

  test("maskMongoUri: Handles null, undefined, and non-string safely", () => {
    assert.equal(maskMongoUri(null), "[NOT_CONFIGURED]");
    assert.equal(maskMongoUri(undefined), "[NOT_CONFIGURED]");
    assert.equal(maskMongoUri(""), "[NOT_CONFIGURED]");
  });

  test("isRemoteClusterUri: Correctly identifies Atlas and remote hostnames", () => {
    assert.equal(
      isRemoteClusterUri("mongodb+srv://user:pass@cluster0.mongodb.net/db"),
      true
    );
    assert.equal(
      isRemoteClusterUri("mongodb://prod-db.mother-company.internal:27017/db"),
      true
    );
    assert.equal(
      isRemoteClusterUri("mongodb://user:pass@10.0.1.50:27017/db"),
      true
    );
  });

  test("isRemoteClusterUri: Correctly identifies safe local and memory fixtures", () => {
    assert.equal(isRemoteClusterUri("mongodb://localhost:27017/test_db"), false);
    assert.equal(isRemoteClusterUri("mongodb://127.0.0.1:27017/test_db"), false);
    assert.equal(isRemoteClusterUri("mongodb://::1:27017/test_db"), false);
  });

  test("validateMigrationMode: Accepts valid modes and rejects invalid strings", () => {
    assert.equal(validateMigrationMode("inspection"), "inspection");
    assert.equal(validateMigrationMode("dry-run"), "dry-run");
    assert.equal(validateMigrationMode("apply"), "apply");
    assert.equal(validateMigrationMode(null), "inspection");
    assert.throws(() => validateMigrationMode("invalid_mode"), /Invalid migration mode/);
  });
});

describe("Phase 2B: Preflight Static Schema & Safety Guard Verification", () => {
  test("Remote cluster safety guard fails critical if --allow-remote is missing", async () => {
    const report = await runPreflightChecks({
      mongoUri: "mongodb+srv://user:pass@cluster0.mongodb.net/dealership",
      allowRemote: false,
    });

    const env02 = report.checks.find((c) => c.id === "ENV-02");
    assert.ok(env02);
    assert.equal(env02.status, "FAILED");
    assert.equal(env02.critical, true);
    assert.equal(report.isEligibleForMigration, false);
  });

  test("Remote cluster passes when --allow-remote is explicitly passed", async () => {
    const report = await runPreflightChecks({
      mongoUri: "mongodb+srv://user:pass@cluster0.mongodb.net/dealership",
      allowRemote: true,
    });

    const env02 = report.checks.find((c) => c.id === "ENV-02");
    assert.ok(env02);
    assert.equal(env02.status, "PASSED");
  });

  test("Verifies all 33 Mongoose models and InventoryBalance schema rules", async () => {
    const report = await runPreflightChecks({
      mongoUri: "mongodb://127.0.0.1:27017/test_db",
    });

    const schema01 = report.checks.find((c) => c.id === "SCHEMA-01");
    assert.ok(schema01);
    assert.equal(schema01.status, "PASSED");
    assert.equal(schema01.details?.verifiedCount, 33);

    const schema02 = report.checks.find((c) => c.id === "SCHEMA-02");
    assert.ok(schema02);
    assert.equal(schema02.status, "PASSED");

    const schema03 = report.checks.find((c) => c.id === "SCHEMA-03");
    assert.ok(schema03);
    assert.equal(schema03.status, "PASSED");

    const oplog01 = report.checks.find((c) => c.id === "OPLOG-01");
    assert.ok(oplog01);
    assert.equal(oplog01.status, "NOT_IMPLEMENTED");
  });
});

describe("Phase 2B: Preflight Mock Database In-Memory Fixture Tests", () => {
  // Helper to create an in-memory stubbed collection
  function createMockDb(fixtures = {}) {
    return {
      listCollections: () => ({
        toArray: async () => [
          { name: "vendors" },
          { name: "inventorybalances" },
          { name: "transactionoutcomes" },
          { name: "systemsettings" },
          { name: "orders" },
        ],
      }),
      collection: (name) => {
        const data = fixtures[name] || [];
        return {
          find: (query = {}) => ({
            limit: () => ({
              toArray: async () => {
                return data.filter((item) => {
                  if (query.$or) {
                    return query.$or.some((subQ) => {
                      if (subQ.onHand?.$lt !== undefined) return item.onHand < subQ.onHand.$lt;
                      if (subQ.reserved?.$lt !== undefined) return item.reserved < subQ.reserved.$lt;
                      return false;
                    });
                  }
                  if (query.status?.$in) {
                    return query.status.$in.includes(item.status);
                  }
                  return true;
                });
              },
            }),
          }),
          findOne: async (query) => {
            return data.find((item) => item.key === query.key) || null;
          },
          aggregate: (pipeline = []) => ({
            toArray: async () => {
              if (name === "vendors") {
                // Group by phone
                const phoneCounts = {};
                for (const v of data) {
                  if (v.phone) {
                    phoneCounts[v.phone] = (phoneCounts[v.phone] || 0) + 1;
                  }
                }
                const duplicates = [];
                for (const [phone, count] of Object.entries(phoneCounts)) {
                  if (count > 1) duplicates.push({ _id: phone, count });
                }
                return duplicates;
              }
              if (name === "inventorybalances") {
                // Group by warehouseId, productId, variantId
                const tupleCounts = {};
                for (const b of data) {
                  const key = `${b.warehouseId}:${b.productId}:${b.variantId}`;
                  tupleCounts[key] = (tupleCounts[key] || 0) + 1;
                }
                const duplicates = [];
                for (const [tuple, count] of Object.entries(tupleCounts)) {
                  if (count > 1) duplicates.push({ _id: tuple, count });
                }
                return duplicates;
              }
              return [];
            },
          }),
        };
      },
    };
  }

  test("DUP-01: Detects duplicate vendor phone numbers and marks critical failure", async () => {
    const mockDb = createMockDb({
      vendors: [
        { _id: "v1", name: "Vendor One", phone: "01711000000" },
        { _id: "v2", name: "Vendor Two", phone: "01711000000" }, // Duplicate!
        { _id: "v3", name: "Vendor Three", phone: "01811000000" },
      ],
    });

    const report = await runPreflightChecks({
      mongoUri: "mongodb://127.0.0.1:27017/test_db",
      db: mockDb,
    });

    const dup01 = report.checks.find((c) => c.id === "DUP-01");
    assert.ok(dup01);
    assert.equal(dup01.status, "FAILED");
    assert.equal(dup01.critical, true);
    assert.equal(report.isEligibleForMigration, false);
  });

  test("DUP-01: Passes when vendor phones are unique", async () => {
    const mockDb = createMockDb({
      vendors: [
        { _id: "v1", name: "Vendor One", phone: "01711000000" },
        { _id: "v2", name: "Vendor Two", phone: "01711000001" },
      ],
    });

    const report = await runPreflightChecks({
      mongoUri: "mongodb://127.0.0.1:27017/test_db",
      db: mockDb,
    });

    const dup01 = report.checks.find((c) => c.id === "DUP-01");
    assert.ok(dup01);
    assert.equal(dup01.status, "PASSED");
  });

  test("DUP-02: Detects duplicate tuples in InventoryBalance", async () => {
    const mockDb = createMockDb({
      inventorybalances: [
        { warehouseId: "w1", productId: "p1", variantId: "var1", onHand: 10, reserved: 0 },
        { warehouseId: "w1", productId: "p1", variantId: "var1", onHand: 5, reserved: 0 }, // Duplicate!
      ],
    });

    const report = await runPreflightChecks({
      mongoUri: "mongodb://127.0.0.1:27017/test_db",
      db: mockDb,
    });

    const dup02 = report.checks.find((c) => c.id === "DUP-02");
    assert.ok(dup02);
    assert.equal(dup02.status, "FAILED");
    assert.equal(dup02.critical, true);
  });

  test("DATA-01: Detects negative stock balances", async () => {
    const mockDb = createMockDb({
      inventorybalances: [
        { warehouseId: "w1", productId: "p1", variantId: "var1", onHand: -5, reserved: 0 },
      ],
    });

    const report = await runPreflightChecks({
      mongoUri: "mongodb://127.0.0.1:27017/test_db",
      db: mockDb,
    });

    const data01 = report.checks.find((c) => c.id === "DATA-01");
    assert.ok(data01);
    assert.equal(data01.status, "FAILED");
    assert.equal(data01.critical, true);
  });

  test("TX-01: Fails critical when unresolved transactions exist", async () => {
    const mockDb = createMockDb({
      transactionoutcomes: [
        { _id: "tx1", operationType: "CREATE_ORDER", status: "PENDING", idempotencyKey: "k1" },
        { _id: "tx2", operationType: "RECEIVE_STOCK", status: "RECONCILIATION_REQUIRED", idempotencyKey: "k2" },
      ],
    });

    const report = await runPreflightChecks({
      mongoUri: "mongodb://127.0.0.1:27017/test_db",
      db: mockDb,
    });

    const tx01 = report.checks.find((c) => c.id === "TX-01");
    assert.ok(tx01);
    assert.equal(tx01.status, "FAILED");
    assert.equal(tx01.critical, true);
    assert.equal(report.isEligibleForMigration, false);
  });

  test("LOCK-01: Fails critical in apply mode when lock is not held", async () => {
    const mockDb = createMockDb({
      systemsettings: [
        { key: "SYSTEM_MAINTENANCE_MIGRATION_LOCK", value: { locked: false } },
      ],
    });

    const report = await runPreflightChecks({
      mode: "apply",
      mongoUri: "mongodb://127.0.0.1:27017/test_db",
      db: mockDb,
    });

    const lock01 = report.checks.find((c) => c.id === "LOCK-01");
    assert.ok(lock01);
    assert.equal(lock01.status, "FAILED");
    assert.equal(lock01.critical, true);
  });

  test("LOCK-01: Passes in apply mode when lock is held by coordinator", async () => {
    const mockDb = createMockDb({
      systemsettings: [
        {
          key: "SYSTEM_MAINTENANCE_MIGRATION_LOCK",
          value: {
            locked: true,
            lockedAt: new Date(),
            fenceEpoch: 1,
            leaseExpiresAt: new Date(Date.now() + 60000),
          },
        },
      ],
    });

    const report = await runPreflightChecks({
      mode: "apply",
      mongoUri: "mongodb://127.0.0.1:27017/test_db",
      db: mockDb,
    });

    const lock01 = report.checks.find((c) => c.id === "LOCK-01");
    assert.ok(lock01);
    assert.equal(lock01.status, "PASSED");
    assert.equal(lock01.critical, true);
  });
});

describe("Phase 2B: Terminal Report Formatting", () => {
  test("formatTerminalReport outputs expected headers and status summary", () => {
    const sampleReport = {
      timestamp: "2026-11-21T18:00:00.000Z",
      erpName: "Dealership Management",
      mode: "inspection",
      targetUriMasked: "mongodb://admin:***@127.0.0.1:27017/test_db",
      isEligibleForMigration: true,
      summary: { total: 3, passed: 3, failed: 0, warnings: 0, notImplemented: 0, skipped: 0 },
      checks: [
        {
          id: "TEST-01",
          name: "Sample Passed Check",
          category: "ENVIRONMENT",
          status: "PASSED",
          critical: true,
          message: "Check passed cleanly",
        },
      ],
    };

    const formatted = formatTerminalReport(sampleReport);
    assert.ok(formatted.includes("Dealership Management"));
    assert.ok(formatted.includes("[ELIGIBLE FOR MIGRATION PLANNING]"));
    assert.ok(formatted.includes("TEST-01: Sample Passed Check"));
  });
});
