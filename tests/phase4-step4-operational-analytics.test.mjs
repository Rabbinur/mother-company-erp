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
import { DashboardDateHelper } from "../src/services/dashboard/DashboardDateHelper.ts";

describe("Phase 4 - Step 4: Operational Intelligence & Reports Verification", () => {
  let dispatches = [], vehicles = [], grns = [], movements = [], batches = [], claims = [];
  const bId = new mongoose.Types.ObjectId(), otherBId = new mongoose.Types.ObjectId();
  const dId1 = new mongoose.Types.ObjectId(), dId2 = new mongoose.Types.ObjectId();
  const vId1 = new mongoose.Types.ObjectId(), dmId1 = new mongoose.Types.ObjectId();

  const createChainable = (getItems) => ({
    sort: () => createChainable(getItems),
    populate: () => createChainable(getItems),
    lean: () => Promise.resolve(getItems()),
    then: (resolve, reject) => Promise.resolve(getItems()).then(resolve, reject),
  });

  const matchDate = (d, range) => {
    if (!range || !d) return true;
    const t = new Date(d).getTime();
    if (range.$gte && t < new Date(range.$gte).getTime()) return false;
    if (range.$lte && t > new Date(range.$lte).getTime()) return false;
    return true;
  };

  beforeEach(() => {
    dispatches = []; vehicles = []; grns = []; movements = []; batches = []; claims = [];
    const dealerships = [
      { _id: dId1, name: "Dealership Alpha", code: "D-ALP", businessId: bId, status: "active" },
      { _id: dId2, name: "Dealership Beta", code: "D-BET", businessId: bId, status: "active" },
    ];
    Dealership.find = (q) => createChainable(() => dealerships.filter((d) => (!q?.businessId || String(d.businessId) === String(q.businessId)) && (!q?._id || String(d._id) === String(q._id))));
    Dispatch.find = (q) => createChainable(() => dispatches.filter((d) => (!q?.businessId || String(d.businessId) === String(q.businessId)) && (!q?.status?.$ne || d.status !== q.status.$ne) && (!q?.dealershipIds || (d.dealershipIds || []).some((id) => String(id) === String(q.dealershipIds))) && (!q?.createdAt || matchDate(d.createdAt, q.createdAt))));
    Vehicle.find = (q) => createChainable(() => vehicles.filter((v) => !q?.businessId || String(v.businessId) === String(q.businessId)));
    GoodsReceiptNote.find = (q) => createChainable(() => grns.filter((g) => (!q?.businessId || String(g.businessId) === String(q.businessId)) && (!q?.isCancelled?.$ne || !g.isCancelled)));
    StockMovement.find = (q) => createChainable(() => movements.filter((m) => !q?.businessId || String(m.businessId) === String(q.businessId)));
    StockBatch.find = (q) => createChainable(() => batches.filter((b) => (!q?.businessId || String(b.businessId) === String(q.businessId)) && (!q?.status || b.status === q.status)));
    Claim.find = (q) => createChainable(() => claims.filter((c) => (!q?.businessId || String(c.businessId) === String(q.businessId)) && (!q?.claimCategory || c.claimCategory === q.claimCategory)));
  });

  test("1. Day-End Reconciliation: Missing/undefined values do not create false discrepancy alerts", async () => {
    dispatches.push(
      { businessId: bId, status: "LOADED", createdAt: new Date(), reconciliation: { isStockBalanced: undefined, stockVariance: undefined } },
      { businessId: bId, status: "LOADED", createdAt: new Date(), reconciliation: { isStockBalanced: true, stockVariance: 0, cashDifference: 0 } },
      { businessId: bId, status: "LOADED", createdAt: new Date(), reconciliation: { isStockBalanced: false, stockVariance: 5 } }
    );

    const res = await OperationalAnalyticsService.getOperationalIntelligence({ businessId: bId });
    const wh = res.warehouseOperations;
    assert.equal(wh.dayEndReconciliationsCount, 3);
    assert.equal(wh.completedReconciliationsCount, 2);
    assert.equal(wh.incompleteReconciliationsCount, 1);
    assert.equal(wh.dispatchesWithVarianceCount, 1);
    assert.equal(wh.reconciliationStatus, "INCOMPLETE");
  });

  test("2. Delivery Timing & Stop Semantics: Trip duration distinguished from unconfigured stop duration", async () => {
    dispatches.push({
      businessId: bId, dealershipIds: [dId1], deliverymanId: dmId1, status: "DELIVERED",
      createdAt: new Date(), startedAt: new Date(Date.now() - 2.5 * 3600 * 1000), completedAt: new Date(),
      orders: [{ status: "delivered" }], items: [{ loadedQuantity: 10, deliveredQuantity: 10 }],
    });

    const res = await OperationalAnalyticsService.getOperationalIntelligence({ businessId: bId });
    const del = res.deliveryPerformance;
    assert.equal(del.averageTripCompletionHours, 2.5);
    assert.equal(del.averageDeliveryCompletionHours, 2.5);
    assert.equal(del.stopDeliveryDuration, "NOT_CONFIGURED");
    assert.equal(del.promisedDeadlineCompliance, "NOT_CONFIGURED");
  });

  test("3. Worker Quantity Aggregation: Unique cargo tracking and NOT_CONFIGURED missing quantities", async () => {
    dispatches.push({
      businessId: bId, status: "IN_TRANSIT", createdAt: new Date(),
      items: [{ loadedQuantity: 100, deliveredQuantity: 100 }],
      workers: [
        { workerName: "Ali", activity: "loading", quantity: 60, totalAmount: 300, paymentStatus: "paid" },
        { workerName: "Hasan", activity: "loading", quantity: undefined, totalAmount: 200, paymentStatus: "paid" },
      ],
    });

    const res = await OperationalAnalyticsService.getOperationalIntelligence({ businessId: bId });
    const wrk = res.workerIntelligence;
    assert.equal(wrk.totalUniqueCargoHandled, 100);
    const ali = wrk.workerOverview.find((w) => w.workerName === "Ali");
    const hasan = wrk.workerOverview.find((w) => w.workerName === "Hasan");
    assert.equal(ali.totalQuantityHandled, 60);
    assert.equal(hasan.totalQuantityHandled, "NOT_CONFIGURED");
  });

  test("4. Delivery Success-Rate Denominator: Cancelled stops excluded from denominator without penalizing success", async () => {
    dispatches.push({
      businessId: bId, dealershipIds: [dId1], deliverymanId: dmId1, status: "DELIVERED", createdAt: new Date(),
      orders: [
        { orderId: new mongoose.Types.ObjectId(), dealershipId: dId1, status: "delivered" },
        { orderId: new mongoose.Types.ObjectId(), dealershipId: dId1, status: "delivered" },
        { orderId: new mongoose.Types.ObjectId(), dealershipId: dId1, status: "cancelled" },
        { orderId: new mongoose.Types.ObjectId(), dealershipId: dId1, status: "failed" },
      ],
    });

    const res = await OperationalAnalyticsService.getOperationalIntelligence({ businessId: bId });
    const del = res.deliveryPerformance;
    assert.equal(del.totalOrdersAssigned, 4);
    assert.equal(del.cancelledDeliveriesCount, 1);
    assert.equal(del.eligibleOrdersAssigned, 3);
    assert.equal(del.fulfilledDeliveriesCount, 2);
    assert.equal(del.deliverySuccessRatePercentage, 66.67);
  });

  test("5. Trip Expense Allocation: Route reconciliation and dealership-scoped expenses", async () => {
    dispatches.push({
      businessId: bId, dealershipIds: [dId1, dId2], status: "DELIVERED", createdAt: new Date(),
      orders: [{ dealershipId: dId1, status: "delivered" }, { dealershipId: dId2, status: "delivered" }],
      items: [{ loadedQuantity: 20, deliveredQuantity: 20 }],
      expenses: [{ expenseType: "fuel", amount: 1000, payer: "business" }],
    });

    const fleetRes = await OperationalAnalyticsService.getOperationalIntelligence({ businessId: bId });
    assert.equal(fleetRes.operationalCosts.totalDeliveryExpenses, 1000);
    const d1Res = await OperationalAnalyticsService.getOperationalIntelligence({ businessId: bId, dealershipId: dId1 });
    assert.equal(d1Res.operationalCosts.totalDeliveryExpenses, 500);
  });

  test("6. Authorization & Cost Masking: Sensitive costs masked when canViewCosts is false", async () => {
    dispatches.push({
      businessId: bId, dealershipIds: [dId1], status: "DELIVERED", createdAt: new Date(),
      expenses: [{ expenseType: "toll", amount: 200 }],
      workers: [{ workerName: "Rahim", totalAmount: 150 }],
    });

    const maskedRes = await OperationalAnalyticsService.getOperationalIntelligence({ businessId: bId, canViewCosts: false });
    assert.equal(maskedRes.operationalCosts.totalDeliveryExpenses, null);
    assert.equal(maskedRes.operationalCosts.workerHandlingCostTotal, null);
    assert.equal(maskedRes.vehicleTripAnalytics.vehicleActivity[0].totalTripExpenses, null);
  });

  test("7. Tenant Scoping: Prevents cross-business data leakage", async () => {
    dispatches.push(
      { businessId: bId, status: "DELIVERED", createdAt: new Date(), orders: [{ status: "delivered" }] },
      { businessId: otherBId, status: "DELIVERED", createdAt: new Date(), orders: [{ status: "delivered" }, { status: "delivered" }] }
    );

    const b1 = await OperationalAnalyticsService.getOperationalIntelligence({ businessId: bId });
    const b2 = await OperationalAnalyticsService.getOperationalIntelligence({ businessId: otherBId });
    assert.equal(b1.deliveryPerformance.totalOrdersAssigned, 1);
    assert.equal(b2.deliveryPerformance.totalOrdersAssigned, 2);
  });

  test("8. Print Reports & Cash Collection Confidentiality: API-level masking when canViewCosts is false", async () => {
    const dNew = new Date("2026-11-20T10:00:00Z");
    dispatches.push({
      businessId: bId, dispatchNumber: "DSP-NEW", createdAt: dNew, tripDate: dNew, status: "DELIVERED",
      vehicleNumber: "DHAKA-12", deliverymanName: "Kashem", startedAt: new Date(dNew.getTime() - 3600000), completedAt: dNew,
      orders: [{ stopSequence: 1, orderNumber: "ORD-1", customerName: "Bhai Bhai Store", shopName: "Shop A", address: "Mirpur 1", status: "delivered", cashCollected: 500 }],
      items: [{ loadedQuantity: 50, deliveredQuantity: 50 }],
      expenses: [{ amount: 400 }],
      reconciliation: { isStockBalanced: true, stockVariance: 0, cashDifference: 0 },
    });

    // Authorized run: cash collection and expenses are visible
    const authReport = await OperationalAnalyticsService.getDeliveryReport({
      businessId: bId, startDate: new Date("2026-11-01T00:00:00Z"), endDate: new Date("2026-11-30T23:59:59Z"), canViewCosts: true,
    });
    assert.equal(authReport.summary.totalTrips, 1);
    assert.equal(authReport.trips[0].stops[0].cashCollected, 500);
    assert.equal(authReport.summary.totalCashCollected, 500);
    assert.equal(authReport.trips[0].deliveryExpenses, 400);

    // Unauthorized run: cash collection and expenses are null at the API level
    const maskedReport = await OperationalAnalyticsService.getDeliveryReport({
      businessId: bId, startDate: new Date("2026-11-01T00:00:00Z"), endDate: new Date("2026-11-30T23:59:59Z"), canViewCosts: false,
    });
    assert.equal(maskedReport.summary.totalDeliveryExpenses, null);
    assert.equal(maskedReport.summary.totalCashCollected, null);
    assert.equal(maskedReport.trips[0].deliveryExpenses, null);
    assert.equal(maskedReport.trips[0].stops[0].cashCollected, null);
  });

  test("9. Custom Date Range & Bangladesh Timezone: Includes event at 23:45 BST and excludes next day", async () => {
    // 2026-11-20 23:45 BST = 2026-11-20 17:45 UTC
    const endOfDayBST = new Date("2026-11-20T17:45:00.000Z");
    // 2026-11-21 00:15 BST = 2026-11-20 18:15 UTC (next day in Bangladesh)
    const nextDayBST = new Date("2026-11-20T18:15:00.000Z");

    dispatches.push(
      { businessId: bId, dispatchNumber: "DSP-LATE", createdAt: endOfDayBST, tripDate: endOfDayBST, status: "DELIVERED", orders: [{ status: "delivered" }] },
      { businessId: bId, dispatchNumber: "DSP-NEXT", createdAt: nextDayBST, tripDate: nextDayBST, status: "DELIVERED", orders: [{ status: "delivered" }] }
    );

    const range = DashboardDateHelper.parseDateRange({ startDate: "2026-11-20", endDate: "2026-11-20" });
    assert.equal(range.startDate.toISOString(), "2026-11-19T18:00:00.000Z");
    assert.equal(range.endDate.toISOString(), "2026-11-20T17:59:59.999Z");

    const report = await OperationalAnalyticsService.getDeliveryReport({
      businessId: bId, startDate: "2026-11-20", endDate: "2026-11-20", canViewCosts: true,
    });

    assert.equal(report.summary.totalTrips, 1);
    assert.equal(report.trips[0].dispatchNumber, "DSP-LATE"); // Successfully included without off-by-one truncation
  });
});
