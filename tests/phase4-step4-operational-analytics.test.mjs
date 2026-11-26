import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import { Dispatch } from "../src/models/Dispatch.ts";
import { Vehicle } from "../src/models/Vehicle.ts";
import { GoodsReceiptNote } from "../src/models/GoodsReceiptNote.ts";
import { StockMovement } from "../src/models/StockMovement.ts";
import { StockBatch } from "../src/models/StockBatch.ts";
import { Claim } from "../src/models/Claim.ts";
import { Dealership } from "../src/models/Dealership.ts";
import { OperationalAnalyticsService } from "../src/services/analytics/OperationalAnalyticsService.ts";

describe("Phase 4 - Step 4: Operational Intelligence Test Suite", () => {
  let dispatches = [], vehicles = [], grns = [], movements = [], batches = [], claims = [];
  const bId = new mongoose.Types.ObjectId(), otherBId = new mongoose.Types.ObjectId();
  const dId1 = new mongoose.Types.ObjectId(), dId2 = new mongoose.Types.ObjectId();
  const vId1 = new mongoose.Types.ObjectId(), dmId1 = new mongoose.Types.ObjectId();

  const createChainable = (getItems) => ({
    populate: () => createChainable(getItems),
    sort: () => createChainable(getItems),
    lean: () => Promise.resolve(getItems()),
    then: (resolve, reject) => Promise.resolve(getItems()).then(resolve, reject),
  });

  beforeEach(() => {
    dispatches = []; vehicles = []; grns = []; movements = []; batches = []; claims = [];
    const dealerships = [
      { _id: dId1, name: "Dealership Alpha", code: "D-ALP", businessId: bId, status: "active" },
      { _id: dId2, name: "Dealership Beta", code: "D-BET", businessId: bId, status: "active" },
    ];
    Dealership.find = (q) => createChainable(() => dealerships.filter((d) => (!q?.businessId || String(d.businessId) === String(q.businessId)) && (!q?._id || String(d._id) === String(q._id))));
    Dispatch.find = (q) => createChainable(() => dispatches.filter((d) => (!q?.businessId || String(d.businessId) === String(q.businessId)) && (!q?.status?.$ne || d.status !== q.status.$ne) && (!q?.dealershipIds || (d.dealershipIds || []).some((id) => String(id) === String(q.dealershipIds)))));
    Vehicle.find = (q) => createChainable(() => vehicles.filter((v) => !q?.businessId || String(v.businessId) === String(q.businessId)));
    GoodsReceiptNote.find = (q) => createChainable(() => grns.filter((g) => (!q?.businessId || String(g.businessId) === String(q.businessId)) && (!q?.isCancelled?.$ne || !g.isCancelled)));
    StockMovement.find = (q) => createChainable(() => movements.filter((m) => !q?.businessId || String(m.businessId) === String(q.businessId)));
    StockBatch.find = (q) => createChainable(() => batches.filter((b) => (!q?.businessId || String(b.businessId) === String(q.businessId)) && (!q?.status || b.status === q.status)));
    Claim.find = (q) => createChainable(() => claims.filter((c) => (!q?.businessId || String(c.businessId) === String(q.businessId)) && (!q?.claimCategory || c.claimCategory === q.claimCategory)));
  });

  test("1. Delivery Performance: Stop outcomes, completion time, cargo volume, and NOT_CONFIGURED deadline", async () => {
    dispatches.push({
      businessId: bId, dealershipIds: [dId1], deliverymanId: dmId1, deliverymanName: "Karim Driver", status: "DELIVERED",
      createdAt: new Date(), startedAt: new Date(Date.now() - 3 * 3600 * 1000), completedAt: new Date(),
      orders: [
        { orderId: new mongoose.Types.ObjectId(), dealershipId: dId1, status: "delivered" },
        { orderId: new mongoose.Types.ObjectId(), dealershipId: dId1, status: "delivered" },
        { orderId: new mongoose.Types.ObjectId(), dealershipId: dId1, status: "partially_delivered" },
        { orderId: new mongoose.Types.ObjectId(), dealershipId: dId1, status: "failed" },
        { orderId: new mongoose.Types.ObjectId(), dealershipId: dId1, status: "rejected" },
      ],
      items: [{ dealershipId: dId1, loadedQuantity: 100, deliveredQuantity: 80, returnedQuantity: 10, damagedQuantity: 5, undeliveredQuantity: 5 }],
    });

    const res = await OperationalAnalyticsService.getOperationalIntelligence({ businessId: bId });
    const del = res.deliveryPerformance;
    assert.equal(del.totalOrdersAssigned, 5);
    assert.equal(del.fulfilledDeliveriesCount, 2);
    assert.equal(del.partiallyFulfilledCount, 1);
    assert.equal(del.failedDeliveriesCount, 1);
    assert.equal(del.rejectedDeliveriesCount, 1);
    assert.equal(del.deliverySuccessRatePercentage, 40);
    assert.equal(del.promisedDeadlineCompliance, "NOT_CONFIGURED");
    assert.equal(del.totalLoadedQuantity, 100);
    assert.equal(del.totalDeliveredQuantity, 80);
    assert.equal(del.totalReturnedQuantity, 10);
    assert.equal(del.totalDamagedQuantity, 5);
    assert.equal(del.totalUndeliveredQuantity, 5);
    assert.equal(del.averageDeliveryCompletionHours, 3);
  });

  test("2. Vehicle & Trip: Stops, duration, expenses, and NOT_CONFIGURED capacity utilization", async () => {
    vehicles.push({ _id: vId1, businessId: bId, registrationNumber: "DHAKA-METRO-11", vehicleType: "truck" });
    dispatches.push({
      businessId: bId, vehicleId: vId1, dealershipIds: [dId1], status: "DELIVERED",
      createdAt: new Date(), startedAt: new Date(Date.now() - 90 * 60 * 1000), completedAt: new Date(),
      orders: [{ status: "delivered" }, { status: "delivered" }],
      items: [{ loadedQuantity: 50, deliveredQuantity: 50 }],
      expenses: [{ expenseType: "fuel", amount: 1200 }, { expenseType: "toll", amount: 300 }],
    });

    const res = await OperationalAnalyticsService.getOperationalIntelligence({ businessId: bId });
    const trip = res.vehicleTripAnalytics;
    assert.equal(trip.totalTrips, 1);
    assert.equal(trip.averageStopsPerTrip, 2);
    assert.equal(trip.averageDeliveredQtyPerTrip, 50);
    assert.equal(trip.averageTripDurationMinutes, 90);
    assert.equal(trip.vehicleActivity[0].registrationNumber, "DHAKA-METRO-11");
    assert.equal(trip.vehicleActivity[0].totalTripExpenses, 1500);
    assert.equal(trip.vehicleActivity[0].capacityUtilization, "NOT_CONFIGURED");
  });

  test("3. Warehouse Operations: GRN verification latency, readiness, controls, and unconfigured put-away/picking", async () => {
    const grnCreated = new Date(Date.now() - 4 * 3600 * 1000);
    grns.push(
      { businessId: bId, status: "VERIFIED", createdAt: grnCreated, verifiedAt: new Date() },
      { businessId: bId, status: "NEEDS_REVIEW", createdAt: new Date() },
      { businessId: bId, status: "DRAFT", createdAt: new Date() }
    );
    dispatches.push(
      { businessId: bId, status: "READY_FOR_DISPATCH", createdAt: new Date() },
      { businessId: bId, status: "LOADED", createdAt: new Date(), reconciliation: { isStockBalanced: false, stockVariance: 2 } }
    );
    movements.push(
      { businessId: bId, type: "warehouse_transfer_in", quantity: 50, createdAt: new Date() },
      { businessId: bId, type: "manual_adjustment", quantity: -5, createdAt: new Date() }
    );
    batches.push({ businessId: bId, status: "quarantined", remainingQuantity: 15 });

    const res = await OperationalAnalyticsService.getOperationalIntelligence({ businessId: bId });
    const wh = res.warehouseOperations;
    assert.equal(wh.grnReceiving.totalGrnsReceived, 3);
    assert.equal(wh.grnReceiving.verifiedGrnsCount, 1);
    assert.equal(wh.grnReceiving.needsReviewCount, 1);
    assert.equal(wh.grnReceiving.pendingVerificationCount, 1);
    assert.equal(wh.grnReceiving.averageVerificationHours, 4);
    assert.equal(wh.putAwayActivity, "NOT_CONFIGURED");
    assert.equal(wh.pickingActivity, "NOT_CONFIGURED");
    assert.equal(wh.dispatchReadiness.readyForDispatchCount, 1);
    assert.equal(wh.dispatchReadiness.loadedCount, 1);
    assert.equal(wh.dispatchesWithVarianceCount, 1);
    assert.equal(wh.warehouseTransfersCount, 1);
    assert.equal(wh.totalQuantityTransferred, 50);
    assert.equal(wh.stockAdjustmentsCount, 1);
    assert.equal(wh.netAdjustmentQuantity, -5);
    assert.equal(wh.quarantinedBatchesCount, 1);
    assert.equal(wh.quarantinedQuantity, 15);
  });

  test("4. Worker Intelligence: Task classification without fabricated shift hours", async () => {
    dispatches.push({
      businessId: bId, status: "IN_TRANSIT", createdAt: new Date(),
      workers: [
        { workerName: "Rahim", activity: "loading", quantity: 120, totalAmount: 400, paymentStatus: "paid" },
        { workerName: "Rahim", activity: "unloading", quantity: 100, totalAmount: 350, paymentStatus: "pending" },
      ],
    });

    const res = await OperationalAnalyticsService.getOperationalIntelligence({ businessId: bId });
    const wrk = res.workerIntelligence;
    assert.equal(wrk.totalWorkerAssignments, 2);
    assert.equal(wrk.loadingTasksCount, 1);
    assert.equal(wrk.unloadingTasksCount, 1);
    assert.equal(wrk.completedAssignmentsCount, 1);
    assert.equal(wrk.pendingAssignmentsCount, 1);
    assert.equal(wrk.recordedWorkDuration, "NOT_CONFIGURED");
    assert.equal(wrk.workerOverview[0].workerName, "Rahim");
    assert.equal(wrk.workerOverview[0].totalQuantityHandled, 220);
    assert.equal(wrk.workerOverview[0].totalCompensationEarned, 750);
  });

  test("5. Operational Costs & RBAC Masking: Masks confidential figures when canViewCosts is false", async () => {
    dispatches.push({
      businessId: bId, dealershipIds: [dId1], status: "DELIVERED", createdAt: new Date(),
      orders: [{ status: "delivered" }], items: [{ loadedQuantity: 20, deliveredQuantity: 20 }],
      expenses: [{ expenseType: "fuel", amount: 1000, dealershipAllocations: [{ dealershipId: dId1, amount: 1000 }] }],
      workers: [{ workerName: "Rafiq", quantity: 20, totalAmount: 200 }],
    });
    claims.push({
      businessId: bId, claimCategory: "principal_reimbursement", status: "APPROVED",
      claimedAmount: 1000, approvedAmount: 800, settledAmount: 300, createdAt: new Date(),
    });

    const authRes = await OperationalAnalyticsService.getOperationalIntelligence({ businessId: bId, canViewCosts: true });
    assert.equal(authRes.operationalCosts.totalDeliveryExpenses, 1000);
    assert.equal(authRes.operationalCosts.costPerFulfilledOrder, 1000);
    assert.equal(authRes.operationalCosts.costPerDeliveredUnit, 50);
    assert.equal(authRes.operationalCosts.workerHandlingCostTotal, 200);
    assert.equal(authRes.operationalCosts.principalReceivableAmount, 500);
    assert.equal(authRes.operationalCosts.pendingPrincipalReimbursementAmount, 800);

    const maskedRes = await OperationalAnalyticsService.getOperationalIntelligence({ businessId: bId, canViewCosts: false });
    assert.equal(maskedRes.operationalCosts.totalDeliveryExpenses, null);
    assert.equal(maskedRes.operationalCosts.costPerFulfilledOrder, null);
    assert.equal(maskedRes.operationalCosts.costPerDeliveredUnit, null);
    assert.equal(maskedRes.operationalCosts.workerHandlingCostTotal, null);
    assert.equal(maskedRes.operationalCosts.principalReceivableAmount, null);
  });

  test("6. Bottlenecks & Recommendations: Generates evidence-based observations", async () => {
    dispatches.push({
      businessId: bId, status: "LOADED", createdAt: new Date(),
      reconciliation: { isStockBalanced: false, stockVariance: 3 },
      orders: [{ status: "rejected" }, { status: "delivered" }, { status: "delivered" }, { status: "failed" }, { status: "failed" }, { status: "failed" }],
      items: [{ loadedQuantity: 100, deliveredQuantity: 20, returnedQuantity: 40, undeliveredQuantity: 40 }],
    });
    grns.push({ businessId: bId, status: "NEEDS_REVIEW", createdAt: new Date() });

    const res = await OperationalAnalyticsService.getOperationalIntelligence({ businessId: bId });
    const recs = res.bottlenecksAndRecommendations;
    assert.ok(recs.length >= 3);
    assert.ok(recs.some((r) => r.domain === "delivery" && r.issue.includes("fulfillment")));
    assert.ok(recs.some((r) => r.domain === "warehouse" && r.issue.includes("reconciliation")));
    assert.ok(recs.some((r) => r.domain === "warehouse" && r.issue.includes("GRN")));
  });

  test("7. Tenant Scoping: Prevents cross-business data leakage", async () => {
    dispatches.push(
      { businessId: bId, status: "DELIVERED", createdAt: new Date(), orders: [{ status: "delivered" }] },
      { businessId: otherBId, status: "DELIVERED", createdAt: new Date(), orders: [{ status: "delivered" }, { status: "delivered" }] }
    );

    const resB1 = await OperationalAnalyticsService.getOperationalIntelligence({ businessId: bId });
    assert.equal(resB1.deliveryPerformance.totalOrdersAssigned, 1);
    const resB2 = await OperationalAnalyticsService.getOperationalIntelligence({ businessId: otherBId });
    assert.equal(resB2.deliveryPerformance.totalOrdersAssigned, 2);
  });
});
