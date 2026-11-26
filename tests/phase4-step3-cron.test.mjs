import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

// Endpoint & Service
import { validateCronSecret, GET } from "../src/app/api/cron/automation/route";
import { AutomationSchedulerService } from "../src/services/automation/AutomationSchedulerService";
import { AutomationEngine } from "../src/services/automation/AutomationEngine";
import { AutomationRuleService } from "../src/services/automation/AutomationRuleService";
import { AutomationSchedulerSetting } from "../src/models/AutomationSchedulerSetting";
import { AutomationRule } from "../src/models/AutomationRule";
import { AutomationEvent } from "../src/models/AutomationEvent";
import { AutomationExecution } from "../src/models/AutomationExecution";
import { Business } from "../src/models/Business";
import { InventoryBalance } from "../src/models/InventoryBalance";
import { Notification } from "../src/models/Notification";

describe("Phase 4 - Step 3: Vercel Cron Deployment & Scheduler Integration Test Suite", () => {
  const originalCronSecret = process.env.CRON_SECRET;
  const mockSecret = "staging-production-cron-secret-token-xyz-12345";

  let businesses = [];
  let automationExecutions = [];
  let automationEvents = [];
  let automationRules = [];
  let inventoryBalances = [];

  const bId1 = new mongoose.Types.ObjectId();
  const bId2 = new mongoose.Types.ObjectId();
  const prodId1 = new mongoose.Types.ObjectId();
  const warehouseId1 = new mongoose.Types.ObjectId();

  beforeEach(() => {
    global.mongooseCache = {
      conn: mongoose,
      promise: Promise.resolve(mongoose),
    };
    process.env.MONGODB_URI = "mongodb://localhost:27017/test";
    process.env.CRON_SECRET = mockSecret;

    businesses = [];
    automationExecutions = [];
    automationEvents = [];
    automationRules = [];
    inventoryBalances = [];

    const createChainable = (fn) => {
      const chain = {
        sort: () => chain,
        skip: () => chain,
        limit: (n) => createChainable(() => fn().slice(0, n)),
        lean: async () => fn(),
        then: (resolve, reject) => Promise.resolve(fn()).then(resolve, reject),
      };
      return chain;
    };

    // Default all registered models to empty find chainable
    Object.values(mongoose.models).forEach((m) => {
      m.find = () => createChainable(() => []);
    });

    Business.find = (q) => {
      let filtered = businesses.slice();
      if (q?.status) filtered = filtered.filter((b) => b.status === q.status);
      if (q?.isDeleted !== undefined) filtered = filtered.filter((b) => b.isDeleted === q.isDeleted);
      return createChainable(() => filtered);
    };

    AutomationSchedulerSetting.find = () => createChainable(() => []);
    AutomationSchedulerSetting.findOne = () => createChainable(() => null);
    AutomationSchedulerSetting.updateOne = async () => ({ acknowledged: true });
    AutomationExecution.find = () => createChainable(() => automationExecutions.slice());
    AutomationExecution.findOne = (q) => {
      let filtered = automationExecutions.slice();
      if (q?.businessId) filtered = filtered.filter((ex) => String(ex.businessId) === String(q.businessId));
      if (q?.status) filtered = filtered.filter((ex) => ex.status === q.status);
      return createChainable(() => filtered[0] || null);
    };
    AutomationExecution.create = async (doc) => {
      const saved = { _id: new mongoose.Types.ObjectId(), ...doc };
      automationExecutions.push(saved);
      return saved;
    };
    AutomationExecution.findByIdAndUpdate = async (id, update) => {
      const idx = automationExecutions.findIndex((ex) => String(ex._id) === String(id));
      if (idx !== -1) {
        automationExecutions[idx] = { ...automationExecutions[idx], ...update.$set };
        return automationExecutions[idx];
      }
      return null;
    };

    AutomationEvent.findOne = (q) => {
      let filtered = automationEvents.slice();
      if (q?.businessId) filtered = filtered.filter((e) => String(e.businessId) === String(q.businessId));
      if (q?.deduplicationKey) filtered = filtered.filter((e) => e.deduplicationKey === q.deduplicationKey);
      if (q?.status?.$in) filtered = filtered.filter((e) => q.status.$in.includes(e.status));
      return createChainable(() => filtered[0] || null);
    };
    AutomationEvent.create = async (doc) => {
      const saved = { _id: new mongoose.Types.ObjectId(), createdAt: new Date(), ...doc };
      automationEvents.push(saved);
      return saved;
    };

    AutomationRule.find = (q) => {
      let filtered = automationRules.slice();
      if (q?.businessId) filtered = filtered.filter((r) => String(r.businessId) === String(q.businessId));
      return createChainable(() => filtered);
    };
    AutomationRule.insertMany = async (items) => {
      for (const it of items) automationRules.push({ _id: new mongoose.Types.ObjectId(), ...it });
      return items;
    };

    InventoryBalance.find = (q) => {
      let filtered = inventoryBalances.slice();
      if (q?.businessId) filtered = filtered.filter((b) => String(b.businessId) === String(q.businessId));
      return createChainable(() => filtered);
    };

    Notification.create = async () => ({});
  });

  test("1. Scheduler Secret Validation: Valid, invalid, malformed, and fail-closed checks", () => {
    // A. Valid Secret
    const validRes = validateCronSecret(`Bearer ${mockSecret}`);
    assert.strictEqual(validRes.valid, true);
    assert.strictEqual(validRes.status, 200);

    // B. Invalid Secret (Different content)
    const invalidRes = validateCronSecret("Bearer wrong-token-content-123456789012345");
    assert.strictEqual(invalidRes.valid, false);
    assert.strictEqual(invalidRes.status, 401);

    // C. Malformed Header: Missing 'Bearer ' prefix
    const malformedPrefix = validateCronSecret(mockSecret);
    assert.strictEqual(malformedPrefix.valid, false);
    assert.strictEqual(malformedPrefix.status, 401);

    // D. Missing / Null Header
    const nullHeader = validateCronSecret(null);
    assert.strictEqual(nullHeader.valid, false);
    assert.strictEqual(nullHeader.status, 401);

    // E. Fail Closed: When CRON_SECRET is not set in environment
    delete process.env.CRON_SECRET;
    const failClosed = validateCronSecret(`Bearer ${mockSecret}`);
    assert.strictEqual(failClosed.valid, false);
    assert.strictEqual(failClosed.status, 500);
    assert.ok(failClosed.error?.includes("CRON_SECRET is not configured on the server"));
  });

  const createFakeRequest = (headers = {}, searchParams = {}) => {
    const headerMap = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
    return {
      headers: {
        get: (key) => headerMap.get(key.toLowerCase()) ?? null,
      },
      nextUrl: {
        searchParams: new URLSearchParams(searchParams),
      },
    };
  };

  test("2. Dedicated GET Route: Unauthorized requests are rejected with 401 / 500", async () => {
    // Fake NextRequest with invalid authorization
    const reqInvalid = createFakeRequest({ authorization: "Bearer invalid-token" });
    const res401 = await GET(reqInvalid);
    assert.strictEqual(res401.status, 401);
    const body401 = await res401.json();
    assert.strictEqual(body401.success, false);
    assert.strictEqual(body401.error, "Unauthorized scheduler request");

    // Fake NextRequest with missing authorization
    const reqMissing = createFakeRequest({});
    const resMissing = await GET(reqMissing);
    assert.strictEqual(resMissing.status, 401);

    // Fail closed if CRON_SECRET is missing
    delete process.env.CRON_SECRET;
    const reqNoEnv = createFakeRequest({ authorization: `Bearer ${mockSecret}` });
    const res500 = await GET(reqNoEnv);
    assert.strictEqual(res500.status, 500);
    const body500 = await res500.json();
    assert.strictEqual(body500.success, false);
    assert.ok(body500.error?.includes("CRON_SECRET is not configured"));
  });

  test("3. GET Route Execution: Valid secret runs batch and returns sanitized response", async () => {
    businesses.push({
      _id: bId1,
      name: "Dhaka Central Distribution",
      status: "active",
      isDeleted: false,
    });

    // Seed rules
    await AutomationRuleService.ensureDefaultRules(bId1);

    const reqValid = createFakeRequest({ authorization: `Bearer ${mockSecret}` });

    const res = await GET(reqValid);
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.status, "SUCCESS");
    assert.strictEqual(body.businessesEvaluated, 1);
    assert.ok(body.rulesEvaluated >= 20);
    assert.ok(typeof body.durationMs === "number");
    // Verify response is sanitized: no internal connection strings or stack traces
    assert.strictEqual(body.connectionString, undefined);
    assert.strictEqual(body.stack, undefined);
  });

  test("4. Execution Safety: Duplicate invocation idempotency and concurrent lock isolation", async () => {
    businesses.push(
      { _id: bId1, name: "Dealership One", status: "active", isDeleted: false },
      { _id: bId2, name: "Dealership Two", status: "active", isDeleted: false }
    );

    // Business 1 has an active stockout
    inventoryBalances.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId1,
      productId: prodId1,
      warehouseId: warehouseId1,
      availableQuantity: 0,
    });

    // Run first batch invocation
    const batch1 = await AutomationSchedulerService.runScheduledEvaluationForAllBusinesses();
    assert.strictEqual(batch1.status, "SUCCESS");
    assert.strictEqual(batch1.totalEventsGenerated, 2);
    assert.strictEqual(automationEvents.length, 2);

    // Run second batch invocation immediately: Must NOT duplicate existing active event!
    const batch2 = await AutomationSchedulerService.runScheduledEvaluationForAllBusinesses();
    assert.strictEqual(batch2.status, "SUCCESS");
    assert.strictEqual(batch2.totalEventsGenerated, 0); // Idempotent!
    assert.strictEqual(automationEvents.length, 2);

    // Concurrency Safety: If Business 1 is RUNNING, batch continues Business 2 without crashing
    automationExecutions.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId1,
      status: "RUNNING",
      startedAt: new Date(),
    });

    const batch3 = await AutomationSchedulerService.runScheduledEvaluationForAllBusinesses();
    // One business skipped due to concurrency lock, one succeeded -> PARTIAL_SUCCESS
    assert.strictEqual(batch3.status, "PARTIAL_SUCCESS");
    assert.strictEqual(batch3.skippedOrFailed.length, 1);
    assert.strictEqual(batch3.skippedOrFailed[0].businessId, String(bId1));
    assert.ok(batch3.skippedOrFailed[0].reason.includes("Concurrent evaluation rejected"));
    assert.strictEqual(batch3.totalBusinessesEvaluated, 1); // Business 2 evaluated
  });

  test("5. Bounded Serverless Execution: Inactive/deleted businesses are excluded", async () => {
    businesses.push(
      { _id: bId1, name: "Active Distributor", status: "active", isDeleted: false },
      { _id: bId2, name: "Closed Dealership", status: "inactive", isDeleted: false },
      { _id: new mongoose.Types.ObjectId(), name: "Soft Deleted", status: "active", isDeleted: true }
    );

    const batch = await AutomationSchedulerService.runScheduledEvaluationForAllBusinesses();
    // Only the 1 active non-deleted business is evaluated
    assert.strictEqual(batch.totalBusinessesEvaluated, 1);
    assert.strictEqual(batch.businessResults[0].businessId, String(bId1));
  });
});
