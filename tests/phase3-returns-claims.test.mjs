import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

// Models
import { SalesReturn } from "../src/models/SalesReturn.ts";
import { PurchaseReturn } from "../src/models/PurchaseReturn.ts";
import { Claim } from "../src/models/Claim.ts";
import { Order } from "../src/models/Order.ts";
import { GoodsReceiptNote } from "../src/models/GoodsReceiptNote.ts";
import { InventoryBalance } from "../src/models/InventoryBalance.ts";
import { StockMovement } from "../src/models/StockMovement.ts";
import { CustomerDealershipAccount } from "../src/models/CustomerDealershipAccount.ts";
import { SupplierPayable } from "../src/models/SupplierPayable.ts";
import { Vendor } from "../src/models/Vendor.ts";
import { Counter } from "../src/models/Counter.ts";
import { AuditLog } from "../src/models/AuditLog.ts";

// Services
import { ReturnsService } from "../src/services/ReturnsService.ts";

describe("Phase 3 - Step 7: Returns, Claims & Reverse Logistics Test Suite", () => {
  let salesReturns = [];
  let purchaseReturns = [];
  let claims = [];
  let orders = [];
  let grns = [];
  let balances = [];
  let movements = [];
  let customerAccounts = [];
  let supplierPayables = [];
  let vendors = [];
  let auditLogs = [];
  let counters = new Map();

  const bId = new mongoose.Types.ObjectId();
  const dId1 = new mongoose.Types.ObjectId();
  const dId2 = new mongoose.Types.ObjectId();
  const wId = new mongoose.Types.ObjectId();
  const cId = new mongoose.Types.ObjectId();
  const vId = new mongoose.Types.ObjectId();
  const actId = new mongoose.Types.ObjectId();

  const prod1Id = new mongoose.Types.ObjectId();
  const prod2Id = new mongoose.Types.ObjectId();

  beforeEach(() => {
    salesReturns = [];
    purchaseReturns = [];
    claims = [];
    orders = [];
    grns = [];
    balances = [];
    movements = [];
    customerAccounts = [];
    supplierPayables = [];
    vendors = [];
    auditLogs = [];
    counters = new Map();

    // Mock Counter
    Counter.getNextSequence = async (key) => {
      const current = counters.get(key) || 0;
      const next = current + 1;
      counters.set(key, next);
      return next;
    };

    // Mock AuditLog
    AuditLog.create = async (doc) => {
      auditLogs.push(doc);
      return doc;
    };

    // Mock InventoryBalance
    InventoryBalance.findOne = (query) => {
      const bal = balances.find((b) => {
        if (query.warehouseId && String(b.warehouseId) !== String(query.warehouseId)) return false;
        if (query.productId && String(b.productId) !== String(query.productId)) return false;
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

    // Mock CustomerDealershipAccount
    CustomerDealershipAccount.findOne = (query) => {
      const acc = customerAccounts.find((a) => {
        if (query.customerId && String(a.customerId) !== String(query.customerId)) return false;
        if (query.dealershipId && String(a.dealershipId) !== String(query.dealershipId)) return false;
        if (query.businessId && String(a.businessId) !== String(query.businessId)) return false;
        return true;
      });
      const chainable = {
        session: () => chainable,
        lean: async () => acc || null,
        then: (resolve, reject) => Promise.resolve(acc || null).then(resolve, reject),
      };
      return chainable;
    };

    CustomerDealershipAccount.findById = (id) => {
      const acc = customerAccounts.find((a) => String(a._id) === String(id));
      const chainable = {
        session: () => chainable,
        lean: async () => acc || null,
        then: (resolve, reject) => Promise.resolve(acc || null).then(resolve, reject),
      };
      return chainable;
    };

    // Mock SupplierPayable
    SupplierPayable.findOne = (query) => {
      const p = supplierPayables.find((sp) => {
        if (query.grnId && String(sp.grnId) !== String(query.grnId)) return false;
        if (query._id && String(sp._id) !== String(query._id)) return false;
        return true;
      });
      const chainable = {
        session: () => chainable,
        lean: async () => p || null,
        then: (resolve, reject) => Promise.resolve(p || null).then(resolve, reject),
      };
      return chainable;
    };

    SupplierPayable.findById = (id) => {
      const p = supplierPayables.find((sp) => String(sp._id) === String(id));
      const chainable = {
        session: () => chainable,
        lean: async () => p || null,
        then: (resolve, reject) => Promise.resolve(p || null).then(resolve, reject),
      };
      return chainable;
    };

    // Mock Vendor
    Vendor.findById = (id) => {
      const v = vendors.find((vx) => String(vx._id) === String(id));
      const chainable = {
        session: () => chainable,
        lean: async () => v || null,
        then: (resolve, reject) => Promise.resolve(v || null).then(resolve, reject),
      };
      return chainable;
    };

    // Mock Order
    Order.findById = (id) => {
      const o = orders.find((ox) => String(ox._id) === String(id));
      const chainable = {
        session: () => chainable,
        lean: async () => o || null,
        then: (resolve, reject) => Promise.resolve(o || null).then(resolve, reject),
      };
      return chainable;
    };

    // Mock GoodsReceiptNote
    GoodsReceiptNote.findById = (id) => {
      const g = grns.find((gx) => String(gx._id) === String(id));
      const chainable = {
        session: () => chainable,
        lean: async () => g || null,
        then: (resolve, reject) => Promise.resolve(g || null).then(resolve, reject),
      };
      return chainable;
    };

    // Mock SalesReturn
    SalesReturn.find = (query = {}) => {
      let filtered = [...salesReturns];
      if (query.orderId) filtered = filtered.filter((r) => String(r.orderId) === String(query.orderId));
      if (query.status && query.status.$nin) {
        filtered = filtered.filter((r) => !query.status.$nin.includes(r.status));
      }
      if (query.dealershipId) filtered = filtered.filter((r) => String(r.dealershipId) === String(query.dealershipId));
      if (query.businessId) filtered = filtered.filter((r) => String(r.businessId) === String(query.businessId));
      const chainable = {
        populate: () => chainable,
        sort: () => chainable,
        lean: async () => filtered,
        then: (resolve, reject) => Promise.resolve(filtered).then(resolve, reject),
      };
      return chainable;
    };

    SalesReturn.findById = (id) => {
      const r = salesReturns.find((rx) => String(rx._id) === String(id));
      const chainable = {
        populate: () => chainable,
        session: () => chainable,
        lean: async () => r || null,
        then: (resolve, reject) => Promise.resolve(r || null).then(resolve, reject),
      };
      return chainable;
    };

    SalesReturn.create = async (doc) => {
      const ret = {
        _id: new mongoose.Types.ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "REQUESTED",
        refundStatus: "NONE",
        ...doc,
        save: async function () {
          const i = salesReturns.findIndex((r) => String(r._id) === String(this._id));
          if (i >= 0) salesReturns[i] = this;
          return this;
        },
      };
      salesReturns.push(ret);
      return ret;
    };

    SalesReturn.findOneAndUpdate = (query, update, options) => {
      const r = salesReturns.find((x) => {
        if (query._id && String(x._id) !== String(query._id)) return false;
        if (query.status) {
          if (Array.isArray(query.status.$in) && !query.status.$in.includes(x.status)) return false;
          if (typeof query.status === "string" && x.status !== query.status) return false;
        }
        if (query.refundStatus) {
          if (Array.isArray(query.refundStatus.$in) && !query.refundStatus.$in.includes(x.refundStatus)) return false;
          if (typeof query.refundStatus === "string" && x.refundStatus !== query.refundStatus) return false;
        }
        return true;
      });
      if (r && update?.$set) {
        Object.assign(r, update.$set);
      }
      const chainable = {
        session: () => chainable,
        then: (resolve, reject) => Promise.resolve(r || null).then(resolve, reject),
      };
      return chainable;
    };

    SalesReturn.updateOne = (query, update) => {
      const r = salesReturns.find((x) => {
        if (query._id && String(x._id) !== String(query._id)) return false;
        return true;
      });
      if (r && update?.$set) {
        Object.assign(r, update.$set);
      }
      return Promise.resolve({ modifiedCount: r ? 1 : 0 });
    };

    // Mock PurchaseReturn
    PurchaseReturn.find = (query = {}) => {
      let filtered = [...purchaseReturns];
      if (query.grnId) filtered = filtered.filter((r) => String(r.grnId) === String(query.grnId));
      if (query.status && query.status.$nin) {
        filtered = filtered.filter((r) => !query.status.$nin.includes(r.status));
      }
      if (query.dealershipId) filtered = filtered.filter((r) => String(r.dealershipId) === String(query.dealershipId));
      if (query.businessId) filtered = filtered.filter((r) => String(r.businessId) === String(query.businessId));
      const chainable = {
        populate: () => chainable,
        sort: () => chainable,
        lean: async () => filtered,
        then: (resolve, reject) => Promise.resolve(filtered).then(resolve, reject),
      };
      return chainable;
    };

    PurchaseReturn.findById = (id) => {
      const r = purchaseReturns.find((rx) => String(rx._id) === String(id));
      const chainable = {
        populate: () => chainable,
        session: () => chainable,
        lean: async () => r || null,
        then: (resolve, reject) => Promise.resolve(r || null).then(resolve, reject),
      };
      return chainable;
    };

    PurchaseReturn.create = async (doc) => {
      const ret = {
        _id: new mongoose.Types.ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "SUBMITTED",
        ...doc,
        save: async function () {
          const i = purchaseReturns.findIndex((r) => String(r._id) === String(this._id));
          if (i >= 0) purchaseReturns[i] = this;
          return this;
        },
      };
      purchaseReturns.push(ret);
      return ret;
    };

    PurchaseReturn.findOneAndUpdate = (query, update, options) => {
      const r = purchaseReturns.find((x) => {
        if (query._id && String(x._id) !== String(query._id)) return false;
        if (query.status) {
          if (Array.isArray(query.status.$in) && !query.status.$in.includes(x.status)) return false;
          if (typeof query.status === "string" && x.status !== query.status) return false;
        }
        return true;
      });
      if (r && update?.$set) {
        Object.assign(r, update.$set);
      }
      const chainable = {
        session: () => chainable,
        then: (resolve, reject) => Promise.resolve(r || null).then(resolve, reject),
      };
      return chainable;
    };

    PurchaseReturn.updateOne = (query, update) => {
      const r = purchaseReturns.find((x) => {
        if (query._id && String(x._id) !== String(query._id)) return false;
        return true;
      });
      if (r && update?.$set) {
        Object.assign(r, update.$set);
      }
      return Promise.resolve({ modifiedCount: r ? 1 : 0 });
    };

    // Mock Claim
    Claim.find = (query = {}) => {
      let filtered = [...claims];
      if (query.dealershipId) filtered = filtered.filter((c) => String(c.dealershipId) === String(query.dealershipId));
      if (query.businessId) filtered = filtered.filter((c) => String(c.businessId) === String(query.businessId));
      const chainable = {
        populate: () => chainable,
        sort: () => chainable,
        lean: async () => filtered,
        then: (resolve, reject) => Promise.resolve(filtered).then(resolve, reject),
      };
      return chainable;
    };

    Claim.findById = (id) => {
      const c = claims.find((cx) => String(cx._id) === String(id));
      const chainable = {
        populate: () => chainable,
        session: () => chainable,
        lean: async () => c || null,
        then: (resolve, reject) => Promise.resolve(c || null).then(resolve, reject),
      };
      return chainable;
    };

    Claim.create = async (doc) => {
      const cl = {
        _id: new mongoose.Types.ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "SUBMITTED",
        settledAmount: 0,
        ...doc,
        save: async function () {
          const i = claims.findIndex((c) => String(c._id) === String(this._id));
          if (i >= 0) claims[i] = this;
          return this;
        },
      };
      claims.push(cl);
      return cl;
    };

    Claim.findOneAndUpdate = (query, update, options) => {
      const c = claims.find((x) => {
        if (query._id && String(x._id) !== String(query._id)) return false;
        if (query.status) {
          if (Array.isArray(query.status.$in) && !query.status.$in.includes(x.status)) return false;
          if (typeof query.status === "string" && x.status !== query.status) return false;
        }
        return true;
      });
      if (c && update?.$set) {
        Object.assign(c, update.$set);
      }
      const chainable = {
        session: () => chainable,
        then: (resolve, reject) => Promise.resolve(c || null).then(resolve, reject),
      };
      return chainable;
    };

    Claim.updateOne = (query, update) => {
      const c = claims.find((x) => {
        if (query._id && String(x._id) !== String(query._id)) return false;
        return true;
      });
      if (c && update?.$set) {
        Object.assign(c, update.$set);
      }
      return Promise.resolve({ modifiedCount: c ? 1 : 0 });
    };
  });

  // Helper setup
  function setupDeliveredOrder(qty = 10, unitPrice = 100) {
    const oId = new mongoose.Types.ObjectId();
    const order = {
      _id: oId,
      orderNumber: "SO-2026-001",
      businessId: bId,
      dealershipId: dId1,
      customerId: cId,
      warehouseId: wId,
      status: "FULFILLED",
      items: [
        {
          productId: prod1Id,
          productName: "Premium Synthetic Oil",
          quantity: qty,
          unitPrice: unitPrice,
          deliveredQuantity: qty,
          invoicedQuantity: qty,
        },
      ],
      pricing: {
        totalAmount: qty * unitPrice,
        grandTotal: qty * unitPrice,
      },
      createdAt: new Date(),
      save: async function () {
        const i = orders.findIndex((o) => String(o._id) === String(this._id));
        if (i >= 0) orders[i] = this;
        return this;
      },
    };
    orders.push(order);

    // Initial inventory balance
    const bal = {
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      dealershipId: dId1,
      warehouseId: wId,
      productId: prod1Id,
      onHandQuantity: 50,
      reservedQuantity: 0,
      availableQuantity: 50,
      damagedQuantity: 0,
      save: async function () {
        const i = balances.findIndex((b) => String(b._id) === String(this._id));
        if (i >= 0) balances[i] = this;
        return this;
      },
    };
    balances.push(bal);

    // Customer Dealership Account
    const acc = {
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      dealershipId: dId1,
      customerId: cId,
      currentBalance: 1000,
      totalInvoiced: 1000,
      totalPaid: 0,
      totalReturned: 0,
      save: async function () {
        const i = customerAccounts.findIndex((a) => String(a._id) === String(this._id));
        if (i >= 0) customerAccounts[i] = this;
        return this;
      },
    };
    customerAccounts.push(acc);

    return { order, bal, acc };
  }

  function setupConfirmedGrn(qty = 20, landedCost = 80) {
    const gId = new mongoose.Types.ObjectId();
    const grn = {
      _id: gId,
      grnNumber: "GRN-2026-001",
      challanNumber: "CH-8899",
      invoiceNumber: "INV-SUP-9988",
      businessId: bId,
      dealershipId: dId1,
      supplierId: vId,
      warehouseId: wId,
      status: "VERIFIED",
      items: [
        {
          productId: prod2Id,
          productName: "High Performance Brake Fluid",
          challanQuantity: qty,
          receivedQuantity: qty,
          netLandedUnitCost: landedCost,
          lineTotal: qty * landedCost,
        },
      ],
      createdAt: new Date(),
      save: async function () {
        const i = grns.findIndex((g) => String(g._id) === String(this._id));
        if (i >= 0) grns[i] = this;
        return this;
      },
    };
    grns.push(grn);

    // Initial inventory balance for GRN product
    const bal = {
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      dealershipId: dId1,
      warehouseId: wId,
      productId: prod2Id,
      onHandQuantity: qty,
      reservedQuantity: 0,
      availableQuantity: qty,
      damagedQuantity: 0,
      save: async function () {
        const i = balances.findIndex((b) => String(b._id) === String(this._id));
        if (i >= 0) balances[i] = this;
        return this;
      },
    };
    balances.push(bal);

    // Supplier Payable
    const sp = {
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      dealershipId: dId1,
      supplierId: vId,
      grnId: gId,
      invoiceNumber: "INV-SUP-9988",
      totalAmount: qty * landedCost,
      paidAmount: 0,
      remainingAmount: qty * landedCost,
      isCancelled: false,
      save: async function () {
        const i = supplierPayables.findIndex((p) => String(p._id) === String(this._id));
        if (i >= 0) supplierPayables[i] = this;
        return this;
      },
    };
    supplierPayables.push(sp);

    // Vendor
    const vendor = {
      _id: vId,
      businessId: bId,
      name: "Total Petrochemicals Ltd",
      currentPayable: qty * landedCost,
      save: async function () {
        const i = vendors.findIndex((vx) => String(vx._id) === String(this._id));
        if (i >= 0) vendors[i] = this;
        return this;
      },
    };
    vendors.push(vendor);

    return { grn, bal, sp, vendor };
  }

  // --- TESTS ---

  test("1. Customer return quantity cannot exceed delivered quantity minus prior returns", async () => {
    const { order } = setupDeliveredOrder(10, 100);

    // First return: 6 units (valid)
    const ret1 = await ReturnsService.createSalesReturnRequest({
      businessId: bId.toString(),
      dealershipId: dId1.toString(),
      orderId: order._id.toString(),
      reason: "Defective batch",
      items: [{ productId: prod1Id.toString(), quantity: 6, reason: "Defective" }],
    });
    assert.strictEqual(ret1.items[0].returnedQuantity ?? ret1.items[0].quantity, 6);

    // Second return: attempting 5 more units (6 + 5 = 11 > 10 delivered)
    await assert.rejects(
      async () => {
        await ReturnsService.createSalesReturnRequest({
          businessId: bId.toString(),
          dealershipId: dId1.toString(),
          orderId: order._id.toString(),
          reason: "Excess return",
          items: [{ productId: prod1Id.toString(), quantity: 5 }],
        });
      },
      /exceeds returnable quantity/i
    );
  });

  test("2. Return request in REQUESTED does not mutate inventory or customer balance", async () => {
    const { order, bal, acc } = setupDeliveredOrder(10, 100);
    const initialOnHand = bal.onHandQuantity;
    const initialAvail = bal.availableQuantity;
    const initialBalance = acc.currentBalance;

    const ret = await ReturnsService.createSalesReturnRequest({
      businessId: bId.toString(),
      dealershipId: dId1.toString(),
      orderId: order._id.toString(),
      reason: "Customer changed mind",
      items: [{ productId: prod1Id.toString(), quantity: 3, unitPrice: 100 }],
    });

    assert.strictEqual(ret.status, "REQUESTED");
    assert.strictEqual(ret.refundStatus, "NONE");

    // Stock must be completely unchanged
    assert.strictEqual(bal.onHandQuantity, initialOnHand);
    assert.strictEqual(bal.availableQuantity, initialAvail);
    // Customer balance must be completely unchanged
    assert.strictEqual(acc.currentBalance, initialBalance);
    assert.strictEqual(movements.length, 0);
  });

  test("3. Inspection classification of GOOD_RESTOCKABLE restocks into onHand and available on approval", async () => {
    const { order, bal } = setupDeliveredOrder(10, 100);
    const initialOnHand = bal.onHandQuantity; // 50
    const initialAvail = bal.availableQuantity; // 50

    const ret = await ReturnsService.createSalesReturnRequest({
      businessId: bId.toString(),
      dealershipId: dId1.toString(),
      orderId: order._id.toString(),
      reason: "Unopened box return",
      items: [{ productId: prod1Id.toString(), quantity: 4, unitPrice: 100 }],
    });

    // Inspect
    await ReturnsService.inspectSalesReturn(ret._id.toString(), {
      inspectionNotes: "Factory seal intact, good for resale",
      itemClassifications: [{ itemIndex: 0, classification: "GOOD_RESTOCKABLE" }],
    });

    // Approve
    const approved = await ReturnsService.approveSalesReturn(ret._id.toString(), {
      action: "APPROVE",
      notes: "Restocked immediately",
    });

    assert.strictEqual(approved.status, "RESTOCKED");
    assert.strictEqual(approved.refundStatus, "PENDING");
    assert.strictEqual(bal.onHandQuantity, initialOnHand + 4);
    assert.strictEqual(bal.availableQuantity, initialAvail + 4);
    assert.strictEqual(bal.damagedQuantity, 0);

    const move = movements.find((m) => m.movementType === "sales_return");
    assert.ok(move);
    assert.strictEqual(move.quantity, 4);
  });

  test("4. Damaged/expired return moves to damagedQuantity and does not increase availableQuantity", async () => {
    const { order, bal } = setupDeliveredOrder(10, 100);
    const initialOnHand = bal.onHandQuantity; // 50
    const initialAvail = bal.availableQuantity; // 50

    const ret = await ReturnsService.createSalesReturnRequest({
      businessId: bId.toString(),
      dealershipId: dId1.toString(),
      orderId: order._id.toString(),
      reason: "Leaking bottle",
      items: [{ productId: prod1Id.toString(), quantity: 2, unitPrice: 100 }],
    });

    // Inspect as DAMAGED
    await ReturnsService.inspectSalesReturn(ret._id.toString(), {
      inspectionNotes: "Broken cap and seal broken",
      itemClassifications: [{ itemIndex: 0, classification: "DAMAGED" }],
    });

    // Approve
    const approved = await ReturnsService.approveSalesReturn(ret._id.toString(), {
      action: "APPROVE",
    });

    assert.strictEqual(approved.status, "RESTOCKED");
    // On hand increases by 2 (physical custody in warehouse)
    assert.strictEqual(bal.onHandQuantity, initialOnHand + 2);
    // Damaged increases by 2
    assert.strictEqual(bal.damagedQuantity, 2);
    // Available quantity must NOT increase!
    assert.strictEqual(bal.availableQuantity, initialAvail);

    const move = movements.find((m) => m.movementType === "sales_return_damage");
    assert.ok(move);
    assert.strictEqual(move.quantity, 2);
  });

  test("5. Rejection of return does not mutate inventory or finances", async () => {
    const { order, bal, acc } = setupDeliveredOrder(10, 100);
    const initialOnHand = bal.onHandQuantity;
    const initialAvail = bal.availableQuantity;
    const initialBalance = acc.currentBalance;

    const ret = await ReturnsService.createSalesReturnRequest({
      businessId: bId.toString(),
      dealershipId: dId1.toString(),
      orderId: order._id.toString(),
      reason: "Fraudulent claim",
      items: [{ productId: prod1Id.toString(), quantity: 2 }],
    });

    const rejected = await ReturnsService.approveSalesReturn(ret._id.toString(), {
      action: "REJECT",
      rejectionReason: "Product used and empty bottle returned",
    });

    assert.strictEqual(rejected.status, "REJECTED");
    assert.strictEqual(rejected.refundStatus, "REJECTED");
    assert.strictEqual(bal.onHandQuantity, initialOnHand);
    assert.strictEqual(bal.availableQuantity, initialAvail);
    assert.strictEqual(acc.currentBalance, initialBalance);
    assert.strictEqual(movements.length, 0);
  });

  test("6. Customer credit note reduces CustomerDealershipAccount.currentBalance for the specific dealership only", async () => {
    const { order, acc } = setupDeliveredOrder(10, 100);
    assert.strictEqual(acc.currentBalance, 1000);

    const ret = await ReturnsService.createSalesReturnRequest({
      businessId: bId.toString(),
      dealershipId: dId1.toString(),
      orderId: order._id.toString(),
      reason: "Good return",
      items: [{ productId: prod1Id.toString(), quantity: 3, unitPrice: 100 }],
    });

    await ReturnsService.inspectSalesReturn(ret._id.toString(), {
      itemClassifications: [{ itemIndex: 0, classification: "GOOD_RESTOCKABLE" }],
    });
    await ReturnsService.approveSalesReturn(ret._id.toString(), { action: "APPROVE" });

    // Process Credit Note of 300
    const settled = await ReturnsService.processCustomerRefund(ret._id.toString(), {
      refundMethod: "credit_note",
      refundAmount: 300,
      refundReference: "CRN-001",
    });

    assert.strictEqual(settled.refundStatus, "CREDIT_NOTE_ISSUED");
    assert.strictEqual(settled.status, "CLOSED");
    // Balance drops from 1000 to 700
    assert.strictEqual(acc.currentBalance, 700);
    assert.strictEqual(acc.totalReturned, 300);
  });

  test("7. Cross-dealership customer balance isolation (Dealership A refund cannot touch Dealership B)", async () => {
    const { order, acc: accA } = setupDeliveredOrder(10, 100);

    // Setup account for Dealership B
    const accB = {
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      dealershipId: dId2,
      customerId: cId,
      currentBalance: 5000,
      totalInvoiced: 5000,
      totalPaid: 0,
      totalReturned: 0,
      save: async function () {
        const i = customerAccounts.findIndex((a) => String(a._id) === String(this._id));
        if (i >= 0) customerAccounts[i] = this;
        return this;
      },
    };
    customerAccounts.push(accB);

    const ret = await ReturnsService.createSalesReturnRequest({
      businessId: bId.toString(),
      dealershipId: dId1.toString(),
      orderId: order._id.toString(),
      reason: "Return for Dealership A",
      items: [{ productId: prod1Id.toString(), quantity: 2, unitPrice: 100 }],
    });

    await ReturnsService.inspectSalesReturn(ret._id.toString(), {
      itemClassifications: [{ itemIndex: 0, classification: "GOOD_RESTOCKABLE" }],
    });
    await ReturnsService.approveSalesReturn(ret._id.toString(), { action: "APPROVE" });

    await ReturnsService.processCustomerRefund(ret._id.toString(), {
      refundMethod: "credit_note",
      refundAmount: 200,
    });

    // Dealership A balance is updated
    assert.strictEqual(accA.currentBalance, 800);
    // Dealership B balance remains strictly untouched!
    assert.strictEqual(accB.currentBalance, 5000);
    assert.strictEqual(accB.totalReturned, 0);
  });

  test("8. Customer refund cannot exceed approved return amount", async () => {
    const { order } = setupDeliveredOrder(10, 100);

    const ret = await ReturnsService.createSalesReturnRequest({
      businessId: bId.toString(),
      dealershipId: dId1.toString(),
      orderId: order._id.toString(),
      reason: "2 units return ($200)",
      items: [{ productId: prod1Id.toString(), quantity: 2, unitPrice: 100 }],
    });

    await ReturnsService.inspectSalesReturn(ret._id.toString(), {
      itemClassifications: [{ itemIndex: 0, classification: "GOOD_RESTOCKABLE" }],
    });
    await ReturnsService.approveSalesReturn(ret._id.toString(), { action: "APPROVE" });

    // Attempt refund of $250 (> $200 approved)
    await assert.rejects(
      async () => {
        await ReturnsService.processCustomerRefund(ret._id.toString(), {
          refundMethod: "cash_refund",
          refundAmount: 250,
        });
      },
      /exceeds approved return amount/i
    );
  });

  test("9. Duplicate refund execution is idempotent (no double payout)", async () => {
    const { order, acc } = setupDeliveredOrder(10, 100);

    const ret = await ReturnsService.createSalesReturnRequest({
      businessId: bId.toString(),
      dealershipId: dId1.toString(),
      orderId: order._id.toString(),
      reason: "Refund idempotency check",
      items: [{ productId: prod1Id.toString(), quantity: 1, unitPrice: 100 }],
    });

    await ReturnsService.inspectSalesReturn(ret._id.toString(), {
      itemClassifications: [{ itemIndex: 0, classification: "GOOD_RESTOCKABLE" }],
    });
    await ReturnsService.approveSalesReturn(ret._id.toString(), { action: "APPROVE" });

    // First refund
    const r1 = await ReturnsService.processCustomerRefund(ret._id.toString(), {
      refundMethod: "credit_note",
      refundAmount: 100,
    });
    assert.strictEqual(r1.status, "CLOSED");
    assert.strictEqual(acc.currentBalance, 900);

    // Second refund attempt on already processed return
    const r2 = await ReturnsService.processCustomerRefund(ret._id.toString(), {
      refundMethod: "credit_note",
      refundAmount: 100,
    });
    assert.strictEqual(r2._id.toString(), r1._id.toString());
    // Balance must not be deducted a second time!
    assert.strictEqual(acc.currentBalance, 900);
  });

  test("10. Purchase return quantity cannot exceed eligible GRN received quantity", async () => {
    const { grn } = setupConfirmedGrn(20, 80);

    // Attempt return of 25 units (> 20 received on GRN)
    await assert.rejects(
      async () => {
        await ReturnsService.createPurchaseReturn({
          businessId: bId.toString(),
          dealershipId: dId1.toString(),
          grnId: grn._id.toString(),
          reason: "Too many units",
          items: [{ productId: prod2Id.toString(), quantity: 25 }],
        });
      },
      /exceeds available received quantity/i
    );
  });

  test("11. Purchase return dispatch strictly rejects insufficient available inventory (no negative stock)", async () => {
    const { grn, bal } = setupConfirmedGrn(20, 80);

    // Drain available quantity in warehouse down to 2
    bal.availableQuantity = 2;
    bal.onHandQuantity = 2;

    const pr = await ReturnsService.createPurchaseReturn({
      businessId: bId.toString(),
      dealershipId: dId1.toString(),
      grnId: grn._id.toString(),
      reason: "Supplier return 5 units",
      items: [{ productId: prod2Id.toString(), quantity: 5 }],
    });

    // Attempt dispatch: need 5, only 2 available
    await assert.rejects(
      async () => {
        await ReturnsService.dispatchPurchaseReturn(pr._id.toString());
      },
      /insufficient available stock/i
    );

    // Stock must not be touched or clamped to zero
    assert.strictEqual(bal.availableQuantity, 2);
    assert.strictEqual(bal.onHandQuantity, 2);
  });

  test("12. Purchase return dispatch removes stock from warehouse and logs purchase_return movement", async () => {
    const { grn, bal } = setupConfirmedGrn(20, 80);
    assert.strictEqual(bal.onHandQuantity, 20);
    assert.strictEqual(bal.availableQuantity, 20);

    const pr = await ReturnsService.createPurchaseReturn({
      businessId: bId.toString(),
      dealershipId: dId1.toString(),
      grnId: grn._id.toString(),
      reason: "Returning 8 defective cans to vendor",
      items: [{ productId: prod2Id.toString(), quantity: 8 }],
    });

    const dispatched = await ReturnsService.dispatchPurchaseReturn(pr._id.toString());
    assert.strictEqual(dispatched.status, "DISPATCHED");

    // Inventory reduced by 8
    assert.strictEqual(bal.onHandQuantity, 12);
    assert.strictEqual(bal.availableQuantity, 12);

    const move = movements.find((m) => m.movementType === "purchase_return");
    assert.ok(move);
    assert.strictEqual(move.quantity, 8);
  });

  test("13. Purchase return settlement adjusts SupplierPayable and Vendor.currentPayable", async () => {
    const { grn, sp, vendor } = setupConfirmedGrn(20, 80);
    assert.strictEqual(sp.remainingAmount, 1600);
    assert.strictEqual(vendor.currentPayable, 1600);

    const pr = await ReturnsService.createPurchaseReturn({
      businessId: bId.toString(),
      dealershipId: dId1.toString(),
      grnId: grn._id.toString(),
      reason: "Returning 5 units",
      items: [{ productId: prod2Id.toString(), quantity: 5 }],
    });
    await ReturnsService.dispatchPurchaseReturn(pr._id.toString());

    // Settle return with 400 credit note (5 * 80)
    const settled = await ReturnsService.settlePurchaseReturn(pr._id.toString(), {
      settledAmount: 400,
      creditNoteNumber: "CN-PETRO-991",
    });

    assert.strictEqual(settled.status, "SETTLED");
    assert.strictEqual(settled.settledAmount, 400);

    // Supplier payable remaining amount reduced by 400
    assert.strictEqual(sp.remainingAmount, 1200);
    // Vendor current payable reduced by 400
    assert.strictEqual(vendor.currentPayable, 1200);
  });

  test("14. Duplicate purchase return settlement is idempotent", async () => {
    const { grn, sp, vendor } = setupConfirmedGrn(20, 80);

    const pr = await ReturnsService.createPurchaseReturn({
      businessId: bId.toString(),
      dealershipId: dId1.toString(),
      grnId: grn._id.toString(),
      reason: "Returning 2 units ($160)",
      items: [{ productId: prod2Id.toString(), quantity: 2 }],
    });
    await ReturnsService.dispatchPurchaseReturn(pr._id.toString());

    // Settle once
    const s1 = await ReturnsService.settlePurchaseReturn(pr._id.toString(), {
      settledAmount: 160,
    });
    assert.strictEqual(s1.status, "SETTLED");
    assert.strictEqual(sp.remainingAmount, 1440);
    assert.strictEqual(vendor.currentPayable, 1440);

    // Settle second time
    const s2 = await ReturnsService.settlePurchaseReturn(pr._id.toString(), {
      settledAmount: 160,
    });
    assert.strictEqual(s2._id.toString(), s1._id.toString());
    // Payable must not be deducted again
    assert.strictEqual(sp.remainingAmount, 1440);
    assert.strictEqual(vendor.currentPayable, 1440);
  });

  test("15. Submitting a claim does not recognize income or receivables", async () => {
    const claim = await ReturnsService.createClaim({
      businessId: bId.toString(),
      dealershipId: dId1.toString(),
      title: "Transit spill during delivery",
      category: "delivery_transit_damage",
      claimedAgainstType: "transporter",
      claimedAmount: 500,
      calculationBasis: "10 broken jugs @ $50 each",
    });

    assert.strictEqual(claim.status, "SUBMITTED");
    assert.strictEqual(claim.claimedAmount, 500);
    assert.strictEqual(claim.approvedAmount, undefined);
    assert.strictEqual(claim.settledAmount, 0);

    // Claim submission does not touch customer ledger or vendor payables
    assert.strictEqual(customerAccounts.length, 0);
    assert.strictEqual(supplierPayables.length, 0);
  });

  test("16. Claim approval and settlement are separate steps; rejected claims mutate nothing", async () => {
    const claim = await ReturnsService.createClaim({
      businessId: bId.toString(),
      dealershipId: dId1.toString(),
      title: "Broken windshield on delivery truck",
      category: "delivery_transit_damage",
      claimedAgainstType: "insurance",
      claimedAmount: 1200,
    });

    // Step A: Approve partially for 1000
    const approved = await ReturnsService.approveClaim(claim._id.toString(), {
      approvedAmount: 1000,
      notes: "Deductible applied $200",
    });
    assert.strictEqual(approved.status, "APPROVED");
    assert.strictEqual(approved.approvedAmount, 1000);
    assert.strictEqual(approved.settledAmount, 0); // Not yet settled

    // Step B: Settle payout of 1000
    const settled = await ReturnsService.settleClaim(claim._id.toString(), {
      settledAmount: 1000,
      notes: "Insurance cheque cleared",
    });
    assert.strictEqual(settled.status, "SETTLED");
    assert.strictEqual(settled.settledAmount, 1000);

    // Test rejection branch
    const rejectedClaim = await ReturnsService.createClaim({
      businessId: bId.toString(),
      dealershipId: dId1.toString(),
      title: "Expired warranty claim",
      category: "principal_reimbursement",
      claimedAgainstType: "principal",
      claimedAmount: 800,
    });

    const rejected = await ReturnsService.rejectClaim(rejectedClaim._id.toString(), {
      rejectionReason: "Warranty period lapsed 60 days ago",
    });
    assert.strictEqual(rejected.status, "REJECTED");
    assert.strictEqual(rejected.settledAmount, 0);
  });

  test("17. Cross-dealership access to sales returns is rejected (403 Forbidden)", async () => {
    const { order } = setupDeliveredOrder(5, 50);

    const ret = await ReturnsService.createSalesReturnRequest({
      businessId: bId.toString(),
      dealershipId: dId1.toString(),
      orderId: order._id.toString(),
      reason: "Dealership 1 return",
      items: [{ productId: prod1Id.toString(), quantity: 1, unitPrice: 50 }],
    });

    // Query with matching dealership -> succeeds
    const found = await ReturnsService.getSalesReturnDetails(ret._id.toString(), dId1.toString());
    assert.ok(found);
    assert.strictEqual(found._id.toString(), ret._id.toString());

    // Query with unauthorized dealership -> 403 Forbidden
    await assert.rejects(
      async () => {
        await ReturnsService.getSalesReturnDetails(ret._id.toString(), dId2.toString());
      },
      /unauthorized access to return in another dealership/i
    );
  });

  test("18. Hardening: Concurrent duplicate customer refund requests are atomic and idempotent (no double deduction)", async () => {
    const { order, acc } = setupDeliveredOrder(10, 100);
    acc.currentBalance = 1000;

    const ret = await ReturnsService.createSalesReturnRequest({
      businessId: bId.toString(),
      dealershipId: dId1.toString(),
      orderId: order._id.toString(),
      reason: "Defective batch",
      items: [{ productId: prod1Id.toString(), quantity: 3, unitPrice: 100 }],
    });

    await ReturnsService.approveSalesReturn(ret._id.toString());

    // Fire 2 concurrent refund calls simultaneously with Promise.all
    const [res1, res2] = await Promise.all([
      ReturnsService.processCustomerRefund(ret._id.toString(), {
        refundMethod: "credit_note",
        refundAmount: 300,
      }),
      ReturnsService.processCustomerRefund(ret._id.toString(), {
        refundMethod: "credit_note",
        refundAmount: 300,
      }),
    ]);

    assert.ok(res1);
    assert.ok(res2);
    // Customer balance must be deducted exactly ONCE (1000 - 300 = 700), never twice (400)
    assert.strictEqual(acc.currentBalance, 700);
    assert.strictEqual(acc.totalReturned, 300);
  });

  test("19. Hardening: Concurrent purchase return dispatch calls prevent double inventory depletion", async () => {
    const { grn, bal } = setupConfirmedGrn(20, 80);
    bal.onHandQuantity = 20;
    bal.availableQuantity = 20;

    const pr = await ReturnsService.createPurchaseReturn({
      businessId: bId.toString(),
      dealershipId: dId1.toString(),
      grnId: grn._id.toString(),
      reason: "Defective goods return",
      items: [{ productId: prod2Id.toString(), quantity: 5 }],
    });

    // Fire 2 concurrent dispatch calls
    const [d1, d2] = await Promise.all([
      ReturnsService.dispatchPurchaseReturn(pr._id.toString()),
      ReturnsService.dispatchPurchaseReturn(pr._id.toString()),
    ]);

    assert.strictEqual(d1.status, "DISPATCHED");
    assert.strictEqual(d2.status, "DISPATCHED");
    // Inventory must be deducted exactly once (20 - 5 = 15), never twice (10)
    assert.strictEqual(bal.onHandQuantity, 15);
    assert.strictEqual(bal.availableQuantity, 15);
  });

  test("20. Hardening: Concurrent supplier credit note settlements prevent double payable deduction", async () => {
    const { grn, sp, vendor } = setupConfirmedGrn(20, 80);
    sp.remainingAmount = 1600;
    sp.outstandingBalance = 1600;
    vendor.currentPayable = 1600;

    const pr = await ReturnsService.createPurchaseReturn({
      businessId: bId.toString(),
      dealershipId: dId1.toString(),
      grnId: grn._id.toString(),
      reason: "Supplier return",
      items: [{ productId: prod2Id.toString(), quantity: 4 }],
    });

    await ReturnsService.dispatchPurchaseReturn(pr._id.toString());

    // Fire 2 concurrent settlements for 320
    const [s1, s2] = await Promise.all([
      ReturnsService.settlePurchaseReturn(pr._id.toString(), {
        settlementType: "payable_deduction",
        settledAmount: 320,
      }),
      ReturnsService.settlePurchaseReturn(pr._id.toString(), {
        settlementType: "payable_deduction",
        settledAmount: 320,
      }),
    ]);

    assert.strictEqual(s1.status, "SETTLED");
    assert.strictEqual(s2.status, "SETTLED");
    // Payable must be deducted exactly once (1600 - 320 = 1280), never twice (960)
    assert.strictEqual(sp.remainingAmount, 1280);
    assert.strictEqual(vendor.currentPayable, 1280);
  });

  test("21. Hardening: Over-settlement exceeding supplier payable balance is strictly rejected", async () => {
    const { grn, sp, vendor } = setupConfirmedGrn(20, 80);
    sp.remainingAmount = 200;
    sp.outstandingBalance = 200;
    vendor.currentPayable = 200;

    const pr = await ReturnsService.createPurchaseReturn({
      businessId: bId.toString(),
      dealershipId: dId1.toString(),
      grnId: grn._id.toString(),
      reason: "Supplier return",
      items: [{ productId: prod2Id.toString(), quantity: 5 }], // 5 * 80 = 400 totalDebitAmount
    });

    await ReturnsService.dispatchPurchaseReturn(pr._id.toString());

    // Settling 400 when outstanding is only 200 must throw error without silent clamping
    await assert.rejects(
      async () => {
        await ReturnsService.settlePurchaseReturn(pr._id.toString(), {
          settlementType: "payable_deduction",
          settledAmount: 400,
        });
      },
      /exceeds supplier payable outstanding balance/i
    );

    // Outstanding balance remains unchanged
    assert.strictEqual(sp.outstandingBalance, 200);
  });

  test("22. Hardening: Negative customer credit balance is preserved on return without Math.max(0) clamping", async () => {
    const { order, acc } = setupDeliveredOrder(10, 100);
    // Customer has a current balance of 100 (owes 100)
    acc.currentBalance = 100;

    const ret = await ReturnsService.createSalesReturnRequest({
      businessId: bId.toString(),
      dealershipId: dId1.toString(),
      orderId: order._id.toString(),
      reason: "Returning 3 units ($300)",
      items: [{ productId: prod1Id.toString(), quantity: 3, unitPrice: 100 }],
    });

    await ReturnsService.approveSalesReturn(ret._id.toString());

    // Process 300 refund: 100 - 300 = -200 (dealership owes customer 200 credit)
    const refunded = await ReturnsService.processCustomerRefund(ret._id.toString(), {
      refundMethod: "credit_note",
      refundAmount: 300,
    });

    assert.strictEqual(refunded.status, "CLOSED");
    assert.strictEqual(refunded.refundStatus, "CREDIT_NOTE_ISSUED");
    // Must NOT be clamped to 0!
    assert.strictEqual(acc.currentBalance, -200);
    assert.strictEqual(acc.totalReturned, 300);
  });

  test("23. Hardening: Cash refund increases totalReturned without double-crediting customer AR balance", async () => {
    const { order, acc } = setupDeliveredOrder(10, 100);
    acc.currentBalance = 800; // Customer owes 800

    const ret = await ReturnsService.createSalesReturnRequest({
      businessId: bId.toString(),
      dealershipId: dId1.toString(),
      orderId: order._id.toString(),
      reason: "Returning 2 units for cash payout",
      items: [{ productId: prod1Id.toString(), quantity: 2, unitPrice: 100 }],
    });

    await ReturnsService.approveSalesReturn(ret._id.toString());

    // Refund method = "cash"
    const refunded = await ReturnsService.processCustomerRefund(ret._id.toString(), {
      refundMethod: "cash",
      refundAmount: 200,
    });

    assert.strictEqual(refunded.status, "CLOSED");
    assert.strictEqual(refunded.refundStatus, "REFUNDED");
    // Customer AR balance must remain 800 (cash was paid directly at counter, AR unaffected)
    assert.strictEqual(acc.currentBalance, 800);
    // Total returned increases by 200
    assert.strictEqual(acc.totalReturned, 200);
  });

  test("24. Hardening: Batch traceability in StockMovement on return restock and return dispatch", async () => {
    const { order } = setupDeliveredOrder(10, 100);

    const ret = await ReturnsService.createSalesReturnRequest({
      businessId: bId.toString(),
      dealershipId: dId1.toString(),
      orderId: order._id.toString(),
      reason: "Batch return",
      items: [
        {
          productId: prod1Id.toString(),
          quantity: 2,
          unitPrice: 100,
        },
      ],
    });

    // Tag item with batch info for traceability test
    ret.items[0].batchNumber = "BATCH-2026-X1";

    await ReturnsService.approveSalesReturn(ret._id.toString());

    const move = movements.find((m) => m.referenceId === ret.returnNumber);
    assert.ok(move);
    assert.strictEqual(move.batchNumber, "BATCH-2026-X1");
  });

  test("25. Hardening: Partial supplier return and partial credit-note settlement workflow", async () => {
    const { grn, sp, vendor, bal } = setupConfirmedGrn(20, 80);
    bal.onHandQuantity = 20;
    bal.availableQuantity = 20;
    sp.remainingAmount = 1600;
    sp.outstandingBalance = 1600;
    vendor.currentPayable = 1600;

    // Return 3 out of 20
    const pr = await ReturnsService.createPurchaseReturn({
      businessId: bId.toString(),
      dealershipId: dId1.toString(),
      grnId: grn._id.toString(),
      reason: "Partial return 3 units",
      items: [{ productId: prod2Id.toString(), quantity: 3 }],
    });

    await ReturnsService.dispatchPurchaseReturn(pr._id.toString());
    assert.strictEqual(bal.availableQuantity, 17);

    // Settle partial debit amount: 3 * 80 = 240
    await ReturnsService.settlePurchaseReturn(pr._id.toString(), {
      settlementType: "payable_deduction",
      settledAmount: 240,
      creditNoteNumber: "CN-PARTIAL-01",
    });

    assert.strictEqual(sp.remainingAmount, 1360);
    assert.strictEqual(sp.status, "PARTIALLY_PAID");
    assert.strictEqual(vendor.currentPayable, 1360);
  });

  test("26. Hardening: Multi-line stock sufficiency check aborts without partial inventory deduction", async () => {
    const { grn, bal } = setupConfirmedGrn(20, 80);
    bal.onHandQuantity = 20;
    bal.availableQuantity = 20;

    // Second product has 0 available inventory
    const bal2 = {
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      dealershipId: dId1,
      warehouseId: wId,
      productId: prod1Id,
      onHandQuantity: 0,
      availableQuantity: 0,
      save: async function () {
        const i = balances.findIndex((b) => String(b._id) === String(this._id));
        if (i >= 0) balances[i] = this;
        return this;
      },
    };
    balances.push(bal2);

    // Add second item to grn
    grn.items.push({
      productId: prod1Id,
      variantId: prod1Id,
      productName: "Secondary Item",
      receivedQuantity: 10,
      unitPurchasePrice: 50,
      netLandedUnitCost: 50,
    });

    const pr = await ReturnsService.createPurchaseReturn({
      businessId: bId.toString(),
      dealershipId: dId1.toString(),
      grnId: grn._id.toString(),
      reason: "Multi-line return",
      items: [
        { productId: prod2Id.toString(), quantity: 5 },
        { productId: prod1Id.toString(), quantity: 5 }, // will fail because bal2.availableQuantity is 0
      ],
    });

    await assert.rejects(
      async () => {
        await ReturnsService.dispatchPurchaseReturn(pr._id.toString());
      },
      /insufficient available stock/i
    );

    // Status remains SUBMITTED (not DISPATCHED)
    assert.strictEqual(pr.status, "SUBMITTED");
  });
});
