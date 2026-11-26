import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import { GET, PUT } from "../src/app/api/v1/automation/scheduler/route";
import { AutomationSchedulerService } from "../src/services/automation/AutomationSchedulerService";
import { AutomationEngine } from "../src/services/automation/AutomationEngine";
import { AutomationSchedulerSetting } from "../src/models/AutomationSchedulerSetting";
import { AutomationRule } from "../src/models/AutomationRule";
import { AutomationEvent } from "../src/models/AutomationEvent";
import { AutomationExecution } from "../src/models/AutomationExecution";
import { Business } from "../src/models/Business";
import { InventoryBalance } from "../src/models/InventoryBalance";
import { Notification } from "../src/models/Notification";
import { signToken } from "../src/lib/auth/jwt";

describe("Phase 4 - Step 3: Scheduled Automation ON/OFF Control Test Suite", () => {
  let businesses = [], automationExecutions = [], automationEvents = [], automationRules = [], inventoryBalances = [], schedulerSettings = [];
  const bId1 = new mongoose.Types.ObjectId(), bId2 = new mongoose.Types.ObjectId(), bId3 = new mongoose.Types.ObjectId();
  const prodId1 = new mongoose.Types.ObjectId(), warehouseId1 = new mongoose.Types.ObjectId();
  const ownerUserId = new mongoose.Types.ObjectId(), staffUserId = new mongoose.Types.ObjectId();

  const ownerToken = signToken({
    userId: ownerUserId.toString(), email: "owner@company.com", name: "Business Owner", role: "owner", businessId: bId1.toString(),
  });
  const staffToken = signToken({
    userId: staffUserId.toString(), email: "salesman@company.com", name: "Sales Rep", role: "salesman", businessId: bId1.toString(),
  });

  const createFakeRequest = (headers = {}, body = null, searchParams = {}) => {
    const map = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
    return {
      headers: { get: (k) => map.get(k.toLowerCase()) ?? null },
      cookies: { get: () => null },
      nextUrl: { searchParams: new URLSearchParams(searchParams) },
      json: async () => body || {},
    };
  };

  beforeEach(() => {
    process.env.MONGODB_URI = "mongodb://localhost:27017/test";
    businesses = [{ _id: bId1, name: "Apex Distribution", status: "active", isDeleted: false }];
    automationExecutions = []; automationEvents = []; automationRules = []; inventoryBalances = []; schedulerSettings = [];

    const createChainable = (fn) => {
      const c = {
        sort: () => c, skip: () => c, limit: (n) => createChainable(() => fn().slice(0, n)),
        lean: async () => fn(), then: (res, rej) => Promise.resolve(fn()).then(res, rej),
      };
      return c;
    };

    Object.values(mongoose.models).forEach((m) => { m.find = () => createChainable(() => []); });
    Business.find = (q) => createChainable(() => businesses.filter((b) => (!q?.status || b.status === q.status) && (q?.isDeleted === undefined || b.isDeleted === q.isDeleted)));
    AutomationSchedulerSetting.find = (q) => createChainable(() => schedulerSettings.slice());
    AutomationSchedulerSetting.findOne = (q) => createChainable(() => schedulerSettings.find((s) => !q?.businessId || String(s.businessId) === String(q.businessId)) || null);
    AutomationSchedulerSetting.updateOne = async (q, upd) => {
      const idx = schedulerSettings.findIndex((s) => String(s.businessId) === String(q.businessId));
      if (idx !== -1) schedulerSettings[idx] = { ...schedulerSettings[idx], ...upd.$set };
      else schedulerSettings.push({ businessId: q.businessId, ...upd.$set });
      return { acknowledged: true };
    };
    AutomationSchedulerSetting.findOneAndUpdate = (q, update, opts) => {
      const exec = async () => {
        const idx = schedulerSettings.findIndex((s) => String(s.businessId) === String(q.businessId));
        if (idx !== -1) { schedulerSettings[idx] = { ...schedulerSettings[idx], ...update.$set }; return schedulerSettings[idx]; }
        if (opts?.upsert) {
          const created = { _id: new mongoose.Types.ObjectId(), businessId: q.businessId, ...update.$setOnInsert, ...update.$set };
          schedulerSettings.push(created);
          return created;
        }
        return null;
      };
      return { lean: exec, then: (res, rej) => exec().then(res, rej) };
    };

    AutomationExecution.find = () => createChainable(() => automationExecutions.slice());
    AutomationExecution.findOne = (q) => createChainable(() => automationExecutions.find((ex) => (!q?.businessId || String(ex.businessId) === String(q.businessId)) && (!q?.status || ex.status === q.status) && (!q?.triggeredBy || ex.triggeredBy === q.triggeredBy)) || null);
    AutomationExecution.create = async (doc) => { const s = { _id: new mongoose.Types.ObjectId(), ...doc }; automationExecutions.push(s); return s; };
    AutomationExecution.findByIdAndUpdate = async (id, upd) => {
      const idx = automationExecutions.findIndex((ex) => String(ex._id) === String(id));
      if (idx !== -1) { automationExecutions[idx] = { ...automationExecutions[idx], ...upd.$set }; return automationExecutions[idx]; }
      return null;
    };

    AutomationEvent.findOne = (q) => createChainable(() => automationEvents.find((e) => (!q?.businessId || String(e.businessId) === String(q.businessId)) && (!q?.deduplicationKey || e.deduplicationKey === q.deduplicationKey) && (!q?.status?.$in || q.status.$in.includes(e.status))) || null);
    AutomationEvent.create = async (doc) => { const s = { _id: new mongoose.Types.ObjectId(), createdAt: new Date(), ...doc }; automationEvents.push(s); return s; };
    AutomationRule.find = (q) => createChainable(() => automationRules.filter((r) => !q?.businessId || String(r.businessId) === String(q.businessId)));
    AutomationRule.insertMany = async (items) => { items.forEach((it) => automationRules.push({ _id: new mongoose.Types.ObjectId(), ...it })); return items; };
    InventoryBalance.find = (q) => createChainable(() => inventoryBalances.filter((b) => !q?.businessId || String(b.businessId) === String(q.businessId)));
    Notification.create = async () => ({});
  });

  test("1. Owner Authorization & Setting Retrieval: Default state is ON and canToggle is true for owner", async () => {
    const req = createFakeRequest({ authorization: `Bearer ${ownerToken}` });
    const res = await GET(req);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.enabled, true); // Default is ON
    assert.strictEqual(body.data.canToggle, true); // Owner authorized
    assert.ok(body.data.nextScheduledExecution);

    const staffReq = createFakeRequest({ authorization: `Bearer ${staffToken}` });
    const staffRes = await GET(staffReq);
    assert.strictEqual(staffRes.status, 200);
    const staffBody = await staffRes.json();
    assert.strictEqual(staffBody.data.canToggle, false);
  });

  test("2. Unauthorized Protection: Non-owner/admin cannot toggle scheduled automation", async () => {
    const reqForbidden = createFakeRequest({ authorization: `Bearer ${staffToken}` }, { enabled: false });
    const resForbidden = await PUT(reqForbidden);
    assert.strictEqual(resForbidden.status, 403);
    const bodyForbidden = await resForbidden.json();
    assert.strictEqual(bodyForbidden.success, false);
    assert.ok(bodyForbidden.message?.includes("Only Business Owner or Admin"));

    const reqUnauth = createFakeRequest({}, { enabled: false });
    const resUnauth = await PUT(reqUnauth);
    assert.strictEqual(resUnauth.status, 401);
  });

  test("3. Idempotent Persistence & Audit Logging: Owner can pause and resume scheduler", async () => {
    const reqPause = createFakeRequest({ authorization: `Bearer ${ownerToken}` }, { enabled: false, reason: "Inventory stocktake pause" });
    const resPause = await PUT(reqPause);
    assert.strictEqual(resPause.status, 200);
    const bodyPause = await resPause.json();
    assert.strictEqual(bodyPause.success, true);
    assert.strictEqual(bodyPause.data.enabled, false);
    assert.strictEqual(bodyPause.data.toggledByEmail, "owner@company.com");
    assert.strictEqual(bodyPause.data.reason, "Inventory stocktake pause");
    assert.ok(bodyPause.data.lastToggledAt);

    // Repeated PUT with same value is idempotent
    const resPauseRepeat = await PUT(reqPause);
    assert.strictEqual(resPauseRepeat.status, 200);
    assert.strictEqual(schedulerSettings.length, 1);

    // Owner re-enables scheduler
    const reqResume = createFakeRequest({ authorization: `Bearer ${ownerToken}` }, { enabled: true });
    const resResume = await PUT(reqResume);
    assert.strictEqual(resResume.status, 200);
    const bodyResume = await resResume.json();
    assert.strictEqual(bodyResume.data.enabled, true);
  });

  test("4. OFF Skips Scheduled Evaluation: Returns SKIPPED_DISABLED without running detectors", async () => {
    schedulerSettings.push({ _id: new mongoose.Types.ObjectId(), businessId: bId1, enabled: false });
    inventoryBalances.push({ _id: new mongoose.Types.ObjectId(), businessId: bId1, productId: prodId1, warehouseId: warehouseId1, availableQuantity: 0 });

    const singleRun = await AutomationSchedulerService.runScheduledEvaluation({ businessId: bId1 });
    assert.strictEqual(singleRun.status, "SKIPPED_DISABLED");
    assert.strictEqual(singleRun.rulesEvaluated, 0);

    const batch = await AutomationSchedulerService.runScheduledEvaluationForAllBusinesses();
    assert.strictEqual(batch.status, "SKIPPED_DISABLED");
    assert.strictEqual(batch.totalBusinessesEvaluated, 0);
    assert.ok(batch.skippedOrFailed[0].reason.includes("(SKIPPED_DISABLED)"));
  });

  test("5. ON Permits Scheduled Evaluation: Detectors evaluate and generate alerts", async () => {
    schedulerSettings.push({ _id: new mongoose.Types.ObjectId(), businessId: bId1, enabled: true });
    inventoryBalances.push({ _id: new mongoose.Types.ObjectId(), businessId: bId1, productId: prodId1, warehouseId: warehouseId1, availableQuantity: 0 });

    const run = await AutomationSchedulerService.runScheduledEvaluation({ businessId: bId1 });
    assert.strictEqual(run.status, "COMPLETED");
    assert.ok(run.rulesEvaluated >= 2);
    assert.strictEqual(run.eventsGenerated, 2); // low stock + stockout
  });

  test("6. Safety: Manual run remains independent & running execution is not cancelled by OFF", async () => {
    schedulerSettings.push(
      { _id: new mongoose.Types.ObjectId(), businessId: bId1, enabled: false },
      { _id: new mongoose.Types.ObjectId(), businessId: bId2, enabled: false }
    );
    inventoryBalances.push({ _id: new mongoose.Types.ObjectId(), businessId: bId2, productId: prodId1, warehouseId: warehouseId1, availableQuantity: 0 });

    // Existing in-progress execution on bId1
    const runningExec = { _id: new mongoose.Types.ObjectId(), businessId: bId1, status: "RUNNING", startedAt: new Date() };
    automationExecutions.push(runningExec);

    // Setting OFF does not mutate running execution
    assert.strictEqual(runningExec.status, "RUNNING");

    // Manual run on bId2 (which has scheduler OFF) remains fully operational under existing permissions
    const manualResult = await AutomationEngine.run({ businessId: bId2, triggeredBy: "MANUAL", userId: ownerUserId });
    assert.strictEqual(manualResult.status, "COMPLETED");
    assert.strictEqual(manualResult.eventsGenerated, 2);
  });

  test("7. Batch Progress Resumption: Oldest/unprocessed businesses are prioritized to prevent starvation", async () => {
    businesses = [
      { _id: bId1, name: "Biz One", status: "active", isDeleted: false },
      { _id: bId2, name: "Biz Two", status: "active", isDeleted: false },
      { _id: bId3, name: "Biz Three", status: "active", isDeleted: false },
    ];

    // Biz One was evaluated recently; Biz Two and Three were never evaluated
    schedulerSettings = [
      { businessId: bId1, enabled: true, lastScheduledRunAt: new Date(Date.now() - 1000) },
      { businessId: bId2, enabled: true, lastScheduledRunAt: null },
      { businessId: bId3, enabled: true, lastScheduledRunAt: null },
    ];

    // Run batch with maxLimit: 2 -> Biz Two and Biz Three must be processed FIRST!
    const batch = await AutomationSchedulerService.runScheduledEvaluationForAllBusinesses({ maxBusinesses: 2 });
    assert.strictEqual(batch.totalBusinessesEvaluated, 2);
    const evaluatedIds = batch.businessResults.map((r) => r.businessId);
    assert.ok(evaluatedIds.includes(String(bId2)));
    assert.ok(evaluatedIds.includes(String(bId3)));
    assert.ok(!evaluatedIds.includes(String(bId1))); // Biz One was safely deferred to next batch

    // Serverless time budget guard sets resumptionPending
    const timeoutBatch = await AutomationSchedulerService.runScheduledEvaluationForAllBusinesses({ maxDurationMs: 0 });
    assert.strictEqual(timeoutBatch.resumptionPending, true);
  });
});
