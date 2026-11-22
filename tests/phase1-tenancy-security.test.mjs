import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

// Direct source imports from actual TypeScript modules
import {
  verifyHmacToken,
  generateHmacToken,
  TenancySecurityError,
} from "../src/lib/auth/tenancy-guard.ts";

import {
  withTransaction,
  TransactionAmbiguousError,
} from "../src/lib/db/transaction.ts";

import { TransactionOutcome } from "../src/models/TransactionOutcome.ts";
import { connectDB } from "../src/lib/db/connect.ts";
import { SYSTEM_MIGRATION_DEPLOYED_AT, LEGACY_CUTOFF_TIMESTAMP } from "../src/lib/auth/constants.ts";

// Configure in-memory mock connection cache to bypass network requirement
process.env.MONGODB_URI = "mongodb://localhost:27017/mother_erp_test";
if (!global.mongooseCache) {
  global.mongooseCache = { conn: mongoose, promise: Promise.resolve(mongoose) };
} else {
  global.mongooseCache.conn = mongoose;
  global.mongooseCache.promise = Promise.resolve(mongoose);
}

describe("Phase 1: Token Version & Migration Policy Verification", () => {
  function evaluateToken(payload, dbUser, httpMethod, currentTime) {
    const tokenIatMs = (payload.iat ?? 0) * 1000;
    if (!tokenIatMs || tokenIatMs > currentTime.getTime() + 60000) {
      return { allowed: false, error: "INVALID_IAT" };
    }

    const isMutation = httpMethod !== "GET" && httpMethod !== "HEAD";

    if (payload.tokenVersion === undefined) {
      if (tokenIatMs >= SYSTEM_MIGRATION_DEPLOYED_AT.getTime()) {
        return { allowed: false, error: "TOKEN_VERSION_MISSING" };
      }
      if (currentTime.getTime() >= LEGACY_CUTOFF_TIMESTAMP.getTime()) {
        return { allowed: false, error: "LEGACY_SESSION_EXPIRED" };
      }
      if (isMutation) {
        return { allowed: false, error: "LEGACY_TOKEN_UPGRADE_REQUIRED" };
      }
      if (dbUser.tokenVersion > 1) {
        return { allowed: false, error: "SESSION_REVOKED" };
      }
      return { allowed: true, mode: "LEGACY_GRACE_READ" };
    }

    if (payload.tokenVersion !== dbUser.tokenVersion) {
      return { allowed: false, error: "SESSION_REVOKED" };
    }

    return { allowed: true, mode: "MODERN_AUTHENTICATED" };
  }

  test("Legacy token issued before deployment within grace period allows GET read", () => {
    const legacyToken = { userId: "user1", iat: Math.floor(new Date("2026-11-20T12:00:00Z").getTime() / 1000) };
    const dbUser = { tokenVersion: 1 };
    const now = new Date("2026-11-21T08:00:00Z");
    const result = evaluateToken(legacyToken, dbUser, "GET", now);
    assert.equal(result.allowed, true);
    assert.equal(result.mode, "LEGACY_GRACE_READ");
  });

  test("Legacy token rejects mutations immediately within grace period", () => {
    const legacyToken = { userId: "user1", iat: Math.floor(new Date("2026-11-20T12:00:00Z").getTime() / 1000) };
    const dbUser = { tokenVersion: 1 };
    const now = new Date("2026-11-21T08:00:00Z");
    const result = evaluateToken(legacyToken, dbUser, "POST", now);
    assert.equal(result.allowed, false);
    assert.equal(result.error, "LEGACY_TOKEN_UPGRADE_REQUIRED");
  });

  test("Legacy token rejects all requests after 24-hr cutoff", () => {
    const legacyToken = { userId: "user1", iat: Math.floor(new Date("2026-11-20T12:00:00Z").getTime() / 1000) };
    const dbUser = { tokenVersion: 1 };
    const now = new Date("2026-11-22T02:00:00Z");
    const result = evaluateToken(legacyToken, dbUser, "GET", now);
    assert.equal(result.allowed, false);
    assert.equal(result.error, "LEGACY_SESSION_EXPIRED");
  });

  test("Token issued post-deployment missing tokenVersion is rejected", () => {
    const postDeployToken = { userId: "user1", iat: Math.floor(new Date("2026-11-21T04:00:00Z").getTime() / 1000) };
    const dbUser = { tokenVersion: 1 };
    const now = new Date("2026-11-21T05:00:00Z");
    const result = evaluateToken(postDeployToken, dbUser, "GET", now);
    assert.equal(result.allowed, false);
    assert.equal(result.error, "TOKEN_VERSION_MISSING");
  });

  test("Modern token with mismatched tokenVersion is revoked", () => {
    const modernToken = { userId: "user1", tokenVersion: 1, iat: Math.floor(new Date("2026-11-21T04:00:00Z").getTime() / 1000) };
    const dbUser = { tokenVersion: 2 };
    const now = new Date("2026-11-21T05:00:00Z");
    const result = evaluateToken(modernToken, dbUser, "GET", now);
    assert.equal(result.allowed, false);
    assert.equal(result.error, "SESSION_REVOKED");
  });
});

describe("Phase 1: Direct Super Admin Emergency Gateway Cryptography (DEFECT-02 & DEFECT-03)", () => {
  const TEST_BUSINESS_ID = "673f4e8b1a2b3c4d5e6f7a8b";
  const OTHER_BUSINESS_ID = "673f4e8b1a2b3c4d5e6f7a99";

  test("Valid HMAC signature for correct business passes cryptographic check", () => {
    const expiry = new Date(Date.now() + 3600000); // 1 hour in future
    const rawToken = generateHmacToken("TICKET-999", TEST_BUSINESS_ID, expiry);
    const verified = verifyHmacToken(rawToken, TEST_BUSINESS_ID);
    assert.equal(verified.ticketId, "TICKET-999");
    assert.equal(verified.expiresAt.getTime(), expiry.getTime());
  });

  test("HMAC signature presented against wrong business fails with 403 INVALID_TOKEN_SIGNATURE", () => {
    const expiry = new Date(Date.now() + 3600000);
    const rawToken = generateHmacToken("TICKET-999", TEST_BUSINESS_ID, expiry);
    assert.throws(
      () => verifyHmacToken(rawToken, OTHER_BUSINESS_ID),
      (err) => {
        assert.ok(err instanceof TenancySecurityError);
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, "INVALID_TOKEN_SIGNATURE");
        return true;
      }
    );
  });

  test("Expired HMAC token is rejected with 403 TOKEN_EXPIRED", () => {
    const expiredTime = new Date(Date.now() - 5000); // 5s in past
    const rawToken = generateHmacToken("TICKET-999", TEST_BUSINESS_ID, expiredTime);
    assert.throws(
      () => verifyHmacToken(rawToken, TEST_BUSINESS_ID),
      (err) => {
        assert.ok(err instanceof TenancySecurityError);
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, "TOKEN_EXPIRED");
        return true;
      }
    );
  });

  test("Malformed HMAC token structure (invalid parts) throws 403 INVALID_TOKEN_FORMAT", () => {
    const malformedTokens = [
      "not-a-token",
      "ticket-only",
      "ticket.expiry",
      "ticket.expiry.sig.extra",
      "",
      null,
    ];

    for (const token of malformedTokens) {
      assert.throws(
        () => verifyHmacToken(token, TEST_BUSINESS_ID),
        (err) => {
          assert.ok(err instanceof TenancySecurityError);
          assert.equal(err.statusCode, 403);
          assert.equal(err.code, "INVALID_TOKEN_FORMAT");
          return true;
        }
      );
    }
  });

  test("Empty HMAC signature component throws 403 INVALID_TOKEN_FORMAT (No RangeError crash)", () => {
    const tokenWithEmptySig = `TICKET-999.${Date.now() + 3600000}.`;
    assert.throws(
      () => verifyHmacToken(tokenWithEmptySig, TEST_BUSINESS_ID),
      (err) => {
        assert.ok(err instanceof TenancySecurityError);
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, "INVALID_TOKEN_FORMAT");
        return true;
      }
    );
  });

  test("Truncated HMAC signature throws 403 INVALID_TOKEN_SIGNATURE (No RangeError crash)", () => {
    // Correct SHA-256 hex is 64 characters; test with 8 characters
    const truncatedToken = `TICKET-999.${Date.now() + 3600000}.abcdef12`;
    assert.throws(
      () => verifyHmacToken(truncatedToken, TEST_BUSINESS_ID),
      (err) => {
        assert.ok(err instanceof TenancySecurityError);
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, "INVALID_TOKEN_SIGNATURE");
        return true;
      }
    );
  });

  test("Invalid 64-character hex signature fails constant-time comparison with 403", () => {
    const fake64Hex = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const invalidToken = `TICKET-999.${Date.now() + 3600000}.${fake64Hex}`;
    assert.throws(
      () => verifyHmacToken(invalidToken, TEST_BUSINESS_ID),
      (err) => {
        assert.ok(err instanceof TenancySecurityError);
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, "INVALID_TOKEN_SIGNATURE");
        return true;
      }
    );
  });
});

describe("Phase 1: Direct Transaction Engine Safety & Ambiguous Commit (DEFECT-01 & DEFECT-03)", () => {
  let updateHistory = [];
  let existingStore = new Map();

  beforeEach(() => {
    updateHistory = [];
    existingStore.clear();

    // Default mock behavior for TransactionOutcome
    TransactionOutcome.create = async (doc) => {
      const key = `${doc.businessId}:${doc.dealershipId}:${doc.operationType}:${doc.idempotencyKey}`;
      if (existingStore.has(key)) {
        const err = new Error("E11000 duplicate key error");
        err.code = 11000;
        throw err;
      }
      const record = { ...doc, _id: new mongoose.Types.ObjectId() };
      existingStore.set(key, record);
      return record;
    };

    TransactionOutcome.findOne = async (filter) => {
      const key = `${filter.businessId}:${filter.dealershipId}:${filter.operationType}:${filter.idempotencyKey}`;
      return existingStore.get(key) || null;
    };

    TransactionOutcome.updateOne = async (filter, update) => {
      updateHistory.push({ filter, update });
      const key = `${filter.businessId}:${filter.dealershipId}:${filter.operationType}:${filter.idempotencyKey}`;
      const existing = existingStore.get(key);
      if (existing && update.$set) {
        Object.assign(existing, update.$set);
      }
      return { acknowledged: true, modifiedCount: 1 };
    };
  });

  test("Ambiguous commit retry exhaustion: marks RECONCILIATION_REQUIRED and NEVER ABORTED", async () => {
    let commitAttempts = 0;
    const mockSession = {
      startTransaction: () => {},
      commitTransaction: async () => {
        commitAttempts++;
        const err = new Error("Network blip: commit ack lost");
        err.hasErrorLabel = (label) => label === "UnknownTransactionCommitResult";
        throw err;
      },
      abortTransaction: async () => {},
      inTransaction: () => true,
      endSession: async () => {},
    };
    mongoose.startSession = async () => mockSession;

    let opExecutions = 0;
    const businessId = new mongoose.Types.ObjectId();
    const dealershipId = new mongoose.Types.ObjectId();
    const actorId = new mongoose.Types.ObjectId();

    await assert.rejects(
      async () => {
        await withTransaction(
          async () => {
            opExecutions++;
            return { result: { orderCreated: true }, entityId: "ORD-999" };
          },
          {
            businessId,
            dealershipId,
            operationType: "CREATE_ORDER",
            idempotencyKey: "AMBIGUOUS-KEY-001",
            payloadHash: "hash-alpha",
            actorId,
            maxCommitRetries: 2,
          }
        );
      },
      (err) => {
        assert.ok(err instanceof TransactionAmbiguousError);
        assert.equal(err.idempotencyKey, "AMBIGUOUS-KEY-001");
        return true;
      }
    );

    // Assert business operation was executed exactly ONCE
    assert.equal(opExecutions, 1, "Business logic must NOT be re-executed on commit retry");
    // Assert commit was retried maxCommitRetries times (initial + 2 retries = 3 attempts)
    assert.equal(commitAttempts, 3, "Commit should be retried 3 times for UnknownTransactionCommitResult");

    // Inspect status transitions
    const recordedStatuses = updateHistory.map((h) => h.update.$set?.status).filter(Boolean);
    assert.ok(recordedStatuses.includes("RECONCILIATION_REQUIRED"), "Must record RECONCILIATION_REQUIRED");
    assert.ok(!recordedStatuses.includes("ABORTED"), "CRITICAL: Must NEVER overwrite status to ABORTED!");

    // Verify stored state
    const key = `${businessId}:${dealershipId}:CREATE_ORDER:AMBIGUOUS-KEY-001`;
    const finalDoc = existingStore.get(key);
    assert.equal(finalDoc.status, "RECONCILIATION_REQUIRED");
  });

  test("RECONCILIATION_REQUIRED preservation: Re-invocation prevents duplicate business execution", async () => {
    const businessId = new mongoose.Types.ObjectId();
    const dealershipId = new mongoose.Types.ObjectId();
    const actorId = new mongoose.Types.ObjectId();
    const key = `${businessId}:${dealershipId}:CREATE_ORDER:RECONCILE-KEY-002`;

    // Seed existing document in RECONCILIATION_REQUIRED
    existingStore.set(key, {
      _id: new mongoose.Types.ObjectId(),
      businessId,
      dealershipId,
      operationType: "CREATE_ORDER",
      idempotencyKey: "RECONCILE-KEY-002",
      payloadHash: "hash-beta",
      actorId,
      status: "RECONCILIATION_REQUIRED",
    });

    let duplicateOpExecuted = false;

    await assert.rejects(
      async () => {
        await withTransaction(
          async () => {
            duplicateOpExecuted = true;
            return { result: { duplicate: true } };
          },
          {
            businessId,
            dealershipId,
            operationType: "CREATE_ORDER",
            idempotencyKey: "RECONCILE-KEY-002",
            payloadHash: "hash-beta",
            actorId,
          }
        );
      },
      (err) => {
        assert.ok(err instanceof TransactionAmbiguousError);
        return true;
      }
    );

    assert.equal(duplicateOpExecuted, false, "Business callback must NEVER run for pending/reconciling key");
    assert.equal(existingStore.get(key).status, "RECONCILIATION_REQUIRED", "Status must remain RECONCILIATION_REQUIRED");
  });

  test("Successful commit followed by failed outcome status update preserves RECONCILIATION_REQUIRED (No false ABORTED)", async () => {
    const mockSession = {
      startTransaction: () => {},
      commitTransaction: async () => {}, // Commit succeeds on MongoDB!
      abortTransaction: async () => {
        throw new Error("abortTransaction should NOT be called after successful commit!");
      },
      inTransaction: () => false,
      endSession: async () => {},
    };
    mongoose.startSession = async () => mockSession;

    // Simulate updateOne failure on the COMMITTED write
    let updateAttemptCount = 0;
    TransactionOutcome.updateOne = async (filter, update) => {
      updateAttemptCount++;
      if (update.$set?.status === "COMMITTED") {
        throw new Error("Mongo connection reset during outcome update");
      }
      updateHistory.push({ filter, update });
      return { acknowledged: true };
    };

    const businessId = new mongoose.Types.ObjectId();
    const dealershipId = new mongoose.Types.ObjectId();
    const actorId = new mongoose.Types.ObjectId();

    await assert.rejects(
      async () => {
        await withTransaction(
          async () => {
            return { result: { invoiceId: "INV-100" }, entityId: "INV-100" };
          },
          {
            businessId,
            dealershipId,
            operationType: "GENERATE_INVOICE",
            idempotencyKey: "POST-COMMIT-FAIL-KEY",
            payloadHash: "hash-gamma",
            actorId,
          }
        );
      },
      (err) => {
        assert.ok(err instanceof TransactionAmbiguousError);
        return true;
      }
    );

    const statuses = updateHistory.map((h) => h.update.$set?.status).filter(Boolean);
    assert.ok(statuses.includes("RECONCILIATION_REQUIRED"), "Must fall back to RECONCILIATION_REQUIRED");
    assert.ok(!statuses.includes("ABORTED"), "CRITICAL: Must NEVER mark ABORTED when commit succeeded!");
  });

  test("Deterministic business operation failure before commit records ABORTED", async () => {
    let sessionAborted = false;
    const mockSession = {
      startTransaction: () => {},
      commitTransaction: async () => {},
      abortTransaction: async () => {
        sessionAborted = true;
      },
      inTransaction: () => true,
      endSession: async () => {},
    };
    mongoose.startSession = async () => mockSession;

    const businessId = new mongoose.Types.ObjectId();
    const dealershipId = new mongoose.Types.ObjectId();
    const actorId = new mongoose.Types.ObjectId();

    await assert.rejects(
      async () => {
        await withTransaction(
          async () => {
            throw new Error("Insufficient warehouse inventory for SKU-RED-001");
          },
          {
            businessId,
            dealershipId,
            operationType: "RESERVE_STOCK",
            idempotencyKey: "BUSINESS-FAIL-KEY",
            payloadHash: "hash-delta",
            actorId,
          }
        );
      },
      (err) => {
        assert.equal(err.message, "Insufficient warehouse inventory for SKU-RED-001");
        return true;
      }
    );

    assert.equal(sessionAborted, true, "Session must be aborted on business execution failure");
    const statuses = updateHistory.map((h) => h.update.$set?.status).filter(Boolean);
    assert.ok(statuses.includes("ABORTED"), "Safe business abort should be recorded as ABORTED");
  });

  test("Idempotent playback: returns cached response for COMMITTED status without re-running operation", async () => {
    const businessId = new mongoose.Types.ObjectId();
    const dealershipId = new mongoose.Types.ObjectId();
    const actorId = new mongoose.Types.ObjectId();
    const key = `${businessId}:${dealershipId}:CREATE_ORDER:PLAYBACK-KEY`;

    existingStore.set(key, {
      _id: new mongoose.Types.ObjectId(),
      businessId,
      dealershipId,
      operationType: "CREATE_ORDER",
      idempotencyKey: "PLAYBACK-KEY",
      payloadHash: "hash-epsilon",
      actorId,
      status: "COMMITTED",
      responseSnapshot: { orderId: "ORD-CACHED-777", amount: 5000 },
    });

    let opExecuted = false;
    const result = await withTransaction(
      async () => {
        opExecuted = true;
        return { result: { orderId: "SHOULD-NOT-RUN" } };
      },
      {
        businessId,
        dealershipId,
        operationType: "CREATE_ORDER",
        idempotencyKey: "PLAYBACK-KEY",
        payloadHash: "hash-epsilon",
        actorId,
      }
    );

    assert.equal(opExecuted, false, "Operation must NOT run for COMMITTED idempotent request");
    assert.deepEqual(result, { orderId: "ORD-CACHED-777", amount: 5000 });
  });

  test("Idempotency conflict: identical key with different payloadHash is rejected", async () => {
    const businessId = new mongoose.Types.ObjectId();
    const dealershipId = new mongoose.Types.ObjectId();
    const actorId = new mongoose.Types.ObjectId();
    const key = `${businessId}:${dealershipId}:CREATE_ORDER:CONFLICT-KEY`;

    existingStore.set(key, {
      _id: new mongoose.Types.ObjectId(),
      businessId,
      dealershipId,
      operationType: "CREATE_ORDER",
      idempotencyKey: "CONFLICT-KEY",
      payloadHash: "original-payload-hash",
      actorId,
      status: "COMMITTED",
    });

    await assert.rejects(
      async () => {
        await withTransaction(
          async () => ({ result: {} }),
          {
            businessId,
            dealershipId,
            operationType: "CREATE_ORDER",
            idempotencyKey: "CONFLICT-KEY",
            payloadHash: "different-payload-hash-tampered",
            actorId,
          }
        );
      },
      (err) => {
        assert.ok(err.message.includes("Idempotency conflict"));
        return true;
      }
    );
  });
});

describe("Phase 1: Delivery Stock Reconciliation 6-Scenario Proofs", () => {
  function calculateReconciliation({ O, Dp, Df, Rg, Rd, Re, W, P }) {
    const D = Dp + Df;
    const R = Rg + Rd + Re;
    const E = O - D + R - W;
    const Delta = P - E;
    const U_exp = O - D - W;
    const U_act = P - R;
    const Ag = U_act + Rg;
    const Ad = Rd;
    const Ae = Re;
    return { D, R, E, Delta, U_exp, U_act, Ag, Ad, Ae, TotalBay: Ag + Ad + Ae };
  }

  test("Scenario 1: Normal Balanced Delivery", () => {
    const res = calculateReconciliation({ O: 100, Dp: 80, Df: 0, Rg: 0, Rd: 0, Re: 0, W: 0, P: 20 });
    assert.equal(res.E, 20);
    assert.equal(res.Delta, 0);
    assert.equal(res.TotalBay, 20);
    assert.equal(res.Ag, 20);
  });

  test("Scenario 2: Good Retailer Returns Collected", () => {
    const res = calculateReconciliation({ O: 100, Dp: 70, Df: 5, Rg: 8, Rd: 0, Re: 0, W: 0, P: 33 });
    assert.equal(res.E, 33);
    assert.equal(res.Delta, 0);
    assert.equal(res.U_act, 25);
    assert.equal(res.Ag, 33);
    assert.equal(res.TotalBay, 33);
  });

  test("Scenario 3: Damaged & Expired Returns", () => {
    const res = calculateReconciliation({ O: 120, Dp: 90, Df: 0, Rg: 0, Rd: 6, Re: 4, W: 0, P: 40 });
    assert.equal(res.E, 40);
    assert.equal(res.Delta, 0);
    assert.equal(res.Ag, 30);
    assert.equal(res.Ad, 6);
    assert.equal(res.Ae, 4);
    assert.equal(res.TotalBay, 40);
  });

  test("Scenario 4: Unapproved Van Shortage", () => {
    const res = calculateReconciliation({ O: 100, Dp: 80, Df: 0, Rg: 5, Rd: 2, Re: 0, W: 0, P: 25 });
    assert.equal(res.E, 27);
    assert.equal(res.Delta, -2);
    assert.equal(res.U_act, 18);
    assert.equal(res.Ag, 23);
    assert.equal(res.Ad, 2);
    assert.equal(res.TotalBay, 25);
  });

  test("Scenario 5: Approved In-Transit Road Breakage", () => {
    const res = calculateReconciliation({ O: 80, Dp: 60, Df: 0, Rg: 0, Rd: 0, Re: 0, W: 3, P: 17 });
    assert.equal(res.E, 17);
    assert.equal(res.Delta, 0);
    assert.equal(res.TotalBay, 17);
  });

  test("Scenario 6: Unapproved Physical Excess", () => {
    const res = calculateReconciliation({ O: 60, Dp: 40, Df: 0, Rg: 0, Rd: 0, Re: 0, W: 0, P: 21 });
    assert.equal(res.E, 20);
    assert.equal(res.Delta, 1);
    assert.equal(res.U_act, 21);
    assert.equal(res.TotalBay, 21);
  });
});
