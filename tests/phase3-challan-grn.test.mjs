import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

// Models
import { GoodsReceiptNote } from "../src/models/GoodsReceiptNote.ts";
import { Vendor } from "../src/models/Vendor.ts";
import { Warehouse } from "../src/models/Warehouse.ts";
import { Product } from "../src/models/Product.ts";
import { ProductVariant } from "../src/models/ProductVariant.ts";
import { InventoryBalance } from "../src/models/InventoryBalance.ts";
import { StockBatch } from "../src/models/StockBatch.ts";
import { StockMovement } from "../src/models/StockMovement.ts";
import { AuditLog } from "../src/models/AuditLog.ts";

// Services & Utilities
import { GoodsReceiptNoteService } from "../src/services/GoodsReceiptNoteService.ts";
import { ProductMatcherService } from "../src/services/ProductMatcherService.ts";
import { GrnCostAllocationService } from "../src/services/GrnCostAllocationService.ts";
import { OcrService } from "../src/lib/ocr/OcrService.ts";
import { MockOcrProvider } from "../src/lib/ocr/MockOcrProvider.ts";
import { UnconfiguredOcrProvider } from "../src/lib/ocr/UnconfiguredOcrProvider.ts";
import { RegexChallanParser } from "../src/lib/ocr/RegexChallanParser.ts";
import { canUserViewPurchaseCost, maskGrnCosts } from "../src/lib/grn/cost-masking.ts";

describe("Phase 3: Printed Challan OCR + Purchase GRN Workflow", () => {
  let grns = [];
  let vendors = [];
  let warehouses = [];
  let products = [];
  let variants = [];
  let balances = [];
  let batches = [];
  let movements = [];
  let auditLogs = [];

  const bId = new mongoose.Types.ObjectId();
  const d1Id = new mongoose.Types.ObjectId(); // Dealership 1
  const d2Id = new mongoose.Types.ObjectId(); // Dealership 2
  const wId = new mongoose.Types.ObjectId();  // Shared Central Warehouse
  const sId = new mongoose.Types.ObjectId();  // Supplier (Vendor)
  const uId = new mongoose.Types.ObjectId();  // User / Actor

  const prod1Id = new mongoose.Types.ObjectId();
  const var1Id = new mongoose.Types.ObjectId();

  beforeEach(() => {
    grns = [];
    vendors = [
      {
        _id: sId,
        name: "Rahman Khan",
        companyName: "Square Consumer Goods Ltd",
        phone: "01711000000",
        status: "active",
      },
    ];
    warehouses = [
      {
        _id: wId,
        name: "Central Distribution Depot",
        code: "CDD-01",
      },
    ];
    products = [
      {
        _id: prod1Id,
        businessId: bId,
        name: "Fresh Refined Sugar 1kg Pack",
        sku: "SUGAR-REF-1KG",
        barcode: "894110011001",
        unit: "kg",
        status: "active",
      },
    ];
    variants = [
      {
        _id: var1Id,
        businessId: bId,
        productId: prod1Id,
        variantName: "1kg Standard Pack",
        sku: "SUGAR-REF-1KG-STD",
        barcode: "894110011001",
        purchasePrice: 120, // Baseline purchase price in catalog
        customerPrice: 135,
        retailPrice: 140,
        status: "active",
      },
    ];
    balances = [];
    batches = [];
    movements = [];
    auditLogs = [];

    // Reset OCR Provider
    OcrService.setProvider(new UnconfiguredOcrProvider());

    // Mock Mongoose models
    Vendor.findById = async (id) => vendors.find((v) => String(v._id) === String(id)) || null;
    Warehouse.findById = async (id) => warehouses.find((w) => String(w._id) === String(id)) || null;

    Product.findById = (id) => {
      const p = products.find((x) => String(x._id) === String(id)) || null;
      return {
        lean: async () => p,
        then: (resolve, reject) => Promise.resolve(p).then(resolve, reject),
      };
    };
    Product.findOne = (query) => {
      const p = products.find((x) => {
        if (query.barcode && x.barcode !== query.barcode) return false;
        if (query.sku && x.sku !== query.sku) return false;
        if (query.$or) {
          const matchOr = query.$or.some((o) => (o.sku && x.sku === o.sku) || (o.code && x.code === o.code));
          if (!matchOr) return false;
        }
        if (query.name && query.name.$regex) {
          if (!query.name.$regex.test(x.name)) return false;
        }
        return true;
      });
      return { lean: async () => p || null };
    };
    Product.find = (query) => {
      let filtered = products;
      if (query.name && query.name.$in) {
        filtered = products.filter((p) => query.name.$in.some((regex) => regex.test(p.name)));
      }
      return {
        limit: () => ({
          lean: async () => filtered,
        }),
      };
    };

    ProductVariant.findById = async (id) => variants.find((v) => String(v._id) === String(id)) || null;
    ProductVariant.findOne = (query) => {
      const v = variants.find((x) => {
        if (query.barcode && x.barcode !== query.barcode) return false;
        if (query.sku && x.sku !== query.sku) return false;
        if (query.productId && String(x.productId) !== String(query.productId)) return false;
        return true;
      });
      return { lean: async () => v || null };
    };
    ProductVariant.find = (query) => {
      let filtered = variants;
      if (query.productId) {
        filtered = variants.filter((v) => String(v.productId) === String(query.productId));
      }
      return { lean: async () => filtered };
    };

    // Mock GoodsReceiptNote
    GoodsReceiptNote.create = async (doc) => {
      const created = {
        ...doc,
        _id: new mongoose.Types.ObjectId(),
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

    GoodsReceiptNote.findOne = async (query) => {
      return grns.find((x) => {
        if (query.businessId && String(x.businessId) !== String(query.businessId)) return false;
        if (query.supplierId && String(x.supplierId) !== String(query.supplierId)) return false;
        if (query.challanNumber && x.challanNumber.toLowerCase() !== query.challanNumber.toLowerCase()) return false;
        if (query.status && query.status.$ne && x.status === query.status.$ne) return false;
        return true;
      }) || null;
    };

    GoodsReceiptNote.findOneAndUpdate = async (query, update) => {
      const g = grns.find((x) => {
        if (query._id && String(x._id) !== String(query._id)) return false;
        if (query.status) {
          if (Array.isArray(query.status.$in) && !query.status.$in.includes(x.status)) return false;
          if (typeof query.status === "string" && x.status !== query.status) return false;
        }
        return true;
      });

      if (!g) return null;
      if (update.$set) {
        Object.assign(g, update.$set);
      }
      return g;
    };

    // Mock InventoryBalance
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

  describe("1. Manual Challan Entry & Duplicate Challan Prevention", () => {
    test("Successfully creates GRN via Manual Entry (P0 primary workflow)", async () => {
      const grn = await GoodsReceiptNoteService.createGrn({
        businessId: bId,
        dealershipId: d1Id,
        warehouseId: wId,
        supplierId: sId,
        challanNumber: "CH-2026-001",
        challanDate: "2026-11-24",
        invoiceNumber: "INV-5501",
        items: [
          {
            productName: "Fresh Refined Sugar 1kg Pack",
            sku: "SUGAR-REF-1KG-STD",
            challanQuantity: 100,
            unitPurchasePrice: 120,
            lineDiscount: 200,
          },
        ],
        actorId: uId,
      });

      assert.ok(grn._id);
      assert.equal(grn.status, "NEEDS_REVIEW");
      assert.equal(grn.challanNumber, "CH-2026-001");
      assert.equal(grn.items.length, 1);
      assert.equal(grn.items[0].matchStatus, "matched");
      assert.equal(String(grn.items[0].productId), String(prod1Id));
      assert.equal(grn.grossTotal, 12000);
      assert.equal(grn.totalLineDiscount, 200);
    });

    test("Rejects duplicate supplier challan within the same business", async () => {
      await GoodsReceiptNoteService.createGrn({
        businessId: bId,
        dealershipId: d1Id,
        warehouseId: wId,
        supplierId: sId,
        challanNumber: "CH-DUP-TEST",
        challanDate: "2026-11-24",
        actorId: uId,
      });

      await assert.rejects(
        async () => {
          await GoodsReceiptNoteService.createGrn({
            businessId: bId,
            dealershipId: d1Id,
            warehouseId: wId,
            supplierId: sId,
            challanNumber: "CH-DUP-TEST",
            challanDate: "2026-11-24",
            actorId: uId,
          });
        },
        /Duplicate Challan/
      );
    });

    test("Allows re-use of challan number if previous GRN was CANCELLED", async () => {
      const first = await GoodsReceiptNoteService.createGrn({
        businessId: bId,
        dealershipId: d1Id,
        warehouseId: wId,
        supplierId: sId,
        challanNumber: "CH-REUSE-99",
        challanDate: "2026-11-24",
        actorId: uId,
      });

      await GoodsReceiptNoteService.cancelGrn({
        grnId: first._id,
        reason: "Supplier sent wrong delivery",
        actorId: uId,
      });

      const second = await GoodsReceiptNoteService.createGrn({
        businessId: bId,
        dealershipId: d1Id,
        warehouseId: wId,
        supplierId: sId,
        challanNumber: "CH-REUSE-99",
        challanDate: "2026-11-24",
        actorId: uId,
      });

      assert.ok(second._id);
      assert.equal(second.challanNumber, "CH-REUSE-99");
    });
  });

  describe("2. Document Upload & Format/Size Validation", () => {
    test("Rejects invalid file extensions and unsupported mime types", async () => {
      const grn = await GoodsReceiptNoteService.createGrn({
        businessId: bId,
        dealershipId: d1Id,
        warehouseId: wId,
        supplierId: sId,
        challanNumber: "CH-FILE-VAL",
        challanDate: "2026-11-24",
        actorId: uId,
      });

      await assert.rejects(
        async () => {
          await GoodsReceiptNoteService.attachDocument({
            grnId: grn._id,
            fileBuffer: Buffer.from("bad binary"),
            originalName: "malware.exe",
            mimeType: "application/x-msdownload",
            actorId: uId,
          });
        },
        /Invalid file type/
      );
    });

    test("Rejects files exceeding 10MB limit", async () => {
      const grn = await GoodsReceiptNoteService.createGrn({
        businessId: bId,
        dealershipId: d1Id,
        warehouseId: wId,
        supplierId: sId,
        challanNumber: "CH-SIZE-VAL",
        challanDate: "2026-11-24",
        actorId: uId,
      });

      const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
      await assert.rejects(
        async () => {
          await GoodsReceiptNoteService.attachDocument({
            grnId: grn._id,
            fileBuffer: oversizedBuffer,
            originalName: "giant-challan.pdf",
            mimeType: "application/pdf",
            actorId: uId,
          });
        },
        /exceeds 10MB limit/
      );
    });
  });

  describe("3. OCR Abstraction & Fallback", () => {
    test("Reports NOT_CONFIGURED when live OCR credentials are unavailable", async () => {
      const provider = new UnconfiguredOcrProvider();
      assert.equal(provider.isConfigured(), false);

      const result = await provider.extractFromFile(Buffer.from("dummy"), "application/pdf");
      assert.equal(result.status, "NOT_CONFIGURED");
      assert.equal(result.isConfigured, false);
      assert.ok(result.errorMessage.includes("Manual Challan Entry"));
    });

    test("Regex parser correctly extracts structured fields from raw OCR text", () => {
      const rawText = `
        M/S SQUARE CONSUMER PRODUCTS
        DELIVERY CHALLAN NO: CH-5591-A
        DATE: 2026-11-24
        INVOICE NO: INV-8820
        Fresh Refined Sugar 1kg Pack 50 pcs 120.00 6000.00
        SUB TOTAL: 6000.00
        INVOICE DISCOUNT: 300.00
        NET TOTAL: 5700.00
      `;

      const parsed = RegexChallanParser.parseRawText(rawText);
      assert.equal(parsed.challanNumber?.value, "CH-5591-A");
      assert.equal(parsed.invoiceNumber?.value, "INV-8820");
      assert.equal(parsed.lineItems.length, 1);
      assert.equal(parsed.lineItems[0].rawName, "Fresh Refined Sugar 1kg Pack");
      assert.equal(parsed.lineItems[0].quantity, 50);
      assert.equal(parsed.lineItems[0].unitPrice, 120);
      assert.equal(parsed.grossTotal?.value, 6000);
      assert.equal(parsed.invoiceDiscount?.value, 300);
      assert.equal(parsed.netTotal?.value, 5700);
    });
  });

  describe("4. Confidence-Aware Product Matching", () => {
    test("Exact Barcode match returns HIGH confidence (1.0) and matches variant", async () => {
      const match = await ProductMatcherService.matchLineItem(bId, {
        rawName: "Scanned sugar item",
        barcode: "894110011001",
      });

      assert.equal(match.matchStatus, "matched");
      assert.equal(match.matchConfidence, 1.0);
      assert.equal(String(match.variantId), String(var1Id));
      assert.equal(match.sku, "SUGAR-REF-1KG-STD");
    });

    test("Exact SKU match returns HIGH confidence (1.0)", async () => {
      const match = await ProductMatcherService.matchLineItem(bId, {
        rawName: "Scanned sugar item",
        sku: "SUGAR-REF-1KG-STD",
      });

      assert.equal(match.matchStatus, "matched");
      assert.equal(match.matchConfidence, 1.0);
      assert.equal(String(match.productId), String(prod1Id));
    });

    test("Returns ambiguous status when product matches but multiple variants exist", async () => {
      // Add second variant to prod1Id
      variants.push({
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        productId: prod1Id,
        variantName: "2kg Family Pack",
        sku: "SUGAR-REF-2KG",
        purchasePrice: 235,
        customerPrice: 260,
        retailPrice: 270,
        status: "active",
      });

      const match = await ProductMatcherService.matchLineItem(bId, {
        rawName: "Fresh Refined Sugar 1kg Pack",
      });

      assert.equal(match.matchStatus, "ambiguous");
      assert.ok(match.candidates.length >= 2);
    });

    test("Returns unmatched status when product is absent from catalog", async () => {
      const match = await ProductMatcherService.matchLineItem(bId, {
        rawName: "Non-existent Mystery Product Brand XYZ",
        sku: "UNKNOWN-SKU-999",
      });

      assert.equal(match.matchStatus, "unmatched");
      assert.equal(match.matchConfidence, 0);
    });
  });

  describe("5. Discount & Scheme Separation and Landed Cost Calculation", () => {
    test("Allocates invoice discount and freight proportionally and absorbs scheme free units", () => {
      const result = GrnCostAllocationService.allocateCosts({
        items: [
          {
            productName: "Sugar 1kg",
            challanQuantity: 10,
            receivedQuantity: 10,
            unitPurchasePrice: 100, // Gross = 1000
            lineDiscount: 50,       // Net line = 950
            supplierSchemeFreeQuantity: 2, // 2 free units
          },
        ],
        invoiceDiscount: 50, // Net before invoice: 950 -> after: 900
        freightCharge: 60,   // Net with freight: 960
        handlingCharge: 0,
      });

      assert.equal(result.grossTotal, 1000);
      assert.equal(result.totalLineDiscount, 50);
      assert.equal(result.invoiceDiscount, 50);
      assert.equal(result.freightCharge, 60);

      const item = result.items[0];
      assert.equal(item.allocatedInvoiceDiscount, 50);
      assert.equal(item.allocatedFreight, 60);

      // Total Landed Cost = (10 * 100) - (50 line + 50 inv) + 60 freight = 960
      // Total received units = 10 purchased + 2 free = 12 units
      // Net Landed Unit Cost = 960 / 12 = 80 BDT/unit
      assert.equal(item.netLandedUnitCost, 80);
    });
  });

  describe("6. Physical Receiving & Discrepancies", () => {
    test("Calculates shortage correctly when received quantity is less than challan", async () => {
      const grn = await GoodsReceiptNoteService.createGrn({
        businessId: bId,
        dealershipId: d1Id,
        warehouseId: wId,
        supplierId: sId,
        challanNumber: "CH-SHORTAGE-1",
        challanDate: "2026-11-24",
        items: [
          {
            productName: "Fresh Refined Sugar 1kg Pack",
            sku: "SUGAR-REF-1KG-STD",
            challanQuantity: 100,
            unitPurchasePrice: 120,
          },
        ],
        actorId: uId,
      });

      // Update actual received count to 92 (shortage of 8 units)
      const updated = await GoodsReceiptNoteService.updateGrn(grn._id, {
        items: [
          {
            ...grn.items[0],
            receivedQuantity: 92,
            damagedQuantity: 2,
          },
        ],
        actorId: uId,
        reason: "Driver delivery count shortage of 8 bags, 2 bags torn/damaged",
      });

      const item = updated.items[0];
      assert.equal(item.receivedQuantity, 92);
      assert.equal(item.shortageQuantity, 8);
      assert.equal(item.damagedQuantity, 2);
    });
  });

  describe("7. Concurrency Safety & Idempotent Confirmation", () => {
    test("GRN confirmation updates stock and creates batches idempotently", async () => {
      const grn = await GoodsReceiptNoteService.createGrn({
        businessId: bId,
        dealershipId: d1Id,
        warehouseId: wId,
        supplierId: sId,
        challanNumber: "CH-VERIFY-IDEMP",
        challanDate: "2026-11-24",
        items: [
          {
            productName: "Fresh Refined Sugar 1kg Pack",
            sku: "SUGAR-REF-1KG-STD",
            challanQuantity: 50,
            receivedQuantity: 50,
            unitPurchasePrice: 120,
            supplierSchemeFreeQuantity: 5,
          },
        ],
        actorId: uId,
      });

      const idempotencyKey = "idemp_key_grn_001";

      // 1. First confirmation: must succeed and add stock
      const verified = await GoodsReceiptNoteService.confirmGrn({
        grnId: grn._id,
        idempotencyKey,
        actorId: uId,
      });

      assert.equal(verified.status, "VERIFIED");
      assert.equal(batches.length, 1);
      assert.equal(batches[0].totalReceivedQuantity, 55); // 50 + 5 free
      assert.equal(balances.length, 1);
      assert.equal(balances[0].onHandQuantity, 55);

      // 2. Duplicate confirmation with same idempotencyKey: must return verified GRN without double-incrementing stock
      const duplicateCall = await GoodsReceiptNoteService.confirmGrn({
        grnId: grn._id,
        idempotencyKey,
        actorId: uId,
      });

      assert.equal(duplicateCall.status, "VERIFIED");
      assert.equal(batches.length, 1, "Batches must NOT be duplicated");
      assert.equal(balances[0].onHandQuantity, 55, "Stock must NOT increase twice");
    });
  });

  describe("8. Costing & Profit Integrity", () => {
    test("Historical landed cost in StockBatch remains unchanged after catalog purchasePrice changes", async () => {
      const grn = await GoodsReceiptNoteService.createGrn({
        businessId: bId,
        dealershipId: d1Id,
        warehouseId: wId,
        supplierId: sId,
        challanNumber: "CH-COST-SNAP-01",
        challanDate: "2026-11-24",
        items: [
          {
            productName: "Fresh Refined Sugar 1kg Pack",
            sku: "SUGAR-REF-1KG-STD",
            challanQuantity: 10,
            receivedQuantity: 10,
            unitPurchasePrice: 120,
          },
        ],
        actorId: uId,
      });

      await GoodsReceiptNoteService.confirmGrn({
        grnId: grn._id,
        actorId: uId,
      });

      const originalBatchCost = batches[0].netLandedUnitCost;
      assert.equal(originalBatchCost, 120);

      // Simulate supplier price hike in central catalog
      variants[0].purchasePrice = 180;

      // Historical batch cost snapshot must remain strictly 120
      assert.equal(batches[0].netLandedUnitCost, 120);
    });
  });

  describe("9. Dealership Stock Isolation in Shared Warehouse", () => {
    test("Stock received under Dealership 1 is strictly isolated from Dealership 2", async () => {
      const grn = await GoodsReceiptNoteService.createGrn({
        businessId: bId,
        dealershipId: d1Id, // Dealership 1
        warehouseId: wId,   // Shared Warehouse
        supplierId: sId,
        challanNumber: "CH-DEALER-ISO",
        challanDate: "2026-11-24",
        items: [
          {
            productName: "Fresh Refined Sugar 1kg Pack",
            sku: "SUGAR-REF-1KG-STD",
            challanQuantity: 40,
            receivedQuantity: 40,
            unitPurchasePrice: 120,
          },
        ],
        actorId: uId,
      });

      await GoodsReceiptNoteService.confirmGrn({
        grnId: grn._id,
        actorId: uId,
      });

      // Dealership 1 balance must have 40
      const d1Balance = balances.find((b) => String(b.dealershipId) === String(d1Id));
      assert.ok(d1Balance);
      assert.equal(d1Balance.onHandQuantity, 40);

      // Dealership 2 balance must be non-existent or 0
      const d2Balance = balances.find((b) => String(b.dealershipId) === String(d2Id));
      assert.equal(d2Balance, undefined);
    });
  });

  describe("10. Purchase-Cost Confidentiality & Role Masking", () => {
    test("Redacts purchase cost fields for sales staff without PRICING_VIEW_PURCHASE_PRICE", () => {
      const salesUser = {
        userId: "user_sales_1",
        role: "sales_staff",
        permissions: ["products.view", "orders.create"],
      };

      const canView = canUserViewPurchaseCost(salesUser);
      assert.equal(canView, false);

      const unmaskedGrn = {
        grnNumber: "GRN-2026-001",
        grossTotal: 12000,
        totalLineDiscount: 500,
        invoiceDiscount: 200,
        netInvoiceTotal: 11300,
        items: [
          {
            productName: "Sugar 1kg",
            challanQuantity: 100,
            unitPurchasePrice: 120,
            lineDiscount: 500,
            netLandedUnitCost: 113,
            lineTotal: 11500,
          },
        ],
      };

      const masked = maskGrnCosts(unmaskedGrn, canView);

      assert.equal(masked.grossTotal, undefined);
      assert.equal(masked.netInvoiceTotal, undefined);
      assert.equal(masked.items[0].unitPurchasePrice, undefined);
      assert.equal(masked.items[0].netLandedUnitCost, undefined);
      assert.equal(masked.items[0].lineTotal, undefined);

      // Quantities and names must remain visible
      assert.equal(masked.items[0].productName, "Sugar 1kg");
      assert.equal(masked.items[0].challanQuantity, 100);
    });

    test("Permits full cost fields for accountant, purchase manager, and owner", () => {
      const accountantUser = {
        userId: "user_acc_1",
        role: "accountant",
        permissions: ["pricing.view_purchase_price"],
      };

      assert.equal(canUserViewPurchaseCost(accountantUser), true);
    });
  });
});
