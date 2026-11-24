import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

// Models
import { Dispatch } from "../src/models/Dispatch.ts";
import { Order } from "../src/models/Order.ts";
import { Vehicle } from "../src/models/Vehicle.ts";
import { Warehouse } from "../src/models/Warehouse.ts";
import { User } from "../src/models/User.ts";
import { Counter } from "../src/models/Counter.ts";
import { InventoryBalance } from "../src/models/InventoryBalance.ts";
import { StockMovement } from "../src/models/StockMovement.ts";
import { SalesReturn } from "../src/models/SalesReturn.ts";
import { AuditLog } from "../src/models/AuditLog.ts";

// Services
import { DispatchService } from "../src/services/DispatchService.ts";

describe("Phase 3 - Step 6: Delivery & Dispatch Management Test Suite", () => {
  let dispatches = [];
  let orders = [];
  let vehicles = [];
  let users = [];
  let balances = [];
  let movements = [];
  let salesReturns = [];
  let auditLogs = [];
  let counters = new Map();

  const bId = new mongoose.Types.ObjectId();
  const dId1 = new mongoose.Types.ObjectId();
  const dId2 = new mongoose.Types.ObjectId();
  const wId = new mongoose.Types.ObjectId();
  const actId = new mongoose.Types.ObjectId();
  const driver1Id = new mongoose.Types.ObjectId();
  const driver2Id = new mongoose.Types.ObjectId();
  const veh1Id = new mongoose.Types.ObjectId();

  const prodId = new mongoose.Types.ObjectId();
  const varId1 = new mongoose.Types.ObjectId();
  const varId2 = new mongoose.Types.ObjectId();

  beforeEach(() => {
    dispatches = [];
    orders = [];
    vehicles = [];
    users = [];
    balances = [];
    movements = [];
    salesReturns = [];
    auditLogs = [];
    counters = new Map();

    // Setup default vehicle
    vehicles.push({
      _id: veh1Id,
      registrationNumber: "DHK-MET-11-2233",
      businessId: bId,
      vehicleType: "pickup",
      capacityWeightKg: 1000,
      capacityVolumeCft: 150,
      status: "active",
    });

    // Setup default users (drivers)
    users.push({
      _id: driver1Id,
      name: "Ali Driver",
      email: "ali@dealer.com",
      phone: "+8801700112233",
      role: "delivery_staff",
      status: "active",
      businessId: bId,
    });

    users.push({
      _id: driver2Id,
      name: "Kabir Driver",
      email: "kabir@dealer.com",
      phone: "+8801700445566",
      role: "delivery_staff",
      status: "active",
      businessId: bId,
    });

    // Mock Counter
    Counter.getNextSequence = async (key) => {
      const current = counters.get(key) || 0;
      const next = current + 1;
      counters.set(key, next);
      return next;
    };

    // Mock Warehouse
    Warehouse.findById = (id) => {
      const w = { _id: id, name: "Central Shared Warehouse", code: "WH-CENTRAL", status: "active" };
      const chainable = {
        lean: async () => w,
        then: (resolve, reject) => Promise.resolve(w).then(resolve, reject),
      };
      return chainable;
    };

    // Mock Vehicle
    Vehicle.findById = (id) => {
      const v = vehicles.find((x) => String(x._id) === String(id));
      const chainable = {
        lean: async () => v || null,
        then: (resolve, reject) => Promise.resolve(v || null).then(resolve, reject),
      };
      return chainable;
    };

    // Mock User
    User.findById = (id) => {
      const u = users.find((x) => String(x._id) === String(id));
      const chainable = {
        lean: async () => u || null,
        then: (resolve, reject) => Promise.resolve(u || null).then(resolve, reject),
      };
      return chainable;
    };

    User.find = (query = {}) => {
      const chainable = {
        select: () => chainable,
        sort: () => chainable,
        lean: async () => users,
        then: (resolve, reject) => Promise.resolve(users).then(resolve, reject),
      };
      return chainable;
    };

    // Mock InventoryBalance
    InventoryBalance.findOne = (query) => {
      const bal = balances.find((b) => {
        if (query.warehouseId && String(b.warehouseId) !== String(query.warehouseId)) return false;
        if (query.productId && String(b.productId) !== String(query.productId)) return false;
        if (query.variantId && String(b.variantId) !== String(query.variantId)) return false;
        if (query.dealershipId && String(b.dealershipId) !== String(query.dealershipId)) return false;
        if (query.businessId && String(b.businessId) !== String(query.businessId)) return false;
        return true;
      });

      const chainable = {
        session: () => chainable,
        lean: async () => bal || null,
        then: (resolve, reject) => Promise.resolve(bal || null).then(resolve, reject),
      };
      return chainable;
    };

    InventoryBalance.create = async (doc) => {
      const item = {
        _id: new mongoose.Types.ObjectId(),
        onHandQuantity: 0,
        reservedQuantity: 0,
        availableQuantity: 0,
        damagedQuantity: 0,
        stockInTransit: 0,
        ...doc,
        save: async function () {
          const i = balances.findIndex((b) => String(b._id) === String(this._id));
          if (i >= 0) balances[i] = this;
          return this;
        },
      };
      balances.push(item);
      return item;
    };

    // Mock StockMovement
    StockMovement.create = async (docs) => {
      const arr = Array.isArray(docs) ? docs : [docs];
      const created = arr.map((d) => ({
        _id: new mongoose.Types.ObjectId(),
        createdAt: new Date(),
        ...d,
      }));
      movements.push(...created);
      return created;
    };

    // Mock SalesReturn
    SalesReturn.create = async (docs) => {
      const arr = Array.isArray(docs) ? docs : [docs];
      const created = arr.map((d) => ({
        _id: new mongoose.Types.ObjectId(),
        status: "pending",
        restocked: false,
        ...d,
        save: async function () {
          const i = salesReturns.findIndex((r) => String(r._id) === String(this._id));
          if (i >= 0) salesReturns[i] = this;
          return this;
        },
      }));
      salesReturns.push(...created);
      return created;
    };

    SalesReturn.findById = (id) => {
      const r = salesReturns.find((x) => String(x._id) === String(id));
      const chainable = {
        session: () => chainable,
        lean: async () => r || null,
        then: (resolve, reject) => Promise.resolve(r || null).then(resolve, reject),
      };
      return chainable;
    };

    // Mock AuditLog
    AuditLog.create = async (doc) => {
      auditLogs.push(doc);
      return doc;
    };

    // Mock Order
    Order.find = (query = {}) => {
      let filtered = [...orders];
      if (query._id && query._id.$in) {
        const idStrings = query._id.$in.map(String);
        filtered = filtered.filter((o) => idStrings.includes(String(o._id)));
      }
      const chainable = {
        populate: () => chainable,
        sort: () => chainable,
        skip: () => chainable,
        limit: () => chainable,
        lean: async () => filtered,
        then: (resolve, reject) => Promise.resolve(filtered).then(resolve, reject),
      };
      return chainable;
    };

    Order.findById = (id) => {
      const ord = orders.find((o) => String(o._id) === String(id));
      const chainable = {
        session: () => chainable,
        populate: () => chainable,
        lean: async () => ord || null,
        then: (resolve, reject) => Promise.resolve(ord || null).then(resolve, reject),
      };
      return chainable;
    };

    Order.updateMany = async (query, update) => {
      let count = 0;
      for (const ord of orders) {
        if (query._id?.$in && query._id.$in.map(String).includes(String(ord._id))) {
          if (update.$set) Object.assign(ord, update.$set);
          if (update.$unset) {
            for (const k of Object.keys(update.$unset)) delete ord[k];
          }
          count++;
        }
      }
      return { modifiedCount: count };
    };

    // Mock Dispatch
    Dispatch.create = async (doc) => {
      const created = {
        _id: new mongoose.Types.ObjectId(),
        orders: [],
        items: [],
        expenses: [],
        workers: [],
        ...doc,
        save: async function () {
          const i = dispatches.findIndex((d) => String(d._id) === String(this._id));
          if (i >= 0) dispatches[i] = this;
          return this;
        },
      };
      dispatches.push(created);
      return created;
    };

    Dispatch.findById = (id) => {
      const disp = dispatches.find((d) => String(d._id) === String(id));
      const chainable = {
        session: () => chainable,
        populate: (field) => {
          if (disp) {
            const copy = { ...disp };
            if (field === "warehouseId") copy.warehouseId = { _id: wId, name: "Central Shared Warehouse", code: "WH-CENTRAL" };
            if (field === "vehicleId" && disp.vehicleId) copy.vehicleId = vehicles.find((v) => String(v._id) === String(disp.vehicleId));
            if (field === "deliverymanId" && disp.deliverymanId) copy.deliverymanId = users.find((u) => String(u._id) === String(disp.deliverymanId));
            return {
              ...chainable,
              populate: chainable.populate,
              lean: async () => copy,
              then: (resolve, reject) => Promise.resolve(copy).then(resolve, reject),
            };
          }
          return chainable;
        },
        lean: async () => disp || null,
        then: (resolve, reject) => Promise.resolve(disp || null).then(resolve, reject),
      };
      return chainable;
    };

    Dispatch.findOne = (query) => {
      const d = dispatches.find((x) => {
        if (query._id && String(x._id) !== String(query._id)) return false;
        if (query.dispatchNumber && x.dispatchNumber !== query.dispatchNumber) return false;
        if (query.status?.$in && !query.status.$in.includes(x.status)) return false;
        return true;
      });
      const chainable = {
        lean: async () => d || null,
        then: (resolve, reject) => Promise.resolve(d || null).then(resolve, reject),
      };
      return chainable;
    };

    Dispatch.find = (query = {}) => {
      let filtered = [...dispatches];
      if (query.businessId) filtered = filtered.filter((d) => String(d.businessId) === String(query.businessId));
      if (query.deliverymanId) filtered = filtered.filter((d) => String(d.deliverymanId) === String(query.deliverymanId));
      if (query.status) filtered = filtered.filter((d) => d.status === query.status);

      const chainable = {
        populate: () => chainable,
        sort: () => chainable,
        skip: () => chainable,
        limit: () => chainable,
        lean: async () => filtered,
        then: (resolve, reject) => Promise.resolve(filtered).then(resolve, reject),
      };
      return chainable;
    };

    Dispatch.countDocuments = async () => dispatches.length;
  });

  // Helpers to create test orders and inventory
  async function createTestOrder(dealershipId, orderStatus = "CONFIRMED", items = [{ variantId: varId1, qty: 10 }]) {
    const oId = new mongoose.Types.ObjectId();
    const ord = {
      _id: oId,
      orderNumber: `SO-202611-${orders.length + 1001}`,
      businessId: bId,
      dealershipId,
      warehouseId: wId,
      customerId: {
        _id: new mongoose.Types.ObjectId(),
        name: "Test Retailer",
        shopName: "Retailer Shop",
        address: "Shop #10, City Bazaar",
        phone: "+8801700000000",
      },
      orderStatus,
      fulfillmentStatus: "unfulfilled",
      grandTotal: items.reduce((s, it) => s + it.qty * 150, 0),
      items: items.map((it) => ({
        productId: prodId,
        variantId: it.variantId,
        name: "Test Item",
        sku: "TEST-SKU",
        quantity: it.qty,
        customerPriceSnapshot: 150,
        unitPrice: 150,
      })),
      save: async function () {
        const i = orders.findIndex((o) => String(o._id) === String(this._id));
        if (i >= 0) orders[i] = this;
        return this;
      },
    };
    orders.push(ord);
    return ord;
  }

  async function initInventory(dealershipId, variantId, onHand, reserved = 0) {
    const bal = {
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      dealershipId,
      warehouseId: wId,
      productId: prodId,
      variantId,
      onHandQuantity: onHand,
      reservedQuantity: reserved,
      availableQuantity: onHand - reserved,
      damagedQuantity: 0,
      stockInTransit: 0,
      lastUpdated: new Date(),
      save: async function () {
        const i = balances.findIndex((b) => String(b._id) === String(this._id));
        if (i >= 0) balances[i] = this;
        return this;
      },
    };
    balances.push(bal);
    return bal;
  }

  // ==========================================
  // SCENARIO 1: ELIGIBLE CONFIRMED ORDERS ONLY
  // ==========================================
  test("1. Only eligible confirmed orders can be dispatched", async () => {
    const draftOrder = await createTestOrder(dId1, "DRAFT");
    const cancelledOrder = await createTestOrder(dId1, "CANCELLED");
    const confirmedOrder = await createTestOrder(dId1, "CONFIRMED");

    // Attempting to dispatch DRAFT order must fail
    await assert.rejects(
      async () => {
        await DispatchService.createDispatch({
          businessId: bId,
          warehouseId: wId,
          orderIds: [draftOrder._id],
        });
      },
      (err) => {
        assert.match(err.message, /Only CONFIRMED orders can be dispatched/);
        return true;
      }
    );

    // Attempting to dispatch CANCELLED order must fail
    await assert.rejects(
      async () => {
        await DispatchService.createDispatch({
          businessId: bId,
          warehouseId: wId,
          orderIds: [cancelledOrder._id],
        });
      },
      (err) => {
        assert.match(err.message, /Only CONFIRMED orders can be dispatched/);
        return true;
      }
    );

    // CONFIRMED order succeeds
    const dispatch = await DispatchService.createDispatch({
      businessId: bId,
      warehouseId: wId,
      orderIds: [confirmedOrder._id],
      vehicleId: veh1Id,
      deliverymanId: driver1Id,
      actorId: actId,
    });

    assert.ok(dispatch.dispatchNumber.startsWith("DSP-"));
    assert.equal(dispatch.status, "READY_FOR_DISPATCH");
    assert.equal(dispatch.orders.length, 1);
    assert.equal(String(dispatch.orders[0].orderId), String(confirmedOrder._id));
  });

  // ==========================================
  // SCENARIO 2: MULTI-DEALERSHIP TRIP ISOLATION
  // ==========================================
  test("2. Dealership stock ownership is preserved in multi-dealership trip", async () => {
    await initInventory(dId1, varId1, 100, 20);
    await initInventory(dId2, varId1, 200, 30);

    const order1 = await createTestOrder(dId1, "CONFIRMED", [{ variantId: varId1, qty: 20 }]);
    const order2 = await createTestOrder(dId2, "CONFIRMED", [{ variantId: varId1, qty: 30 }]);

    const dispatch = await DispatchService.createDispatch({
      businessId: bId,
      warehouseId: wId,
      orderIds: [order1._id, order2._id],
      vehicleId: veh1Id,
      deliverymanId: driver1Id,
    });

    assert.equal(dispatch.dealershipIds.length, 2);
    assert.equal(dispatch.items.length, 2);
    assert.equal(String(dispatch.items[0].dealershipId), String(dId1));
    assert.equal(String(dispatch.items[1].dealershipId), String(dId2));
  });

  // ==========================================
  // SCENARIO 3: LOADING DOES NOT DOUBLE-CONSUME
  // ==========================================
  test("3. Loading does not double-consume reservations (moves to stockInTransit)", async () => {
    await initInventory(dId1, varId1, 100, 25);
    const order = await createTestOrder(dId1, "CONFIRMED", [{ variantId: varId1, qty: 25 }]);

    const dispatch = await DispatchService.createDispatch({
      businessId: bId,
      warehouseId: wId,
      orderIds: [order._id],
      vehicleId: veh1Id,
      deliverymanId: driver1Id,
    });

    const loadedDispatch = await DispatchService.loadDispatch({
      dispatchId: dispatch._id,
      actorId: actId,
    });

    assert.equal(loadedDispatch.status, "LOADED");
    assert.equal(loadedDispatch.items[0].loadedQuantity, 25);

    // Invariance Check: OnHand is 100, Reserved is 25, StockInTransit is 25, Available remains 75!
    const bal = balances.find((b) => String(b.dealershipId) === String(dId1));
    assert.equal(bal.onHandQuantity, 100);
    assert.equal(bal.reservedQuantity, 25);
    assert.equal(bal.stockInTransit, 25);
    assert.equal(bal.availableQuantity, 75);

    // Stock Movement logged
    const move = movements.find((m) => m.type === "dispatch_load");
    assert.ok(move);
    assert.equal(move.quantity, 25);
  });

  // ==========================================
  // SCENARIO 4 & 5: PARTIAL & FULL DELIVERY FULFILLMENT
  // ==========================================
  test("4. Actual delivery consumes stock exactly once and updates fulfillment status", async () => {
    await initInventory(dId1, varId1, 100, 20);
    const order = await createTestOrder(dId1, "CONFIRMED", [{ variantId: varId1, qty: 20 }]);

    const dispatch = await DispatchService.createDispatch({
      businessId: bId,
      warehouseId: wId,
      orderIds: [order._id],
    });

    await DispatchService.loadDispatch({ dispatchId: dispatch._id });
    await DispatchService.startDispatch(dispatch._id);

    // Record complete delivery of 20 units
    const delivered = await DispatchService.recordDeliveries({
      dispatchId: dispatch._id,
      stops: [
        {
          orderId: order._id,
          status: "delivered",
          cashCollected: 3000,
        },
      ],
      actorId: actId,
    });

    assert.equal(delivered.status, "DELIVERED");
    assert.equal(delivered.orders[0].status, "delivered");
    assert.equal(delivered.orders[0].cashCollected, 3000);

    // Stock consumed: OnHand 80, Reserved 0, StockInTransit 0, Available 80
    const bal = balances.find((b) => String(b.dealershipId) === String(dId1));
    assert.equal(bal.onHandQuantity, 80);
    assert.equal(bal.reservedQuantity, 0);
    assert.equal(bal.stockInTransit, 0);
    assert.equal(bal.availableQuantity, 80);

    // Sales Order fulfillment status updated from actual delivery
    assert.equal(order.fulfillmentStatus, "fulfilled");
    assert.equal(order.orderStatus, "FULFILLED");

    // Stock Movement logged
    const fulMove = movements.find((m) => m.type === "sales_fulfillment");
    assert.ok(fulMove);
    assert.equal(fulMove.quantity, -20);
  });

  test("5. Partial delivery updates status to PARTIALLY_FULFILLED", async () => {
    await initInventory(dId1, varId1, 100, 20);
    const order = await createTestOrder(dId1, "CONFIRMED", [{ variantId: varId1, qty: 20 }]);

    const dispatch = await DispatchService.createDispatch({
      businessId: bId,
      warehouseId: wId,
      orderIds: [order._id],
    });

    await DispatchService.loadDispatch({ dispatchId: dispatch._id });

    // Partial delivery: 15 delivered, 5 undelivered/short
    const partiallyDelivered = await DispatchService.recordDeliveries({
      dispatchId: dispatch._id,
      stops: [
        {
          orderId: order._id,
          status: "partially_delivered",
          deliveredItems: [
            {
              variantId: varId1,
              deliveredQuantity: 15,
              returnedQuantity: 0,
              damagedQuantity: 0,
            },
          ],
          cashCollected: 2250,
        },
      ],
    });

    assert.equal(partiallyDelivered.status, "PARTIALLY_DELIVERED");
    assert.equal(order.fulfillmentStatus, "partially_fulfilled");
    assert.equal(order.orderStatus, "PARTIALLY_FULFILLED");

    // 15 units consumed
    const bal = balances.find((b) => String(b.dealershipId) === String(dId1));
    assert.equal(bal.onHandQuantity, 85);
    assert.equal(bal.reservedQuantity, 5); // 5 remaining reserved
    assert.equal(bal.stockInTransit, 5); // 5 remaining in transit on truck
  });

  // ==========================================
  // SCENARIO 6: UNDELIVERED STOCK RECONCILIATION
  // ==========================================
  test("6. Undelivered stock is reconciled correctly on trip close", async () => {
    await initInventory(dId1, varId1, 100, 20);
    const order = await createTestOrder(dId1, "CONFIRMED", [{ variantId: varId1, qty: 20 }]);

    const dispatch = await DispatchService.createDispatch({
      businessId: bId,
      warehouseId: wId,
      orderIds: [order._id],
    });

    await DispatchService.loadDispatch({ dispatchId: dispatch._id });

    // 14 delivered, 6 undelivered
    await DispatchService.recordDeliveries({
      dispatchId: dispatch._id,
      stops: [
        {
          orderId: order._id,
          status: "partially_delivered",
          deliveredItems: [
            {
              variantId: varId1,
              deliveredQuantity: 14,
              returnedQuantity: 0,
            },
          ],
          cashCollected: 2100,
        },
      ],
    });

    const reconciled = await DispatchService.closeAndReconcileDispatch({
      dispatchId: dispatch._id,
      cashDeposited: 2100,
      notes: "Trip closed with 6 units undelivered",
      actorId: actId,
    });

    assert.equal(reconciled.reconciliation.totalLoadedQuantity, 20);
    assert.equal(reconciled.reconciliation.totalDeliveredQuantity, 14);
    assert.equal(reconciled.reconciliation.totalUndeliveredQuantity, 6);
    assert.equal(reconciled.reconciliation.isStockBalanced, true);
    assert.equal(reconciled.reconciliation.cashDifference, 0);

    // In-transit stock cleared back to 0
    const bal = balances.find((b) => String(b.dealershipId) === String(dId1));
    assert.equal(bal.stockInTransit, 0);

    // Stock Movement logged for undelivered return to warehouse
    const retMove = movements.find((m) => m.type === "undelivered_return");
    assert.ok(retMove);
    assert.equal(retMove.quantity, 6);
  });

  // ==========================================
  // SCENARIO 7 & 8: RETAILER RETURNS & INSPECTION
  // ==========================================
  test("7. Retailer returns do not automatically become sellable stock before inspection", async () => {
    await initInventory(dId1, varId1, 100, 10);
    const order = await createTestOrder(dId1, "CONFIRMED", [{ variantId: varId1, qty: 10 }]);

    const dispatch = await DispatchService.createDispatch({
      businessId: bId,
      warehouseId: wId,
      orderIds: [order._id],
    });

    await DispatchService.loadDispatch({ dispatchId: dispatch._id });

    // Deliver 8, retailer returns 2 at doorstep
    await DispatchService.recordDeliveries({
      dispatchId: dispatch._id,
      stops: [
        {
          orderId: order._id,
          status: "partially_delivered",
          deliveredItems: [
            {
              variantId: varId1,
              deliveredQuantity: 8,
              returnedQuantity: 2,
              returnReason: "Customer ordered wrong pack size",
              condition: "good",
            },
          ],
          cashCollected: 1200,
        },
      ],
    });

    assert.equal(salesReturns.length, 1);
    const sReturn = salesReturns[0];
    assert.equal(sReturn.status, "pending");
    assert.equal(sReturn.items[0].returnedQuantity, 2);
    assert.equal(sReturn.restocked, false);

    // Available quantity has NOT increased by the 2 returned units!
    const bal = balances.find((b) => String(b.dealershipId) === String(dId1));
    assert.equal(bal.onHandQuantity, 92); // 100 - 8 delivered
    assert.equal(bal.availableQuantity, 90); // 92 - 2 (unfulfilled reservation)
  });

  test("8. Approved return inspection restocks goods or marks damaged", async () => {
    await initInventory(dId1, varId1, 100, 10);
    const order = await createTestOrder(dId1, "CONFIRMED", [{ variantId: varId1, qty: 10 }]);

    const dispatch = await DispatchService.createDispatch({
      businessId: bId,
      warehouseId: wId,
      orderIds: [order._id],
    });

    await DispatchService.loadDispatch({ dispatchId: dispatch._id });

    await DispatchService.recordDeliveries({
      dispatchId: dispatch._id,
      stops: [
        {
          orderId: order._id,
          status: "partially_delivered",
          deliveredItems: [
            {
              variantId: varId1,
              deliveredQuantity: 7,
              returnedQuantity: 3,
              condition: "good",
            },
          ],
        },
      ],
    });

    const sReturn = salesReturns[0];

    // Warehouse manager inspects and approves return
    await DispatchService.approveSalesReturnInspection({
      returnId: sReturn._id,
      decision: "approve",
      condition: "good",
      notes: "Items in original undamaged packaging",
      actorId: actId,
    });

    assert.equal(sReturn.status, "approved");
    assert.equal(sReturn.restocked, true);

    // Balance restocked
    const bal = balances.find((b) => String(b.dealershipId) === String(dId1));
    assert.equal(bal.onHandQuantity, 96); // 93 + 3 restocked
  });

  // ==========================================
  // SCENARIO 9: CANCELLATION REVERSES IN-TRANSIT
  // ==========================================
  test("9. Cancellation of loaded dispatch safely reverses in-transit custody", async () => {
    await initInventory(dId1, varId1, 100, 20);
    const order = await createTestOrder(dId1, "CONFIRMED", [{ variantId: varId1, qty: 20 }]);

    const dispatch = await DispatchService.createDispatch({
      businessId: bId,
      warehouseId: wId,
      orderIds: [order._id],
    });

    await DispatchService.loadDispatch({ dispatchId: dispatch._id });
    const balLoaded = balances.find((b) => String(b.dealershipId) === String(dId1));
    assert.equal(balLoaded.stockInTransit, 20);

    // Cancel trip
    const cancelled = await DispatchService.cancelDispatch(dispatch._id, "Vehicle breakdown", actId);
    assert.equal(cancelled.status, "CANCELLED");

    // In-transit restored to 0
    const balCancelled = balances.find((b) => String(b.dealershipId) === String(dId1));
    assert.equal(balCancelled.stockInTransit, 0);

    // Order unlinked from dispatch
    assert.equal(order.dispatchId, undefined);

    // Stock Movement logged
    const unldMove = movements.find((m) => m.type === "dispatch_unload");
    assert.ok(unldMove);
    assert.equal(unldMove.quantity, -20);
  });

  // ==========================================
  // SCENARIO 10: CROSS-DEALERSHIP ACCESS GUARD
  // ==========================================
  test("10. Cross-dealership dispatch access is rejected", async () => {
    const order = await createTestOrder(dId1, "CONFIRMED");
    const dispatch = await DispatchService.createDispatch({
      businessId: bId,
      warehouseId: wId,
      orderIds: [order._id],
    });

    // Staff from Dealership 2 attempts to fetch Dealership 1's dispatch
    await assert.rejects(
      async () => {
        await DispatchService.getDispatchDetails(dispatch._id, {
          dealershipId: dId2,
          role: "sales_staff",
        });
      },
      (err) => {
        assert.match(err.message, /Cross-dealership dispatch access denied/);
        return true;
      }
    );
  });

  // ==========================================
  // SCENARIO 11: DRIVER ASSIGNMENT SECURITY
  // ==========================================
  test("11. Deliveryman can access only assigned trips", async () => {
    const order = await createTestOrder(dId1, "CONFIRMED");
    const dispatch = await DispatchService.createDispatch({
      businessId: bId,
      warehouseId: wId,
      orderIds: [order._id],
      deliverymanId: driver1Id,
    });

    // Driver 2 attempts to open Driver 1's trip
    await assert.rejects(
      async () => {
        await DispatchService.getDispatchDetails(dispatch._id, {
          role: "delivery_staff",
          userId: String(driver2Id),
        });
      },
      (err) => {
        assert.match(err.message, /Access denied: You are not assigned to this dispatch trip/);
        return true;
      }
    );

    // Driver 1 successfully accesses own trip
    const driverView = await DispatchService.getDispatchDetails(dispatch._id, {
      role: "delivery_staff",
      userId: String(driver1Id),
    });
    assert.ok(driverView);
  });

  // ==========================================
  // SCENARIO 12: TRIP EXPENSES & ALLOCATION
  // ==========================================
  test("12. Multiple dealerships in one trip allocate stock and expenses correctly", async () => {
    const order1 = await createTestOrder(dId1, "CONFIRMED", [{ variantId: varId1, qty: 60 }]);
    const order2 = await createTestOrder(dId2, "CONFIRMED", [{ variantId: varId1, qty: 40 }]);

    const dispatch = await DispatchService.createDispatch({
      businessId: bId,
      warehouseId: wId,
      orderIds: [order1._id, order2._id],
    });

    // Add fuel expense of 1,000 BDT allocated by delivered_qty (60% to D1, 40% to D2)
    const updated = await DispatchService.addTripExpense({
      dispatchId: dispatch._id,
      expenseType: "fuel",
      amount: 1000,
      payer: "business",
      allocationMethod: "delivered_qty",
    });

    assert.equal(updated.expenses.length, 1);
    const exp = updated.expenses[0];
    assert.equal(exp.amount, 1000);
    assert.equal(exp.dealershipAllocations.length, 2);

    const alloc1 = exp.dealershipAllocations.find((a) => String(a.dealershipId) === String(dId1));
    const alloc2 = exp.dealershipAllocations.find((a) => String(a.dealershipId) === String(dId2));

    assert.equal(alloc1.amount, 600);
    assert.equal(alloc2.amount, 400);
  });

  // ==========================================
  // SCENARIO 13: DAILY STOCK RECONCILIATION
  // ==========================================
  test("13. Daily stock reconciliation balances perfectly", async () => {
    await initInventory(dId1, varId1, 100, 30);
    const order = await createTestOrder(dId1, "CONFIRMED", [{ variantId: varId1, qty: 30 }]);

    const dispatch = await DispatchService.createDispatch({
      businessId: bId,
      warehouseId: wId,
      orderIds: [order._id],
      deliverymanId: driver1Id,
    });

    await DispatchService.loadDispatch({ dispatchId: dispatch._id });

    // Deliver 22, return 3, damage 2, undelivered 3 (22 + 3 + 2 + 3 = 30)
    await DispatchService.recordDeliveries({
      dispatchId: dispatch._id,
      stops: [
        {
          orderId: order._id,
          status: "partially_delivered",
          deliveredItems: [
            {
              variantId: varId1,
              deliveredQuantity: 22,
              returnedQuantity: 3,
              damagedQuantity: 2,
            },
          ],
          cashCollected: 3300,
        },
      ],
    });

    await DispatchService.closeAndReconcileDispatch({
      dispatchId: dispatch._id,
      cashDeposited: 3300,
    });

    const sheet = await DispatchService.getDeliverymanDailyStockSheet({
      deliverymanId: driver1Id,
      businessId: bId,
    });

    assert.equal(sheet.openingLoadedQuantity, 30);
    assert.equal(sheet.deliveredQuantity, 22);
    assert.equal(sheet.retailerReturnsQuantity, 3);
    assert.equal(sheet.damagedQuantity, 2);
    assert.equal(sheet.undeliveredQuantity, 3);
    assert.equal(sheet.stockVariance, 0);
    assert.equal(sheet.isStockBalanced, true);
    assert.equal(sheet.totalCashCollected, 3300);
    assert.equal(sheet.totalCashDeposited, 3300);
    assert.equal(sheet.cashDifference, 0);
  });

  // ==========================================
  // SCENARIO 14: PRINCIPAL REIMBURSEMENT
  // ==========================================
  test("14. Principal-paid expenses and reimbursement tracking", async () => {
    const order = await createTestOrder(dId1, "CONFIRMED");
    const dispatch = await DispatchService.createDispatch({
      businessId: bId,
      warehouseId: wId,
      orderIds: [order._id],
    });

    // Principal paid expense: Business claims reimbursement
    const updated = await DispatchService.addTripExpense({
      dispatchId: dispatch._id,
      expenseType: "transport",
      amount: 1500,
      payer: "principal",
      notes: "Principal highway toll reimbursement claim",
    });

    const exp = updated.expenses[0];
    assert.equal(exp.payer, "principal");
    assert.equal(exp.reimbursementStatus, "pending_claim");
    assert.equal(exp.claimAmount, 1500);
  });

  // ==========================================
  // SCENARIO 15: IDEMPOTENT DELIVERY SUBMISSION
  // ==========================================
  test("15. Duplicate delivery submission is idempotent (no double decrement)", async () => {
    await initInventory(dId1, varId1, 100, 15);
    const order = await createTestOrder(dId1, "CONFIRMED", [{ variantId: varId1, qty: 15 }]);

    const dispatch = await DispatchService.createDispatch({
      businessId: bId,
      warehouseId: wId,
      orderIds: [order._id],
    });

    await DispatchService.loadDispatch({ dispatchId: dispatch._id });

    // First submission: deliver 15
    await DispatchService.recordDeliveries({
      dispatchId: dispatch._id,
      stops: [
        {
          orderId: order._id,
          status: "delivered",
          cashCollected: 2250,
        },
      ],
    });

    const balAfterFirst = balances.find((b) => String(b.dealershipId) === String(dId1));
    assert.equal(balAfterFirst.onHandQuantity, 85);
    assert.equal(balAfterFirst.reservedQuantity, 0);

    // Replay / idempotent second call
    const res = await DispatchService.recordDeliveries({
      dispatchId: dispatch._id,
      stops: [
        {
          orderId: order._id,
          status: "delivered",
          cashCollected: 2250,
        },
      ],
    });

    assert.equal(res.status, "DELIVERED");
    const balAfterSecond = balances.find((b) => String(b.dealershipId) === String(dId1));
    assert.equal(balAfterSecond.onHandQuantity, 85, "OnHand stock must not double decrement");
  });

  // ==========================================
  // SCENARIO 16: PREVENTS NEGATIVE INVENTORY
  // ==========================================
  test("16. Delivery updates cannot create negative stock", async () => {
    await initInventory(dId1, varId1, 5, 5); // Only 5 available
    const order = await createTestOrder(dId1, "CONFIRMED", [{ variantId: varId1, qty: 5 }]);

    const dispatch = await DispatchService.createDispatch({
      businessId: bId,
      warehouseId: wId,
      orderIds: [order._id],
    });

    await DispatchService.loadDispatch({ dispatchId: dispatch._id });

    // Attempt delivering 10 (exceeds onHand of 5)
    await DispatchService.recordDeliveries({
      dispatchId: dispatch._id,
      stops: [
        {
          orderId: order._id,
          status: "delivered",
          deliveredItems: [
            {
              variantId: varId1,
              deliveredQuantity: 10,
            },
          ],
        },
      ],
    });

    const bal = balances.find((b) => String(b.dealershipId) === String(dId1));
    assert.ok(bal.onHandQuantity >= 0, "OnHand quantity must never be negative");
    assert.ok(bal.reservedQuantity >= 0, "Reserved quantity must never be negative");
    assert.ok(bal.stockInTransit >= 0, "Stock in transit must never be negative");
  });
});
