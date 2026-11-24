import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

// Models
import { Order } from "../src/models/Order.ts";
import { Counter } from "../src/models/Counter.ts";
import { Customer } from "../src/models/Customer.ts";
import { CustomerDealershipAccount } from "../src/models/CustomerDealershipAccount.ts";
import { Warehouse } from "../src/models/Warehouse.ts";
import { Product } from "../src/models/Product.ts";
import { ProductVariant } from "../src/models/ProductVariant.ts";
import { DealershipPrice } from "../src/models/DealershipPrice.ts";
import { InventoryBalance } from "../src/models/InventoryBalance.ts";
import { StockReservation } from "../src/models/StockReservation.ts";
import { StockMovement } from "../src/models/StockMovement.ts";
import { AuditLog } from "../src/models/AuditLog.ts";

// Services
import { SalesOrderService } from "../src/services/SalesOrderService.ts";
import { InventoryService } from "../src/services/InventoryService.ts";
import { PricingService } from "../src/services/PricingService.ts";

describe("Phase 3 - Step 5: Sales Order & Customer Sales Management Test Suite", () => {
  let orders = [];
  let balances = [];
  let reservations = [];
  let movements = [];
  let auditLogs = [];
  let customers = [];
  let accounts = [];
  let variants = [];
  let dealershipPrices = [];
  let counters = new Map();

  const bId = new mongoose.Types.ObjectId();
  const dId1 = new mongoose.Types.ObjectId();
  const dId2 = new mongoose.Types.ObjectId();
  const wId = new mongoose.Types.ObjectId();
  const cId = new mongoose.Types.ObjectId();
  const actId = new mongoose.Types.ObjectId();
  const prodId = new mongoose.Types.ObjectId();
  const varId1 = new mongoose.Types.ObjectId();
  const varId2 = new mongoose.Types.ObjectId();

  beforeEach(() => {
    orders = [];
    balances = [];
    reservations = [];
    movements = [];
    auditLogs = [];
    customers = [];
    accounts = [];
    variants = [];
    dealershipPrices = [];
    counters = new Map();

    // Default Customer
    customers.push({
      _id: cId,
      name: "Rahim Enterprise",
      shopName: "Rahim Store",
      phone: "+8801711223344",
      status: "active",
      businessId: bId,
    });

    // Default CustomerDealershipAccounts
    accounts.push({
      _id: new mongoose.Types.ObjectId(),
      customerId: cId,
      dealershipId: dId1,
      businessId: bId,
      creditLimit: 50000,
      currentBalance: 10000,
      status: "active",
      isDeleted: false,
    });

    accounts.push({
      _id: new mongoose.Types.ObjectId(),
      customerId: cId,
      dealershipId: dId2,
      businessId: bId,
      creditLimit: 20000,
      currentBalance: 0,
      status: "active",
      isDeleted: false,
    });

    // Default Variants
    variants.push({
      _id: varId1,
      productId: prodId,
      variantName: "1L Bottle",
      sku: "OIL-1L",
      purchasePrice: 120,
      customerPrice: 150,
      retailPrice: 165,
      status: "active",
    });

    variants.push({
      _id: varId2,
      productId: prodId,
      variantName: "5L Bottle",
      sku: "OIL-5L",
      purchasePrice: 550,
      customerPrice: 700,
      retailPrice: 750,
      status: "active",
    });

    // Counter Mock (Atomic in-memory increment)
    Counter.getNextSequence = async (key) => {
      const current = counters.get(key) || 0;
      const next = current + 1;
      counters.set(key, next);
      return next;
    };

    Counter.findOneAndUpdate = async (query, update, options) => {
      const key = query.key;
      const current = counters.get(key) || 0;
      const inc = update?.$inc?.seq || 1;
      const next = current + inc;
      counters.set(key, next);
      return { key, seq: next };
    };

    // Customer Mock
    Customer.findById = (id) => {
      const cust = customers.find((c) => String(c._id) === String(id));
      const chainable = {
        lean: async () => cust || null,
        then: (resolve, reject) => Promise.resolve(cust || null).then(resolve, reject),
      };
      return chainable;
    };

    // CustomerDealershipAccount Mock
    CustomerDealershipAccount.findOne = (query = {}) => {
      const acc = accounts.find((a) => {
        if (query.customerId && String(a.customerId) !== String(query.customerId)) return false;
        if (query.dealershipId && String(a.dealershipId) !== String(query.dealershipId)) return false;
        if (query.isDeleted !== undefined && a.isDeleted !== query.isDeleted) return false;
        return true;
      });
      const chainable = {
        session: () => chainable,
        lean: async () => acc || null,
        then: (resolve, reject) => Promise.resolve(acc || null).then(resolve, reject),
      };
      return chainable;
    };

    // Warehouse Mock
    Warehouse.findById = (id) => {
      const w = { _id: id, name: "Central Shared Warehouse", code: "WH-CENTRAL", status: "active" };
      const chainable = {
        session: () => chainable,
        lean: async () => w,
        then: (resolve, reject) => Promise.resolve(w).then(resolve, reject),
      };
      return chainable;
    };

    // Product & Variant Mocks
    Product.findById = (id) => {
      const p = { _id: id, name: "Mustard Oil", sku: "OIL-MUSTARD" };
      const chainable = {
        lean: async () => p,
        then: (resolve, reject) => Promise.resolve(p).then(resolve, reject),
      };
      return chainable;
    };

    ProductVariant.findById = (id) => {
      const v = variants.find((x) => String(x._id) === String(id));
      const chainable = {
        lean: async () => v || null,
        then: (resolve, reject) => Promise.resolve(v || null).then(resolve, reject),
      };
      return chainable;
    };

    ProductVariant.findOne = (query) => {
      const v = variants.find((x) => {
        if (query._id && String(x._id) !== String(query._id)) return false;
        if (query.productId && String(x.productId) !== String(query.productId)) return false;
        return true;
      });
      const chainable = {
        sort: () => chainable,
        lean: async () => v || null,
        then: (resolve, reject) => Promise.resolve(v || null).then(resolve, reject),
      };
      return chainable;
    };

    // DealershipPrice Mock
    DealershipPrice.findOne = (query) => {
      const dp = dealershipPrices.find((x) => {
        if (query.dealershipId && String(x.dealershipId) !== String(query.dealershipId)) return false;
        if (query.productId && String(x.productId) !== String(query.productId)) return false;
        if (query.variantId && String(x.variantId) !== String(query.variantId)) return false;
        return true;
      });
      const chainable = {
        sort: () => chainable,
        lean: async () => dp || null,
        then: (resolve, reject) => Promise.resolve(dp || null).then(resolve, reject),
      };
      return chainable;
    };

    // InventoryBalance Mock
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

    InventoryBalance.findOneAndUpdate = async (query, update, options) => {
      const idx = balances.findIndex((b) => {
        if (query.warehouseId && String(b.warehouseId) !== String(query.warehouseId)) return false;
        if (query.productId && String(b.productId) !== String(query.productId)) return false;
        if (query.variantId && String(b.variantId) !== String(query.variantId)) return false;
        if (query.dealershipId && String(b.dealershipId) !== String(query.dealershipId)) return false;
        if (query.businessId && String(b.businessId) !== String(query.businessId)) return false;

        // Atomic expression condition: $expr: { $gte: [{ $subtract: ["$onHandQuantity", "$reservedQuantity"] }, qty] }
        if (query.$expr && query.$expr.$gte) {
          const reqQty = query.$expr.$gte[1];
          const available = (b.onHandQuantity || 0) - (b.reservedQuantity || 0);
          if (available < reqQty) return false;
        }

        return true;
      });

      if (idx === -1) return null;

      const bal = balances[idx];
      if (update.$inc) {
        for (const [k, v] of Object.entries(update.$inc)) {
          bal[k] = (bal[k] || 0) + Number(v);
        }
      }
      if (update.$set) {
        Object.assign(bal, update.$set);
      }
      bal.availableQuantity = (bal.onHandQuantity || 0) - (bal.reservedQuantity || 0);
      return bal;
    };

    InventoryBalance.create = async (doc) => {
      const item = {
        _id: new mongoose.Types.ObjectId(),
        onHandQuantity: 0,
        reservedQuantity: 0,
        availableQuantity: 0,
        damagedQuantity: 0,
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

    InventoryBalance.find = (query = {}) => {
      const filtered = balances.filter((b) => {
        if (query.dealershipId && String(b.dealershipId) !== String(query.dealershipId)) return false;
        if (query.warehouseId && String(b.warehouseId) !== String(query.warehouseId)) return false;
        if (query.productId && String(b.productId) !== String(query.productId)) return false;
        return true;
      });
      return {
        lean: async () => filtered,
        then: (resolve, reject) => Promise.resolve(filtered).then(resolve, reject),
      };
    };

    // StockReservation Mock
    StockReservation.create = async (docs) => {
      const arr = Array.isArray(docs) ? docs : [docs];
      const created = arr.map((d) => ({
        _id: new mongoose.Types.ObjectId(),
        status: "active",
        ...d,
        save: async function () {
          const i = reservations.findIndex((r) => String(r._id) === String(this._id));
          if (i >= 0) reservations[i] = this;
          return this;
        },
      }));
      reservations.push(...created);
      return created;
    };

    StockReservation.findOne = (query) => {
      const res = reservations.find((r) => {
        if (query.idempotencyKey && r.idempotencyKey === query.idempotencyKey) return true;
        if (query.orderNumber && r.orderNumber === query.orderNumber) return true;
        return false;
      });
      const chainable = {
        session: () => chainable,
        lean: async () => res || null,
        then: (resolve, reject) => Promise.resolve(res || null).then(resolve, reject),
      };
      return chainable;
    };

    StockReservation.findById = (id) => {
      const res = reservations.find((r) => String(r._id) === String(id));
      const chainable = {
        session: () => chainable,
        lean: async () => res || null,
        then: (resolve, reject) => Promise.resolve(res || null).then(resolve, reject),
      };
      return chainable;
    };

    // StockMovement Mock
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

    // AuditLog Mock
    AuditLog.create = async (doc) => {
      auditLogs.push(doc);
      return doc;
    };

    // Order Mock
    Order.create = async (doc) => {
      const created = {
        _id: new mongoose.Types.ObjectId(),
        orderStatus: "DRAFT",
        items: [],
        ...doc,
        save: async function () {
          const i = orders.findIndex((o) => String(o._id) === String(this._id));
          if (i >= 0) orders[i] = this;
          return this;
        },
      };
      orders.push(created);
      return created;
    };

    Order.findOne = (query = {}) => {
      const ord = orders.find((o) => {
        if (query.idempotencyKey && o.idempotencyKey === query.idempotencyKey) return true;
        if (query.orderNumber && o.orderNumber === query.orderNumber) return true;
        return false;
      });
      const chainable = {
        session: () => chainable,
        lean: async () => ord || null,
        then: (resolve, reject) => Promise.resolve(ord || null).then(resolve, reject),
      };
      return chainable;
    };

    Order.findById = (id) => {
      const ord = orders.find((o) => String(o._id) === String(id));
      const chainable = {
        session: () => chainable,
        populate: (field, select) => {
          // In-memory populator for details test
          if (ord) {
            const copy = { ...ord };
            if (field === "customerId") copy.customerId = customers.find((c) => String(c._id) === String(ord.customerId)) || { _id: ord.customerId };
            if (field === "warehouseId") copy.warehouseId = { _id: ord.warehouseId, name: "Central Shared Warehouse", code: "WH-CENTRAL" };
            if (field === "dealershipId") copy.dealershipId = { _id: ord.dealershipId, name: "City Dealership", code: "DLR-01" };
            if (field === "customerDealershipAccountId") copy.customerDealershipAccountId = accounts.find((a) => String(a._id) === String(ord.customerDealershipAccountId)) || { _id: ord.customerDealershipAccountId };
            if (field === "reservationId" && ord.reservationId) copy.reservationId = reservations.find((r) => String(r._id) === String(ord.reservationId)) || { _id: ord.reservationId };
            return {
              ...chainable,
              populate: chainable.populate,
              lean: async () => copy,
              then: (resolve, reject) => Promise.resolve(copy).then(resolve, reject),
            };
          }
          return chainable;
        },
        lean: async () => ord || null,
        then: (resolve, reject) => Promise.resolve(ord || null).then(resolve, reject),
      };
      return chainable;
    };

    Order.find = (query = {}) => {
      let filtered = [...orders];
      if (query.businessId) filtered = filtered.filter((o) => String(o.businessId) === String(query.businessId));
      if (query.dealershipId) filtered = filtered.filter((o) => String(o.dealershipId) === String(query.dealershipId));
      if (query.orderStatus) filtered = filtered.filter((o) => o.orderStatus === query.orderStatus);

      const chainable = {
        sort: () => chainable,
        skip: () => chainable,
        limit: () => chainable,
        populate: () => chainable,
        lean: async () => filtered,
        then: (resolve, reject) => Promise.resolve(filtered).then(resolve, reject),
      };
      return chainable;
    };

    Order.countDocuments = async (query = {}) => {
      return orders.length;
    };

    Order.aggregate = async (pipeline = []) => {
      const totalOrders = orders.length;
      const confirmedOrders = orders.filter((o) => o.orderStatus === "CONFIRMED").length;
      const totalSalesValue = orders
        .filter((o) => o.orderStatus === "CONFIRMED" || o.orderStatus === "FULFILLED")
        .reduce((sum, o) => sum + (o.grandTotal || 0), 0);
      return [
        {
          totalOrders,
          draftOrders: orders.filter((o) => o.orderStatus === "DRAFT").length,
          confirmedOrders,
          fulfilledOrders: 0,
          totalSalesValue,
        },
      ];
    };
  });

  // Helper to initialize dealership inventory balance
  async function initInventory(dealershipId, variantId, onHand) {
    const bal = {
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      dealershipId,
      warehouseId: wId,
      productId: prodId,
      variantId,
      onHandQuantity: onHand,
      reservedQuantity: 0,
      availableQuantity: onHand,
      damagedQuantity: 0,
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
  // SCENARIO 1: DRAFT ORDER NEVER RESERVES STOCK
  // ==========================================
  test("1. Draft order creation does not reserve stock", async () => {
    await initInventory(dId1, varId1, 100);

    const order = await SalesOrderService.createSalesOrder({
      businessId: bId,
      dealershipId: dId1,
      customerId: cId,
      warehouseId: wId,
      items: [{ productId: prodId, variantId: varId1, quantity: 10 }],
      actorId: actId,
    });

    assert.equal(order.orderStatus, "DRAFT");
    assert.equal(order.items.length, 1);
    assert.equal(order.items[0].quantity, 10);
    assert.equal(order.grandTotal, 1500); // 10 * 150 customerPrice

    // Invariance Check: Zero reservations created, reservedQuantity remains 0
    assert.equal(reservations.length, 0);
    assert.equal(movements.length, 0);
    const bal = balances.find((b) => String(b.dealershipId) === String(dId1) && String(b.variantId) === String(varId1));
    assert.equal(bal.reservedQuantity, 0);
    assert.equal(bal.availableQuantity, 100);
  });

  // ==========================================
  // SCENARIO 2: CONFIRMED ORDER RESERVES STOCK
  // ==========================================
  test("2. Confirmed order reserves correct dealership stock in warehouse", async () => {
    await initInventory(dId1, varId1, 100);

    const draft = await SalesOrderService.createSalesOrder({
      businessId: bId,
      dealershipId: dId1,
      customerId: cId,
      warehouseId: wId,
      items: [{ productId: prodId, variantId: varId1, quantity: 25 }],
      actorId: actId,
    });

    const confirmed = await SalesOrderService.confirmSalesOrder({
      orderId: draft._id,
      actorId: actId,
    });

    assert.equal(confirmed.orderStatus, "CONFIRMED");
    assert.ok(confirmed.reservationId);

    // Reservation verified
    assert.equal(reservations.length, 1);
    assert.equal(reservations[0].status, "active");
    assert.equal(reservations[0].items[0].quantity, 25);

    // Balance updated atomically
    const bal = balances.find((b) => String(b.dealershipId) === String(dId1) && String(b.variantId) === String(varId1));
    assert.equal(bal.onHandQuantity, 100);
    assert.equal(bal.reservedQuantity, 25);
    assert.equal(bal.availableQuantity, 75);

    // Stock Movement ledger recorded
    const resMove = movements.find((m) => m.type === "reservation");
    assert.ok(resMove);
    assert.equal(resMove.quantity, 25);
  });

  // ==========================================
  // SCENARIO 3: CROSS-DEALERSHIP INVENTORY ISOLATION
  // ==========================================
  test("3. Cross-dealership inventory isolation (Dealership A cannot reserve Dealership B stock)", async () => {
    // Shared warehouse: Dealership 1 has 50 units, Dealership 2 has 200 units
    await initInventory(dId1, varId1, 50);
    await initInventory(dId2, varId1, 200);

    // Dealership 1 confirms order of 30 units
    const draft = await SalesOrderService.createSalesOrder({
      businessId: bId,
      dealershipId: dId1,
      customerId: cId,
      warehouseId: wId,
      items: [{ productId: prodId, variantId: varId1, quantity: 30 }],
      actorId: actId,
    });

    await SalesOrderService.confirmSalesOrder({
      orderId: draft._id,
      actorId: actId,
    });

    // Dealership 1 balances updated
    const bal1 = balances.find((b) => String(b.dealershipId) === String(dId1) && String(b.variantId) === String(varId1));
    assert.equal(bal1.onHandQuantity, 50);
    assert.equal(bal1.reservedQuantity, 30);
    assert.equal(bal1.availableQuantity, 20);

    // Dealership 2 balances remain 100% untouched
    const bal2 = balances.find((b) => String(b.dealershipId) === String(dId2) && String(b.variantId) === String(varId1));
    assert.equal(bal2.onHandQuantity, 200);
    assert.equal(bal2.reservedQuantity, 0);
    assert.equal(bal2.availableQuantity, 200);
  });

  // ==========================================
  // SCENARIO 4: INSUFFICIENT STOCK REJECTION
  // ==========================================
  test("4. Insufficient stock rejects confirmation with clear error", async () => {
    await initInventory(dId1, varId1, 5); // Only 5 available

    const draft = await SalesOrderService.createSalesOrder({
      businessId: bId,
      dealershipId: dId1,
      customerId: cId,
      warehouseId: wId,
      items: [{ productId: prodId, variantId: varId1, quantity: 15 }], // Requests 15
      actorId: actId,
    });

    await assert.rejects(
      async () => {
        await SalesOrderService.confirmSalesOrder({
          orderId: draft._id,
          actorId: actId,
        });
      },
      (err) => {
        assert.match(err.message, /Insufficient available stock/);
        return true;
      }
    );

    // Invariance Check: Status remains DRAFT and reservedQuantity remains 0
    const order = orders.find((o) => String(o._id) === String(draft._id));
    assert.equal(order.orderStatus, "DRAFT");
    assert.equal(reservations.length, 0);

    const bal = balances.find((b) => String(b.dealershipId) === String(dId1));
    assert.equal(bal.reservedQuantity, 0);
  });

  // ==========================================
  // SCENARIO 5: MULTI-LINE RESERVATION ROLLBACK
  // ==========================================
  test("5. Multi-line reservation rollback on partial line stock failure", async () => {
    // Variant 1 has 50 units (plenty), Variant 2 has only 2 units (insufficient)
    await initInventory(dId1, varId1, 50);
    await initInventory(dId1, varId2, 2);

    const draft = await SalesOrderService.createSalesOrder({
      businessId: bId,
      dealershipId: dId1,
      customerId: cId,
      warehouseId: wId,
      items: [
        { productId: prodId, variantId: varId1, quantity: 20 }, // would succeed
        { productId: prodId, variantId: varId2, quantity: 10 }, // will fail (only 2 available)
      ],
      actorId: actId,
    });

    await assert.rejects(
      async () => {
        await SalesOrderService.confirmSalesOrder({
          orderId: draft._id,
          actorId: actId,
        });
      },
      (err) => {
        assert.match(err.message, /Insufficient available stock/);
        return true;
      }
    );

    // Compensating Rollback Verification: Variant 1 must NOT remain reserved!
    const bal1 = balances.find((b) => String(b.variantId) === String(varId1));
    assert.equal(bal1.reservedQuantity, 0, "Variant 1 reservation must be rolled back to 0");
    assert.equal(bal1.availableQuantity, 50);

    const bal2 = balances.find((b) => String(b.variantId) === String(varId2));
    assert.equal(bal2.reservedQuantity, 0);

    // Order remains DRAFT
    const ord = orders.find((o) => String(o._id) === String(draft._id));
    assert.equal(ord.orderStatus, "DRAFT");
  });

  // ==========================================
  // SCENARIO 6: CONCURRENT CONFIRMATIONS DO NOT OVERSELL
  // ==========================================
  test("6. Concurrent order confirmations do not oversell", async () => {
    await initInventory(dId1, varId1, 10); // Total 10 available

    const order1 = await SalesOrderService.createSalesOrder({
      businessId: bId,
      dealershipId: dId1,
      customerId: cId,
      warehouseId: wId,
      items: [{ productId: prodId, variantId: varId1, quantity: 7 }],
    });

    const order2 = await SalesOrderService.createSalesOrder({
      businessId: bId,
      dealershipId: dId1,
      customerId: cId,
      warehouseId: wId,
      items: [{ productId: prodId, variantId: varId1, quantity: 7 }],
    });

    // Execute concurrently
    const results = await Promise.allSettled([
      SalesOrderService.confirmSalesOrder({ orderId: order1._id }),
      SalesOrderService.confirmSalesOrder({ orderId: order2._id }),
    ]);

    const successes = results.filter((r) => r.status === "fulfilled");
    const failures = results.filter((r) => r.status === "rejected");

    assert.equal(successes.length, 1, "Exactly one order should succeed");
    assert.equal(failures.length, 1, "Exactly one order should fail due to stock depletion");

    const bal = balances.find((b) => String(b.dealershipId) === String(dId1) && String(b.variantId) === String(varId1));
    assert.equal(bal.reservedQuantity, 7);
    assert.equal(bal.availableQuantity, 3);
  });

  // ==========================================
  // SCENARIO 7: DUPLICATE CONFIRMATION IS IDEMPOTENT
  // ==========================================
  test("7. Duplicate confirmation is idempotent (no double reservation)", async () => {
    await initInventory(dId1, varId1, 100);

    const draft = await SalesOrderService.createSalesOrder({
      businessId: bId,
      dealershipId: dId1,
      customerId: cId,
      warehouseId: wId,
      items: [{ productId: prodId, variantId: varId1, quantity: 15 }],
    });

    // First confirmation
    const firstConfirm = await SalesOrderService.confirmSalesOrder({ orderId: draft._id });
    assert.equal(firstConfirm.orderStatus, "CONFIRMED");

    const balAfterFirst = balances.find((b) => String(b.variantId) === String(varId1));
    assert.equal(balAfterFirst.reservedQuantity, 15);
    assert.equal(reservations.length, 1);

    // Second confirmation (idempotent replay)
    const secondConfirm = await SalesOrderService.confirmSalesOrder({ orderId: draft._id });
    assert.equal(secondConfirm.orderStatus, "CONFIRMED");

    // Reserved quantity does not double
    const balAfterSecond = balances.find((b) => String(b.variantId) === String(varId1));
    assert.equal(balAfterSecond.reservedQuantity, 15, "Reserved quantity must remain 15, not 30");
    assert.equal(reservations.length, 1, "No duplicate reservation record created");
  });

  // ==========================================
  // SCENARIO 8: CANCELLATION RELEASES RESERVATION EXACTLY ONCE
  // ==========================================
  test("8. Cancellation releases reservation exactly once", async () => {
    await initInventory(dId1, varId1, 100);

    const draft = await SalesOrderService.createSalesOrder({
      businessId: bId,
      dealershipId: dId1,
      customerId: cId,
      warehouseId: wId,
      items: [{ productId: prodId, variantId: varId1, quantity: 20 }],
    });

    await SalesOrderService.confirmSalesOrder({ orderId: draft._id });
    const balReserved = balances.find((b) => String(b.variantId) === String(varId1));
    assert.equal(balReserved.reservedQuantity, 20);

    // Cancel order
    const cancelled = await SalesOrderService.cancelSalesOrder({
      orderId: draft._id,
      reason: "Customer changed mind",
      actorId: actId,
    });

    assert.equal(cancelled.orderStatus, "CANCELLED");
    assert.equal(cancelled.cancellationReason, "Customer changed mind");

    // Stock released
    const balReleased = balances.find((b) => String(b.variantId) === String(varId1));
    assert.equal(balReleased.reservedQuantity, 0);
    assert.equal(balReleased.availableQuantity, 100);

    // Reservation marked released / cancelled
    const res = reservations[0];
    assert.ok(res.status === "released" || res.status === "cancelled", "Reservation should be released or cancelled");

    // Release movement logged
    const relMove = movements.find((m) => m.type === "reservation_release");
    assert.ok(relMove);
    assert.equal(relMove.quantity, 20);

    // Idempotent cancellation check: second cancel call does not throw or double-release
    const reCancel = await SalesOrderService.cancelSalesOrder({ orderId: draft._id });
    assert.equal(reCancel.orderStatus, "CANCELLED");
    assert.equal(balReleased.reservedQuantity, 0);
  });

  // ==========================================
  // SCENARIO 9: CONCURRENT ORDER NUMBER GENERATION
  // ==========================================
  test("9. Concurrent order number generation has no collisions", async () => {
    const promises = Array.from({ length: 25 }, () =>
      SalesOrderService.generateOrderNumber(bId, dId1)
    );

    const generated = await Promise.all(promises);
    const unique = new Set(generated);

    assert.equal(unique.size, 25, "All 25 generated order numbers must be strictly unique");
    for (const num of generated) {
      assert.match(num, /^SO-\d{6}-\d{4}$/, "Order number matches format SO-YYYYMM-0001");
    }
  });

  // ==========================================
  // SCENARIO 10: CUSTOMER DEALERSHIP ACCOUNT ISOLATION
  // ==========================================
  test("10. Customer dealership account isolation (Dealership 1 balance does not affect Dealership 2)", async () => {
    // Dealership 1 account: Limit 50k, Current 10k
    // Dealership 2 account: Limit 20k, Current 0
    const acc1 = await CustomerDealershipAccount.findOne({ dealershipId: dId1, customerId: cId });
    const acc2 = await CustomerDealershipAccount.findOne({ dealershipId: dId2, customerId: cId });

    assert.equal(acc1.creditLimit, 50000);
    assert.equal(acc1.currentBalance, 10000);

    assert.equal(acc2.creditLimit, 20000);
    assert.equal(acc2.currentBalance, 0);

    assert.notEqual(String(acc1._id), String(acc2._id));
  });

  // ==========================================
  // SCENARIO 11: CREDIT VALIDATION
  // ==========================================
  test("11. Credit validation: Rejects confirmation if order exceeds credit limit", async () => {
    await initInventory(dId2, varId1, 200);

    // Dealership 2 account: creditLimit is 20,000, currentBalance is 0.
    // Order grandTotal: 150 units * 150 BDT = 22,500 BDT (> 20,000 limit)
    const draft = await SalesOrderService.createSalesOrder({
      businessId: bId,
      dealershipId: dId2,
      customerId: cId,
      warehouseId: wId,
      items: [{ productId: prodId, variantId: varId1, quantity: 150 }],
    });

    assert.equal(draft.grandTotal, 22500);

    await assert.rejects(
      async () => {
        await SalesOrderService.confirmSalesOrder({ orderId: draft._id });
      },
      (err) => {
        assert.match(err.message, /Order exceeds customer credit limit/);
        return true;
      }
    );

    // Invariance: Inventory was NOT reserved
    const bal = balances.find((b) => String(b.dealershipId) === String(dId2));
    assert.equal(bal.reservedQuantity, 0);

    // Boundary Test: If creditLimit === 0 (unrestricted/cash delivery terms), confirmation succeeds
    const acc2 = accounts.find((a) => String(a.dealershipId) === String(dId2) && String(a.customerId) === String(cId));
    acc2.creditLimit = 0; // Set to zero (cash / unlimited)

    const confirmed = await SalesOrderService.confirmSalesOrder({ orderId: draft._id });
    assert.equal(confirmed.orderStatus, "CONFIRMED");
  });

  // ==========================================
  // SCENARIO 12: SERVER-SIDE AUTHORITATIVE PRICE VALIDATION
  // ==========================================
  test("12. Server-side price validation: Ignores client prices and applies active selling price", async () => {
    // Add Dealership 1 price override: customerPrice: 180, retailPrice: 200
    dealershipPrices.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      dealershipId: dId1,
      productId: prodId,
      variantId: varId1,
      customerPrice: 180,
      retailPrice: 200,
      purchasePrice: 130,
      status: "active",
      effectiveFrom: new Date(Date.now() - 86400000),
    });

    const order = await SalesOrderService.createSalesOrder({
      businessId: bId,
      dealershipId: dId1,
      customerId: cId,
      warehouseId: wId,
      items: [
        {
          productId: prodId,
          variantId: varId1,
          quantity: 10,
          // Attacker sends artificially low price of 10 BDT; should be ignored!
          fakeClientPrice: 10,
        },
      ],
    });

    assert.equal(order.items[0].unitPrice, 180, "Must apply authoritative price 180, not 10");
    assert.equal(order.items[0].customerPriceSnapshot, 180);
    assert.equal(order.items[0].retailPriceSnapshot, 200);
    assert.equal(order.items[0].priceSource, "dealership_override");
    assert.equal(order.grandTotal, 1800);
  });

  // ==========================================
  // SCENARIO 13: HISTORICAL PRICE IMMUTABILITY
  // ==========================================
  test("13. Historical order price snapshot remains unchanged when catalog price changes", async () => {
    await initInventory(dId1, varId1, 100);

    const draft = await SalesOrderService.createSalesOrder({
      businessId: bId,
      dealershipId: dId1,
      customerId: cId,
      warehouseId: wId,
      items: [{ productId: prodId, variantId: varId1, quantity: 10 }],
    });

    const confirmed = await SalesOrderService.confirmSalesOrder({ orderId: draft._id });
    assert.equal(confirmed.items[0].customerPriceSnapshot, 150);
    assert.equal(confirmed.grandTotal, 1500);

    // Catalog price later surges to 300 BDT
    const v = variants.find((x) => String(x._id) === String(varId1));
    v.customerPrice = 300;

    // Retrieve order: historical price snapshot remains 150
    const retrieved = await Order.findById(confirmed._id);
    assert.equal(retrieved.items[0].customerPriceSnapshot, 150);
    assert.equal(retrieved.items[0].unitPrice, 150);
    assert.equal(retrieved.grandTotal, 1500);
  });

  // ==========================================
  // SCENARIO 14: SALES ROLE CONFIDENTIALITY (PURCHASE COST MASKING)
  // ==========================================
  test("14. Sales role cannot access purchase price through API (role masking)", () => {
    // Role checks
    assert.equal(PricingService.canViewPurchasePrice("sales_staff", []), false);
    assert.equal(PricingService.canViewPurchasePrice("sales_manager", []), false);
    assert.equal(PricingService.canViewPurchasePrice("cashier", []), false);

    assert.equal(PricingService.canViewPurchasePrice("owner", []), true);
    assert.equal(PricingService.canViewPurchasePrice("admin", []), true);

    // Sanitization check
    const rawVariant = {
      _id: String(varId1),
      productId: String(prodId),
      variantName: "1L Bottle",
      sku: "OIL-1L",
      purchasePrice: 120, // Sensitive cost
      customerPrice: 150,
      retailPrice: 165,
      status: "active",
      attributes: [],
    };

    const sanitizedForSales = PricingService.sanitizeVariant(rawVariant, "sales_staff", []);
    assert.equal(sanitizedForSales.purchasePrice, undefined, "purchasePrice must be omitted for sales staff");
    assert.equal(sanitizedForSales.customerPrice, 150);
    assert.equal(sanitizedForSales.retailPrice, 165);

    const sanitizedForOwner = PricingService.sanitizeVariant(rawVariant, "owner", []);
    assert.equal(sanitizedForOwner.purchasePrice, 120, "purchasePrice visible for owner");
  });

  // ==========================================
  // SCENARIO 15: CROSS-DEALERSHIP ORDER ACCESS REJECTED
  // ==========================================
  test("15. Cross-dealership order access is rejected (403 Forbidden)", async () => {
    const orderDealership1 = await SalesOrderService.createSalesOrder({
      businessId: bId,
      dealershipId: dId1,
      customerId: cId,
      warehouseId: wId,
      items: [{ productId: prodId, variantId: varId1, quantity: 5 }],
    });

    // Staff from Dealership 2 attempts to fetch order belonging to Dealership 1
    await assert.rejects(
      async () => {
        await SalesOrderService.getSalesOrderDetails(orderDealership1._id, {
          dealershipId: dId2,
          role: "sales_staff",
        });
      },
      (err) => {
        assert.match(err.message, /Cross-dealership order access denied/);
        return true;
      }
    );

    // Owner context is permitted to view across dealerships
    const ownerView = await SalesOrderService.getSalesOrderDetails(orderDealership1._id, {
      dealershipId: dId2,
      role: "owner",
    });
    assert.ok(ownerView);
    assert.equal(String(ownerView._id), String(orderDealership1._id));
  });

  // ==========================================
  // SCENARIO 16: SALES DASHBOARD KPIS & ORDER LISTING
  // ==========================================
  test("16. Sales dashboard KPIs and indexed order listing", async () => {
    await initInventory(dId1, varId1, 100);

    const o1 = await SalesOrderService.createSalesOrder({
      businessId: bId,
      dealershipId: dId1,
      customerId: cId,
      warehouseId: wId,
      items: [{ productId: prodId, variantId: varId1, quantity: 5 }],
    });
    await SalesOrderService.confirmSalesOrder({ orderId: o1._id });

    const kpis = await SalesOrderService.getSalesDashboardKpis(bId, dId1);

    assert.ok(kpis.totalOrders >= 1);
    assert.ok(kpis.confirmedOrders >= 1);
    assert.ok(kpis.totalSalesValue > 0);

    const listing = await SalesOrderService.listSalesOrders({
      businessId: bId,
      dealershipId: dId1,
      page: 1,
      limit: 10,
    });

    assert.ok(listing.orders.length >= 1);
    assert.equal(listing.pagination.page, 1);
  });
});
