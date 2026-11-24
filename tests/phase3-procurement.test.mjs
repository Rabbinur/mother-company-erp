import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

// Models
import { Vendor } from "../src/models/Vendor.ts";
import { Warehouse } from "../src/models/Warehouse.ts";
import { Purchase } from "../src/models/Purchase.ts";
import { GoodsReceiptNote } from "../src/models/GoodsReceiptNote.ts";
import { SupplierPayable } from "../src/models/SupplierPayable.ts";
import { Payment } from "../src/models/Payment.ts";
import { Product } from "../src/models/Product.ts";
import { ProductVariant } from "../src/models/ProductVariant.ts";
import { InventoryBalance } from "../src/models/InventoryBalance.ts";
import { StockBatch } from "../src/models/StockBatch.ts";
import { StockMovement } from "../src/models/StockMovement.ts";
import { AuditLog } from "../src/models/AuditLog.ts";

// Services
import { SupplierService } from "../src/services/SupplierService.ts";
import { PurchaseOrderService } from "../src/services/PurchaseOrderService.ts";
import { GoodsReceiptNoteService } from "../src/services/GoodsReceiptNoteService.ts";
import { SupplierPaymentService } from "../src/services/SupplierPaymentService.ts";
import { ProcurementReportService } from "../src/services/ProcurementReportService.ts";
import { canUserViewPurchaseCost } from "../src/lib/grn/cost-masking.ts";

describe("Phase 3 - Step 4: Procurement & Purchase Management Test Suite", () => {
  let vendors = [];
  let purchases = [];
  let grns = [];
  let payables = [];
  let payments = [];
  let balances = [];
  let batches = [];
  let movements = [];
  let auditLogs = [];

  const bId = new mongoose.Types.ObjectId();
  const dId = new mongoose.Types.ObjectId();
  const pcId = new mongoose.Types.ObjectId();
  const wId = new mongoose.Types.ObjectId();
  const uId = new mongoose.Types.ObjectId();
  const prodId = new mongoose.Types.ObjectId();
  const varId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    vendors = [];
    purchases = [];
    grns = [];
    payables = [];
    payments = [];
    balances = [];
    batches = [];
    movements = [];
    auditLogs = [];

    // Mock Vendor / Supplier
    Vendor.create = async (doc) => {
      const created = {
        _id: new mongoose.Types.ObjectId(),
        currentPayable: 0,
        status: "active",
        ...doc,
        save: async function () {
          const idx = vendors.findIndex((v) => String(v._id) === String(this._id));
          if (idx >= 0) vendors[idx] = this;
          return this;
        },
      };
      vendors.push(created);
      return created;
    };

    Vendor.find = (query = {}) => {
      let filtered = [...vendors];
      if (query.businessId) {
        filtered = filtered.filter((v) => String(v.businessId) === String(query.businessId));
      }
      return {
        sort: () => ({
          lean: async () => filtered,
        }),
        lean: async () => filtered,
      };
    };

    Vendor.findOne = (query) => {
      const v = vendors.find((x) => {
        if (query.businessId && String(x.businessId) !== String(query.businessId)) return false;
        if (query.code && x.code !== query.code) return false;
        return true;
      });
      return {
        lean: async () => v || null,
        then: (resolve, reject) => Promise.resolve(v || null).then(resolve, reject),
      };
    };

    Vendor.findById = (id) => {
      const v = vendors.find((x) => String(x._id) === String(id));
      const chainable = {
        session: () => chainable,
        lean: async () => v || null,
        then: (resolve, reject) => Promise.resolve(v || null).then(resolve, reject),
      };
      return chainable;
    };

    Vendor.findByIdAndUpdate = async (id, update) => {
      const v = vendors.find((x) => String(x._id) === String(id));
      if (!v) return null;
      if (update.$inc && update.$inc.currentPayable) {
        v.currentPayable = (v.currentPayable || 0) + update.$inc.currentPayable;
      }
      if (update.$set) {
        Object.assign(v, update.$set);
      }
      return v;
    };

    // Mock Warehouse
    Warehouse.findById = (id) => {
      const w = { _id: id, name: "Central Warehouse", status: "active" };
      const chainable = {
        session: () => chainable,
        lean: async () => w,
        then: (resolve, reject) => Promise.resolve(w).then(resolve, reject),
      };
      return chainable;
    };

    Warehouse.findOne = (query) => {
      const w = { _id: new mongoose.Types.ObjectId(), name: "Central Warehouse", status: "active" };
      const chainable = {
        session: () => chainable,
        lean: async () => w,
        then: (resolve, reject) => Promise.resolve(w).then(resolve, reject),
      };
      return chainable;
    };

    // Mock Product & ProductVariant
    Product.findById = (id) => {
      const p = { _id: id, name: "Fresh Sugar", sku: "SUGAR-1KG" };
      const chainable = {
        session: () => chainable,
        lean: async () => p,
        then: (resolve, reject) => Promise.resolve(p).then(resolve, reject),
      };
      return chainable;
    };

    ProductVariant.findById = (id) => {
      const pv = { _id: id, productId: prodId, variantName: "1kg", sku: "SUGAR-1KG" };
      const chainable = {
        session: () => chainable,
        lean: async () => pv,
        then: (resolve, reject) => Promise.resolve(pv).then(resolve, reject),
      };
      return chainable;
    };

    ProductVariant.findOne = (query) => {
      const pv = { _id: varId, productId: prodId, variantName: "1kg", sku: "SUGAR-1KG" };
      const chainable = {
        session: () => chainable,
        lean: async () => pv,
        then: (resolve, reject) => Promise.resolve(pv).then(resolve, reject),
      };
      return chainable;
    };

    // Mock Purchase / PurchaseOrder
    Purchase.create = async (doc) => {
      const created = {
        _id: new mongoose.Types.ObjectId(),
        status: "DRAFT",
        grnIds: [],
        ...doc,
        save: async function () {
          const idx = purchases.findIndex((p) => String(p._id) === String(this._id));
          if (idx >= 0) purchases[idx] = this;
          return this;
        },
      };
      purchases.push(created);
      return created;
    };

    Purchase.findById = (id) => {
      const p = purchases.find((x) => String(x._id) === String(id));
      const chainable = {
        session: () => chainable,
        populate: () => chainable,
        lean: async () => p || null,
        then: (resolve, reject) => Promise.resolve(p || null).then(resolve, reject),
      };
      return chainable;
    };

    Purchase.find = (query = {}) => {
      let filtered = [...purchases];
      if (query.businessId) {
        filtered = filtered.filter((p) => String(p.businessId) === String(query.businessId));
      }
      return {
        populate: () => ({
          sort: () => ({
            lean: async () => filtered,
          }),
        }),
        sort: () => ({
          lean: async () => filtered,
        }),
        lean: async () => filtered,
      };
    };

    Purchase.findOneAndUpdate = async (query, update) => {
      const p = purchases.find((x) => String(x._id) === String(query._id));
      if (!p) return null;
      if (update.$set) Object.assign(p, update.$set);
      return p;
    };

    // Mock GoodsReceiptNote
    GoodsReceiptNote.create = async (doc) => {
      const created = {
        isCancelled: false,
        _id: new mongoose.Types.ObjectId(),
        ...doc,
        save: async function () {
          const idx = grns.findIndex((g) => String(g._id) === String(this._id));
          if (idx >= 0) grns[idx] = this;
          return this;
        },
      };
      grns.push(created);
      return created;
    };

    GoodsReceiptNote.findById = (id) => {
      const g = grns.find((x) => String(x._id) === String(id));
      const chainable = {
        session: () => chainable,
        then: (resolve, reject) => Promise.resolve(g || null).then(resolve, reject),
      };
      return chainable;
    };

    GoodsReceiptNote.find = (query = {}) => {
      let filtered = [...grns];
      if (query.businessId) {
        filtered = filtered.filter((g) => String(g.businessId) === String(query.businessId));
      }
      return {
        lean: async () => filtered,
      };
    };

    GoodsReceiptNote.findOne = async (query) => {
      return grns.find((x) => {
        if (query.businessId && String(x.businessId) !== String(query.businessId)) return false;
        if (query.challanNumber && x.challanNumber === query.challanNumber) return true;
        return true;
      }) || null;
    };

    GoodsReceiptNote.findOneAndUpdate = async (query, update) => {
      const g = grns.find((x) => String(x._id) === String(query._id));
      if (!g) return null;
      if (update.$set) Object.assign(g, update.$set);
      return g;
    };

    // Mock SupplierPayable
    SupplierPayable.create = async (docs) => {
      const arr = Array.isArray(docs) ? docs : [docs];
      const created = arr.map((d) => ({
        _id: new mongoose.Types.ObjectId(),
        paidAmount: 0,
        status: "UNPAID",
        isCancelled: false,
        ...d,
        save: async function () {
          const idx = payables.findIndex((p) => String(p._id) === String(this._id));
          if (idx >= 0) payables[idx] = this;
          return this;
        },
      }));
      payables.push(...created);
      return created;
    };

    SupplierPayable.findOne = (query) => {
      const p = payables.find((x) => {
        if (query.businessId && String(x.businessId) !== String(query.businessId)) return false;
        if (query.grnId && String(x.grnId) !== String(query.grnId)) return false;
        if (query.isCancelled !== undefined && x.isCancelled !== query.isCancelled) return false;
        return true;
      });
      const chainable = {
        session: () => chainable,
        then: (resolve, reject) => Promise.resolve(p || null).then(resolve, reject),
      };
      return chainable;
    };

    SupplierPayable.findById = (id) => {
      const p = payables.find((x) => String(x._id) === String(id));
      const chainable = {
        session: () => chainable,
        then: (resolve, reject) => Promise.resolve(p || null).then(resolve, reject),
      };
      return chainable;
    };

    SupplierPayable.find = (query = {}) => {
      let filtered = [...payables];
      if (query.businessId) {
        filtered = filtered.filter((p) => String(p.businessId) === String(query.businessId));
      }
      return {
        populate: () => ({
          sort: () => ({
            lean: async () => filtered,
          }),
        }),
        sort: () => ({
          lean: async () => filtered,
        }),
        lean: async () => filtered,
      };
    };

    // Mock Payment
    Payment.create = async (docs) => {
      const arr = Array.isArray(docs) ? docs : [docs];
      const created = arr.map((d) => ({
        _id: new mongoose.Types.ObjectId(),
        ...d,
      }));
      payments.push(...created);
      return created;
    };

    Payment.findOne = (query) => {
      const p = payments.find((x) => {
        if (query.idempotencyKey && x.idempotencyKey === query.idempotencyKey) return true;
        return false;
      });
      const chainable = {
        session: () => chainable,
        then: (resolve, reject) => Promise.resolve(p || null).then(resolve, reject),
      };
      return chainable;
    };

    // Mock InventoryBalance
    InventoryBalance.findOne = (query) => {
      const b = balances.find((x) => {
        if (query.businessId && String(x.businessId) !== String(query.businessId)) return false;
        if (query.dealershipId && String(x.dealershipId) !== String(query.dealershipId)) return false;
        if (query.warehouseId && String(x.warehouseId) !== String(query.warehouseId)) return false;
        if (query.productId && String(x.productId) !== String(query.productId)) return false;
        return true;
      });
      const chainable = {
        session: () => chainable,
        then: (resolve, reject) => Promise.resolve(b || null).then(resolve, reject),
      };
      return chainable;
    };

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

    // Mock StockMovement
    StockMovement.create = async (docs) => {
      const created = docs.map((d) => ({
        ...d,
        _id: new mongoose.Types.ObjectId(),
      }));
      movements.push(...created);
      return created;
    };

    // Mock AuditLog
    AuditLog.create = async (doc) => {
      auditLogs.push(doc);
      return doc;
    };
  });

  describe("1. Supplier Management (Extended Vendor)", () => {
    test("Creates supplier with payment terms and code", async () => {
      const supplier = await SupplierService.createSupplier({
        businessId: bId,
        name: "Abul Kashem",
        companyName: "Meghna Group of Industries",
        code: "SUP-MGI-01",
        paymentTerms: "net_30",
        actorId: uId,
      });

      assert.ok(supplier._id);
      assert.equal(supplier.code, "SUP-MGI-01");
      assert.equal(supplier.paymentTerms, "net_30");
      assert.equal(vendors.length, 1);
    });

    test("Rejects duplicate supplier code within the same business", async () => {
      await SupplierService.createSupplier({
        businessId: bId,
        name: "Supplier A",
        code: "SUP-DUP-01",
        actorId: uId,
      });

      await assert.rejects(
        async () => {
          await SupplierService.createSupplier({
            businessId: bId,
            name: "Supplier B",
            code: "SUP-DUP-01",
            actorId: uId,
          });
        },
        {
          message: "Supplier code 'SUP-DUP-01' already exists for this business",
        }
      );
    });

    test("Supports custom credit period days", async () => {
      const supplier = await SupplierService.createSupplier({
        businessId: bId,
        name: "Rahim Traders",
        code: "SUP-RT-01",
        paymentTerms: "custom",
        customPaymentTermsDays: 45,
        actorId: uId,
      });

      assert.equal(supplier.paymentTerms, "custom");
      assert.equal(supplier.customPaymentTermsDays, 45);
    });
  });

  describe("2. Purchase Order Engine & Inventory Invariance", () => {
    test("Creates Purchase Order in DRAFT status with initial remainingQuantity equal to ordered quantity", async () => {
      const po = await PurchaseOrderService.createPurchaseOrder({
        businessId: bId,
        dealershipId: dId,
        supplierId: new mongoose.Types.ObjectId(),
        items: [
          {
            productId: prodId,
            variantId: varId,
            name: "Fresh Refined Sugar 1kg Pack",
            quantity: 100,
            unitPrice: 120,
          },
        ],
        actorId: uId,
      });

      assert.ok(po._id);
      assert.equal(po.status, "DRAFT");
      assert.equal(po.items.length, 1);
      assert.equal(po.items[0].quantity, 100);
      assert.equal(po.items[0].remainingQuantity, 100);
      assert.equal(po.totalAmount, 12000);
    });

    test("INVARIANT: Creating and submitting a PO NEVER mutates inventory balances or creates stock batches", async () => {
      const po = await PurchaseOrderService.createPurchaseOrder({
        businessId: bId,
        dealershipId: dId,
        supplierId: new mongoose.Types.ObjectId(),
        items: [
          {
            productId: prodId,
            variantId: varId,
            name: "Fresh Refined Sugar 1kg Pack",
            quantity: 500,
            unitPrice: 120,
          },
        ],
        actorId: uId,
      });

      // Submit PO
      const submitted = await PurchaseOrderService.submitPurchaseOrder(po._id, uId);
      assert.equal(submitted.status, "SUBMITTED");

      // Verify ZERO inventory mutations
      assert.equal(balances.length, 0, "No inventory balances should be created or changed by PO");
      assert.equal(batches.length, 0, "No stock batches should be created by PO");
      assert.equal(movements.length, 0, "No stock movements should be logged by PO");
    });

    test("Allows cancellation of a DRAFT or SUBMITTED purchase order", async () => {
      const po = await PurchaseOrderService.createPurchaseOrder({
        businessId: bId,
        dealershipId: dId,
        supplierId: new mongoose.Types.ObjectId(),
        items: [
          {
            productId: prodId,
            name: "Wheat Flour 2kg",
            quantity: 50,
            unitPrice: 140,
          },
        ],
        actorId: uId,
      });

      const cancelled = await PurchaseOrderService.cancelPurchaseOrder(po._id, "Supplier out of stock", uId);
      assert.equal(cancelled.status, "CANCELLED");
    });
  });

  describe("3. Partial Receiving & GRN Linking", () => {
    test("Tracks partial receipts against PO and transitions status from PARTIALLY_RECEIVED to FULLY_RECEIVED", async () => {
      const supId = new mongoose.Types.ObjectId();
      const po = await PurchaseOrderService.createPurchaseOrder({
        businessId: bId,
        dealershipId: dId,
        supplierId: supId,
        items: [
          {
            productId: prodId,
            variantId: varId,
            name: "Fresh Refined Sugar 1kg Pack",
            quantity: 100,
            unitPrice: 120,
          },
        ],
        actorId: uId,
      });
      await PurchaseOrderService.submitPurchaseOrder(po._id, uId);

      // 1. Partial GRN receipt: 60 units received
      const grn1Id = new mongoose.Types.ObjectId();
      const updatedPo1 = await PurchaseOrderService.recordGrnReceipt({
        poId: po._id,
        grnId: grn1Id,
        receivedItems: [
          {
            productId: prodId,
            variantId: varId,
            receivedQuantity: 60,
          },
        ],
      });

      assert.equal(updatedPo1.status, "PARTIALLY_RECEIVED");
      assert.equal(updatedPo1.items[0].remainingQuantity, 40);
      assert.ok(updatedPo1.grnIds.some((id) => String(id) === String(grn1Id)));

      // 2. Final GRN receipt: remaining 40 units received
      const grn2Id = new mongoose.Types.ObjectId();
      const updatedPo2 = await PurchaseOrderService.recordGrnReceipt({
        poId: po._id,
        grnId: grn2Id,
        receivedItems: [
          {
            productId: prodId,
            variantId: varId,
            receivedQuantity: 40,
          },
        ],
      });

      assert.equal(updatedPo2.status, "FULLY_RECEIVED");
      assert.equal(updatedPo2.items[0].remainingQuantity, 0);
      assert.equal(updatedPo2.grnIds.length, 2);
    });
  });

  describe("4. Supplier Payable & Payment Tracking", () => {
    test("GRN confirmation creates SupplierPayable and increments vendor currentPayable", async () => {
      const sup = await SupplierService.createSupplier({
        businessId: bId,
        name: "Square Dist",
        companyName: "Square Ltd",
        actorId: uId,
      });

      const grn = await GoodsReceiptNoteService.createGrn({
        businessId: bId,
        dealershipId: dId,
        warehouseId: wId,
        supplierId: sup._id,
        challanNumber: "CH-PAY-01",
        challanDate: "2026-11-24",
        invoiceNumber: "INV-9901",
        items: [
          {
            productName: "Fresh Refined Sugar 1kg Pack",
            sku: "SUGAR-1KG",
            challanQuantity: 10,
            receivedQuantity: 10,
            unitPurchasePrice: 100,
          },
        ],
        actorId: uId,
      });

      await GoodsReceiptNoteService.confirmGrn({
        grnId: grn._id,
        actorId: uId,
      });

      assert.equal(payables.length, 1);
      const payable = payables[0];
      assert.equal(payable.netPayable, 1000);
      assert.equal(payable.outstandingBalance, 1000);
      assert.equal(payable.status, "UNPAID");

      // Verify vendor's currentPayable balance incremented
      assert.equal(sup.currentPayable, 1000);
    });

    test("Records partial supplier payment and updates payable status to PARTIALLY_PAID", async () => {
      const supId = new mongoose.Types.ObjectId();
      vendors.push({
        _id: supId,
        name: "Test Sup",
        currentPayable: 1000,
        status: "active",
      });

      const [payable] = await SupplierPayable.create([
        {
          businessId: bId,
          dealershipId: dId,
          supplierId: supId,
          payableNumber: "PAY-1001",
          invoiceNumber: "INV-1001",
          netPayable: 1000,
          paidAmount: 0,
          outstandingBalance: 1000,
          status: "UNPAID",
        },
      ]);

      const result = await SupplierPaymentService.recordPayment({
        businessId: bId,
        payableId: payable._id,
        amount: 400,
        paymentMethod: "bank_transfer",
        actorId: uId,
      });

      assert.equal(result.payable.paidAmount, 400);
      assert.equal(result.payable.outstandingBalance, 600);
      assert.equal(result.payable.status, "PARTIALLY_PAID");

      // Vendor current payable decreased by 400
      const updatedSup = vendors.find((v) => String(v._id) === String(supId));
      assert.equal(updatedSup.currentPayable, 600);
    });

    test("Prompt payment applies earned cash discount and fully settles liability without cash outflow for discount", async () => {
      const supId = new mongoose.Types.ObjectId();
      vendors.push({
        _id: supId,
        name: "Test Sup 2",
        currentPayable: 1000,
        status: "active",
      });

      const [payable] = await SupplierPayable.create([
        {
          businessId: bId,
          dealershipId: dId,
          supplierId: supId,
          payableNumber: "PAY-1002",
          invoiceNumber: "INV-1002",
          netPayable: 1000,
          paidAmount: 0,
          outstandingBalance: 1000,
          status: "UNPAID",
        },
      ]);

      // Paid 950 cash + 50 cash discount earned
      const result = await SupplierPaymentService.recordPayment({
        businessId: bId,
        payableId: payable._id,
        amount: 950,
        cashDiscountEarned: 50,
        paymentMethod: "bank_transfer",
        actorId: uId,
      });

      assert.equal(result.payable.paidAmount, 950);
      assert.equal(result.payable.outstandingBalance, 0);
      assert.equal(result.payable.status, "PAID");

      // Vendor current payable fully cleared (1000 total deduction: 950 paid + 50 discount)
      const updatedSup = vendors.find((v) => String(v._id) === String(supId));
      assert.equal(updatedSup.currentPayable, 0);
    });

    test("Rejects payment amount exceeding outstanding balance", async () => {
      const [payable] = await SupplierPayable.create([
        {
          businessId: bId,
          supplierId: new mongoose.Types.ObjectId(),
          payableNumber: "PAY-1003",
          invoiceNumber: "INV-1003",
          netPayable: 500,
          paidAmount: 0,
          outstandingBalance: 500,
          status: "UNPAID",
        },
      ]);

      await assert.rejects(
        async () => {
          await SupplierPaymentService.recordPayment({
            businessId: bId,
            payableId: payable._id,
            amount: 600, // Exceeds 500
            paymentMethod: "cash",
            actorId: uId,
          });
        },
        {
          message: "Payment total (600) exceeds outstanding balance (500)",
        }
      );
    });

    test("Payment idempotency: duplicate payment call returns cached payment without double-decrementing", async () => {
      const supId = new mongoose.Types.ObjectId();
      vendors.push({
        _id: supId,
        name: "Test Sup 3",
        currentPayable: 1000,
        status: "active",
      });

      const [payable] = await SupplierPayable.create([
        {
          businessId: bId,
          supplierId: supId,
          payableNumber: "PAY-1004",
          invoiceNumber: "INV-1004",
          netPayable: 1000,
          paidAmount: 0,
          outstandingBalance: 1000,
          status: "UNPAID",
        },
      ]);

      const key = "idemp_pay_test_001";

      const res1 = await SupplierPaymentService.recordPayment({
        businessId: bId,
        payableId: payable._id,
        amount: 300,
        idempotencyKey: key,
        actorId: uId,
      });

      const res2 = await SupplierPaymentService.recordPayment({
        businessId: bId,
        payableId: payable._id,
        amount: 300,
        idempotencyKey: key,
        actorId: uId,
      });

      assert.equal(payments.length, 1, "Duplicate payment must NOT be recorded");
      assert.equal(res2.payable.outstandingBalance, 700, "Outstanding balance must NOT decrease twice");
    });
  });

  describe("5. Cost Confidentiality & History Reporting", () => {
    test("Role-based cost check permits cost viewing for owner, purchase manager, accountant", () => {
      assert.equal(canUserViewPurchaseCost({ role: "owner" }), true);
      assert.equal(canUserViewPurchaseCost({ role: "purchase_manager" }), true);
      assert.equal(canUserViewPurchaseCost({ role: "accountant" }), true);
      assert.equal(canUserViewPurchaseCost({ role: "sales_rep" }), false);
      assert.equal(canUserViewPurchaseCost({ role: "sales_manager" }), false);
    });

    test("Aggregated procurement report correctly masks financial values when canViewCost is false", async () => {
      grns.push({
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        dealershipId: dId,
        supplierId: new mongoose.Types.ObjectId(),
        isCancelled: false,
        items: [
          {
            productName: "Refined Sugar",
            challanQuantity: 100,
            receivedQuantity: 95,
            shortageQuantity: 5,
            damagedQuantity: 0,
            lineTotal: 9500,
          },
        ],
      });

      // Masked view
      const reportMasked = await ProcurementReportService.getHistoryReport({ businessId: bId }, false);
      assert.equal(reportMasked.totals.totalChallanQuantity, 100);
      assert.equal(reportMasked.totals.totalReceivedQuantity, 95);
      assert.equal(reportMasked.totals.totalShortageQuantity, 5);
      assert.equal(reportMasked.totals.totalPurchasedValue, null, "Total value must be masked");
      assert.equal(reportMasked.totals.totalOutstandingBalance, null, "Outstanding balance must be masked");

      // Authorized view
      const reportAuthorized = await ProcurementReportService.getHistoryReport({ businessId: bId }, true);
      assert.equal(reportAuthorized.totals.totalPurchasedValue, 9500);
    });
  });
});
