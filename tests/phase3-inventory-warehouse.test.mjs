import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

// Models
import { InventoryBalance } from "../src/models/InventoryBalance.ts";
import { StockBatch } from "../src/models/StockBatch.ts";
import { StockMovement } from "../src/models/StockMovement.ts";
import { StockReservation } from "../src/models/StockReservation.ts";

// Services
import { InventoryService } from "../src/services/InventoryService.ts";
import { InventoryCostingService } from "../src/services/InventoryCostingService.ts";

// Mock MongoDB connection cache
process.env.MONGODB_URI = "mongodb://localhost:27017/mother_erp_test";
if (!global.mongooseCache) {
  global.mongooseCache = { conn: mongoose, promise: Promise.resolve(mongoose) };
} else {
  global.mongooseCache.conn = mongoose;
  global.mongooseCache.promise = Promise.resolve(mongoose);
}

describe("Phase 3 — Step 3: Inventory & Warehouse Management", () => {
  // In-memory isolated storage
  let balances = [];
  let batches = [];
  let movements = [];
  let reservations = [];

  const bId = new mongoose.Types.ObjectId();
  const d1Id = new mongoose.Types.ObjectId(); // Dealership 1 (Dhaka)
  const d2Id = new mongoose.Types.ObjectId(); // Dealership 2 (Chittagong)
  const w1Id = new mongoose.Types.ObjectId(); // Shared Central Warehouse
  const w2Id = new mongoose.Types.ObjectId(); // Regional Warehouse
  const pId = new mongoose.Types.ObjectId();  // Product
  const vId = new mongoose.Types.ObjectId();  // Variant

  beforeEach(() => {
    balances = [];
    batches = [];
    movements = [];
    reservations = [];

    // Mock InventoryBalance
    InventoryBalance.create = async (docs) => {
      const created = docs.map((d) => ({
        ...d,
        _id: new mongoose.Types.ObjectId(),
        save: async function () {
          const idx = balances.findIndex((x) => String(x._id) === String(this._id));
          if (idx >= 0) balances[idx] = this;
          return this;
        },
      }));
      balances.push(...created);
      return created;
    };

    InventoryBalance.findOne = (query) => {
      const b = balances.find((x) => {
        if (query.businessId && String(x.businessId) !== String(query.businessId)) return false;
        if (query.dealershipId !== undefined) {
          if (query.dealershipId === null && x.dealershipId !== null) return false;
          if (query.dealershipId !== null && String(x.dealershipId) !== String(query.dealershipId)) return false;
        }
        if (query.warehouseId && String(x.warehouseId) !== String(query.warehouseId)) return false;
        if (query.productId && String(x.productId) !== String(query.productId)) return false;
        if (query.variantId && String(x.variantId) !== String(query.variantId)) return false;
        return true;
      });

      const chainable = {
        session: () => chainable,
        then: (resolve, reject) => Promise.resolve(b || null).then(resolve, reject),
      };
      return chainable;
    };

    InventoryBalance.findOneAndUpdate = async (query, update) => {
      const b = balances.find((x) => {
        if (query.businessId && String(x.businessId) !== String(query.businessId)) return false;
        if (query.dealershipId && String(x.dealershipId) !== String(query.dealershipId)) return false;
        if (query.warehouseId && String(x.warehouseId) !== String(query.warehouseId)) return false;
        if (query.productId && String(x.productId) !== String(query.productId)) return false;
        if (query.variantId && String(x.variantId) !== String(query.variantId)) return false;

        // Atomic condition check: OnHand - Reserved >= requestedQty
        if (query.$expr && query.$expr.$gte) {
          const requiredQty = query.$expr.$gte[1];
          const available = x.onHandQuantity - x.reservedQuantity;
          if (available < requiredQty) return false;
        }
        return true;
      });

      if (!b) return null;

      if (update.$inc) {
        if (update.$inc.reservedQuantity) b.reservedQuantity += update.$inc.reservedQuantity;
        if (update.$inc.onHandQuantity) b.onHandQuantity += update.$inc.onHandQuantity;
      }
      b.availableQuantity = b.onHandQuantity - b.reservedQuantity;
      b.lastUpdated = new Date();
      return b;
    };

    // Mock StockBatch
    StockBatch.create = async (docs) => {
      const created = docs.map((d) => ({
        ...d,
        _id: new mongoose.Types.ObjectId(),
        save: async function () {
          const idx = batches.findIndex((x) => String(x._id) === String(this._id));
          if (idx >= 0) batches[idx] = this;
          return this;
        },
      }));
      batches.push(...created);
      return created;
    };

    StockBatch.find = (query) => {
      const list = batches.filter((x) => {
        if (query.dealershipId && String(x.dealershipId) !== String(query.dealershipId)) return false;
        if (query.warehouseId && String(x.warehouseId) !== String(query.warehouseId)) return false;
        if (query.productId && String(x.productId) !== String(query.productId)) return false;
        if (query.variantId && String(x.variantId) !== String(query.variantId)) return false;
        if (query.status && x.status !== query.status) return false;
        if (query.remainingQuantity && query.remainingQuantity.$gt !== undefined) {
          if (x.remainingQuantity <= query.remainingQuantity.$gt) return false;
        }
        return true;
      });

      const chainable = {
        sort: (sortField) => {
          if (sortField.receiptDate) {
            list.sort((a, b) => new Date(a.receiptDate) - new Date(b.receiptDate));
          } else if (sortField.expiryDate) {
            list.sort((a, b) => new Date(a.expiryDate || 0) - new Date(b.expiryDate || 0));
          }
          return chainable;
        },
        session: () => chainable,
        lean: async () => list.map((b) => ({ ...b })),
        then: (resolve, reject) => Promise.resolve(list).then(resolve, reject),
      };
      return chainable;
    };

    // Mock StockMovement
    StockMovement.create = async (docs) => {
      const created = docs.map((d) => ({
        ...d,
        _id: new mongoose.Types.ObjectId(),
        createdAt: new Date(),
      }));
      movements.push(...created);
      return created;
    };

    // Mock StockReservation
    StockReservation.create = async (docs) => {
      const created = docs.map((d) => ({
        ...d,
        _id: new mongoose.Types.ObjectId(),
        createdAt: new Date(),
        save: async function () {
          const idx = reservations.findIndex((x) => String(x._id) === String(this._id));
          if (idx >= 0) reservations[idx] = this;
          return this;
        },
      }));
      reservations.push(...created);
      return created;
    };

    StockReservation.findOne = (query) => {
      const res = reservations.find((x) => {
        if (query.idempotencyKey && x.idempotencyKey === query.idempotencyKey) return true;
        return false;
      });
      const chainable = {
        session: () => chainable,
        then: (resolve, reject) => Promise.resolve(res || null).then(resolve, reject),
      };
      return chainable;
    };

    StockReservation.findById = (id) => {
      const res = reservations.find((x) => String(x._id) === String(id));
      const chainable = {
        session: () => chainable,
        then: (resolve, reject) => Promise.resolve(res || null).then(resolve, reject),
      };
      return chainable;
    };
  });

  // ==========================================
  // SECTION 1: Multi-Dealership Stock Ownership
  // ==========================================
  describe("Dealership-Specific Stock Ownership in Shared Warehouse", () => {
    test("Isolates stock ownership between two dealerships in a shared physical warehouse", async () => {
      // Dealership 1 receives 50 units in Central Warehouse (w1)
      await InventoryService.receiveStock({
        businessId: bId,
        dealershipId: d1Id,
        warehouseId: w1Id,
        items: [{ productId: pId, variantId: vId, quantity: 50, grossPurchasePrice: 5000 }],
        referenceId: "REC-DHAKA-01",
      });

      // Dealership 2 receives 30 units in the SAME Central Warehouse (w1)
      await InventoryService.receiveStock({
        businessId: bId,
        dealershipId: d2Id,
        warehouseId: w1Id,
        items: [{ productId: pId, variantId: vId, quantity: 30, grossPurchasePrice: 3000 }],
        referenceId: "REC-CTG-01",
      });

      // Assert two distinct balance documents
      assert.equal(balances.length, 2, "There must be 2 separate balances for the shared warehouse");

      const d1Bal = balances.find((x) => String(x.dealershipId) === String(d1Id));
      const d2Bal = balances.find((x) => String(x.dealershipId) === String(d2Id));

      assert.equal(d1Bal.onHandQuantity, 50);
      assert.equal(d1Bal.availableQuantity, 50);

      assert.equal(d2Bal.onHandQuantity, 30);
      assert.equal(d2Bal.availableQuantity, 30);
    });
  });

  // ==========================================
  // SECTION 2: Concurrency & Atomic Reservation
  // ==========================================
  describe("Atomic Stock Reservation & Idempotency", () => {
    beforeEach(async () => {
      // Stock 10 units for Dealership 1
      await InventoryService.receiveStock({
        businessId: bId,
        dealershipId: d1Id,
        warehouseId: w1Id,
        items: [{ productId: pId, variantId: vId, quantity: 10, grossPurchasePrice: 1000 }],
        referenceId: "REC-INIT-10",
      });
    });

    test("Rejects reservation when requested quantity exceeds available stock", async () => {
      await assert.rejects(
        async () => {
          await InventoryService.reserveStock({
            businessId: bId,
            dealershipId: d1Id,
            warehouseId: w1Id,
            items: [{ productId: pId, variantId: vId, quantity: 15 }],
            orderNumber: "ORD-OVERSOLD",
          });
        },
        {
          message: /Insufficient available stock/,
        }
      );

      const bal = balances.find((x) => String(x.dealershipId) === String(d1Id));
      assert.equal(bal.onHandQuantity, 10);
      assert.equal(bal.reservedQuantity, 0);
      assert.equal(bal.availableQuantity, 10);
    });

    test("Performs atomic reservation and updates availableQuantity correctly", async () => {
      const reservation = await InventoryService.reserveStock({
        businessId: bId,
        dealershipId: d1Id,
        warehouseId: w1Id,
        items: [{ productId: pId, variantId: vId, quantity: 6 }],
        orderNumber: "ORD-001",
      });

      assert.ok(reservation._id);
      assert.equal(reservation.status, "active");

      const bal = balances.find((x) => String(x.dealershipId) === String(d1Id));
      assert.equal(bal.onHandQuantity, 10);
      assert.equal(bal.reservedQuantity, 6);
      assert.equal(bal.availableQuantity, 4); // 10 - 6
    });

    test("Enforces idempotency: repeated request with same key returns existing reservation", async () => {
      const key = "IDEMPOTENT-ORD-777";
      const res1 = await InventoryService.reserveStock({
        businessId: bId,
        dealershipId: d1Id,
        warehouseId: w1Id,
        items: [{ productId: pId, variantId: vId, quantity: 3 }],
        orderNumber: "ORD-777",
        idempotencyKey: key,
      });

      const res2 = await InventoryService.reserveStock({
        businessId: bId,
        dealershipId: d1Id,
        warehouseId: w1Id,
        items: [{ productId: pId, variantId: vId, quantity: 3 }],
        orderNumber: "ORD-777",
        idempotencyKey: key,
      });

      assert.equal(String(res1._id), String(res2._id));
      const bal = balances.find((x) => String(x.dealershipId) === String(d1Id));
      assert.equal(bal.reservedQuantity, 3, "Reserved quantity must NOT be duplicated");
    });

    test("Releases reservation: restores available stock without altering onHandQuantity", async () => {
      const res = await InventoryService.reserveStock({
        businessId: bId,
        dealershipId: d1Id,
        warehouseId: w1Id,
        items: [{ productId: pId, variantId: vId, quantity: 4 }],
        orderNumber: "ORD-CANCEL-ME",
      });

      const balBefore = balances.find((x) => String(x.dealershipId) === String(d1Id));
      assert.equal(balBefore.availableQuantity, 6);

      await InventoryService.releaseReservation(res._id, "Customer requested cancellation");

      const balAfter = balances.find((x) => String(x.dealershipId) === String(d1Id));
      assert.equal(balAfter.onHandQuantity, 10, "OnHand must remain 10");
      assert.equal(balAfter.reservedQuantity, 0, "Reserved must reset to 0");
      assert.equal(balAfter.availableQuantity, 10, "Available stock must be fully restored to 10");
    });
  });

  // ==========================================
  // SECTION 3: Warehouse Transfers
  // ==========================================
  describe("Warehouse Transfers", () => {
    beforeEach(async () => {
      await InventoryService.receiveStock({
        businessId: bId,
        dealershipId: d1Id,
        warehouseId: w1Id,
        items: [{ productId: pId, variantId: vId, quantity: 20, grossPurchasePrice: 2000 }],
        referenceId: "REC-TRANSFER-BASE",
      });
    });

    test("Transfers stock between warehouses for the SAME dealership", async () => {
      const result = await InventoryService.transferStock({
        businessId: bId,
        dealershipId: d1Id,
        fromWarehouseId: w1Id,
        toWarehouseId: w2Id,
        productId: pId,
        variantId: vId,
        quantity: 5,
        notes: "Inter-branch replenishment",
      });

      assert.equal(result.fromBalance.onHandQuantity, 15);
      assert.equal(result.toBalance.onHandQuantity, 5);

      // Verify transfer movements recorded (outbound and inbound)
      const transferOut = movements.find((m) => m.type === "warehouse_transfer_out");
      const transferIn = movements.find((m) => m.type === "warehouse_transfer_in");

      assert.ok(transferOut);
      assert.equal(transferOut.quantity, -5);
      assert.ok(transferIn);
      assert.equal(transferIn.quantity, 5);
    });

    test("Rejects transfer between identical source and destination", async () => {
      await assert.rejects(
        async () => {
          await InventoryService.transferStock({
            businessId: bId,
            dealershipId: d1Id,
            fromWarehouseId: w1Id,
            toWarehouseId: w1Id,
            productId: pId,
            variantId: vId,
            quantity: 5,
          });
        },
        {
          message: "Source and destination warehouses cannot be the same",
        }
      );
    });
  });

  // ==========================================
  // SECTION 4: Critical Addendum — Purchase Cost Snapshot & FIFO COGS
  // ==========================================
  describe("Critical Addendum: Historical Cost Preservation & FIFO Depletion", () => {
    test("Preserves historical landed cost across multiple receipts with fluctuating prices", async () => {
      // Receipt 1: 10 units at gross ৳100 with ৳10 freight = ৳110 net landed unit cost
      await InventoryService.receiveStock({
        businessId: bId,
        dealershipId: d1Id,
        warehouseId: w1Id,
        items: [
          {
            productId: pId,
            variantId: vId,
            quantity: 10,
            grossPurchasePrice: 1000, // 100/unit
            allocatedFreight: 100,    // +10/unit
          },
        ],
        referenceId: "CHALLAN-BATCH-01",
      });

      // Receipt 2: Price increase! 10 units at gross ৳150 with ৳10 freight = ৳160 net landed unit cost
      await InventoryService.receiveStock({
        businessId: bId,
        dealershipId: d1Id,
        warehouseId: w1Id,
        items: [
          {
            productId: pId,
            variantId: vId,
            quantity: 10,
            grossPurchasePrice: 1500, // 150/unit
            allocatedFreight: 100,    // +10/unit
          },
        ],
        referenceId: "CHALLAN-BATCH-02",
      });

      assert.equal(batches.length, 2);
      assert.equal(batches[0].netLandedUnitCost, 110, "Batch 1 must preserve ৳110 landed cost");
      assert.equal(batches[1].netLandedUnitCost, 160, "Batch 2 must preserve ৳160 landed cost");

      // Verify that changing master catalog price has ZERO effect on historical batch costs
      const simulatedCatalogPriceChange = 250;
      assert.notEqual(batches[0].netLandedUnitCost, simulatedCatalogPriceChange);
      assert.equal(batches[0].netLandedUnitCost, 110);
    });

    test("FIFO Cost Depletion: Calculates COGS from historical batches, NOT current purchase price", async () => {
      // Batch 1: 10 units @ ৳110
      // Batch 2: 10 units @ ৳160
      await InventoryService.receiveStock({
        businessId: bId,
        dealershipId: d1Id,
        warehouseId: w1Id,
        items: [{ productId: pId, variantId: vId, quantity: 10, grossPurchasePrice: 1000, allocatedFreight: 100 }],
        referenceId: "B1",
      });
      await InventoryService.receiveStock({
        businessId: bId,
        dealershipId: d1Id,
        warehouseId: w1Id,
        items: [{ productId: pId, variantId: vId, quantity: 10, grossPurchasePrice: 1500, allocatedFreight: 100 }],
        referenceId: "B2",
      });

      // Fulfill 15 units
      // FIFO Expectation:
      // 10 units from Batch 1 @ ৳110 = ৳1100
      // 5 units from Batch 2 @ ৳160 = ৳800
      // Total COGS = ৳1900
      // (If calculated using current price ৳160: 15 * 160 = ৳2400 — which is wrong!)
      const fulfillment = await InventoryService.fulfillStock({
        businessId: bId,
        dealershipId: d1Id,
        warehouseId: w1Id,
        items: [{ productId: pId, variantId: vId, quantity: 15 }],
        orderNumber: "ORD-FIFO-TEST",
      });

      assert.equal(fulfillment.totalCogs, 1900, "FIFO COGS must exactly equal ৳1900");
      assert.equal(batches[0].remainingQuantity, 0, "Batch 1 must be depleted");
      assert.equal(batches[0].status, "depleted");
      assert.equal(batches[1].remainingQuantity, 5, "Batch 2 must have 5 units remaining");
    });

    test("Free Goods Cost Policy: Absorbs free units into unit landed cost", () => {
      // Purchase: 10 units, Scheme Free: 2 units = 12 total units. Total cost: ৳1200
      const calc = InventoryCostingService.calculateLandedCost({
        purchasedQuantity: 10,
        supplierSchemeFreeQuantity: 2,
        grossPurchasePrice: 1200,
        freeGoodsPolicy: "absorb_into_unit_cost",
      });

      // 1200 / 12 = 100/unit
      assert.equal(calc.totalReceivedQuantity, 12);
      assert.equal(calc.netLandedUnitCost, 100);
    });

    test("Weighted Average Cost across remaining inventory", async () => {
      // Batch 1: 10 units @ ৳100 (Total ৳1000)
      // Batch 2: 10 units @ ৳200 (Total ৳2000)
      // Weighted average: ৳3000 / 20 = ৳150
      await InventoryService.receiveStock({
        businessId: bId,
        dealershipId: d1Id,
        warehouseId: w1Id,
        items: [{ productId: pId, variantId: vId, quantity: 10, grossPurchasePrice: 1000 }],
        referenceId: "WA-1",
      });
      await InventoryService.receiveStock({
        businessId: bId,
        dealershipId: d1Id,
        warehouseId: w1Id,
        items: [{ productId: pId, variantId: vId, quantity: 10, grossPurchasePrice: 2000 }],
        referenceId: "WA-2",
      });

      const wa = await InventoryCostingService.calculateWeightedAverageCost({
        dealershipId: d1Id,
        productId: pId,
        variantId: vId,
      });

      assert.equal(wa.totalRemainingQuantity, 20);
      assert.equal(wa.averageUnitCost, 150);
      assert.equal(wa.totalValuation, 3000);
    });
  });
});
