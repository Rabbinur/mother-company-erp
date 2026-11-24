import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

// Models
import { Product } from "../src/models/Product.ts";
import { ProductVariant } from "../src/models/ProductVariant.ts";
import { DealershipProduct } from "../src/models/DealershipProduct.ts";
import { DealershipPrice } from "../src/models/DealershipPrice.ts";
import { PriceHistory } from "../src/models/PriceHistory.ts";
import { AuditLog } from "../src/models/AuditLog.ts";

// Services
import { ProductService } from "../src/services/ProductService.ts";
import { DealershipProductService } from "../src/services/DealershipProductService.ts";
import { PricingService } from "../src/services/PricingService.ts";

// Setup mongoose mock cache
process.env.MONGODB_URI = "mongodb://localhost:27017/mother_erp_test";
if (!global.mongooseCache) {
  global.mongooseCache = { conn: mongoose, promise: Promise.resolve(mongoose) };
} else {
  global.mongooseCache.conn = mongoose;
  global.mongooseCache.promise = Promise.resolve(mongoose);
}

describe("Phase 3 — Step 2: Product & Pricing Engine", () => {
  // In-memory data store for isolated mock testing
  let products = [];
  let variants = [];
  let dealershipProducts = [];
  let dealershipPrices = [];
  let priceHistories = [];
  let auditLogs = [];

  const bId = new mongoose.Types.ObjectId();
  const dId = new mongoose.Types.ObjectId();
  const d2Id = new mongoose.Types.ObjectId();
  const catId = new mongoose.Types.ObjectId();
  const brandId = new mongoose.Types.ObjectId();
  const principalCompanyId = new mongoose.Types.ObjectId();

  const ownerActor = {
    userId: new mongoose.Types.ObjectId().toString(),
    email: "owner@mothercompany.com",
    role: "owner",
    permissions: [],
  };

  const salesStaffActor = {
    userId: new mongoose.Types.ObjectId().toString(),
    email: "sales@dealership-a.com",
    role: "sales_staff",
    permissions: [],
  };

  const purchaseManagerActor = {
    userId: new mongoose.Types.ObjectId().toString(),
    email: "purchaser@mothercompany.com",
    role: "purchase_manager",
    permissions: ["pricing.view_purchase_price", "pricing.update"],
  };

  beforeEach(() => {
    products = [];
    variants = [];
    dealershipProducts = [];
    dealershipPrices = [];
    priceHistories = [];
    auditLogs = [];

    // Mock AuditLog.create
    AuditLog.create = async (doc) => {
      const record = { ...doc, _id: new mongoose.Types.ObjectId() };
      auditLogs.push(record);
      return record;
    };

    // Mock Product methods
    Product.create = async (doc) => {
      const record = {
        ...doc,
        _id: new mongoose.Types.ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date(),
        toObject: function () {
          return { ...this };
        },
      };
      products.push(record);
      return record;
    };

    Product.findById = async (id) => {
      const p = products.find((x) => String(x._id) === String(id));
      if (!p) return null;
      return {
        ...p,
        save: async function () {
          Object.assign(p, this);
          return this;
        },
        toObject: function () {
          return { ...this };
        },
      };
    };

    Product.findOne = (query) => {
      const p = products.find((x) => {
        if (query._id && String(x._id) !== String(query._id)) return false;
        if (query.sku && x.sku !== query.sku) return false;
        if (query.businessId && String(x.businessId) !== String(query.businessId)) return false;
        if (query.status && query.status.$ne && x.status === query.status.$ne) return false;
        if (query.status && typeof query.status === "string" && x.status !== query.status) return false;
        return true;
      });

      const doc = p
        ? {
            ...p,
            save: async function () {
              Object.assign(p, this);
              return this;
            },
            toObject: function () {
              return { ...this };
            },
          }
        : null;

      const chainable = {
        populate: () => chainable,
        sort: () => chainable,
        skip: () => chainable,
        limit: () => chainable,
        lean: async () => (doc ? { ...p } : null),
        then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject),
      };
      return chainable;
    };

    Product.findByIdAndUpdate = async (id, update) => {
      const p = products.find((x) => String(x._id) === String(id));
      if (!p) return null;
      Object.assign(p, update);
      return { ...p };
    };

    // Mock ProductVariant methods
    ProductVariant.create = async (doc) => {
      const record = {
        ...doc,
        _id: new mongoose.Types.ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date(),
        toObject: function () {
          return { ...this };
        },
      };
      variants.push(record);
      return record;
    };

    ProductVariant.find = (query) => {
      const list = variants.filter((x) => {
        if (query.productId && String(x.productId) !== String(query.productId)) return false;
        if (query.status && x.status !== query.status) return false;
        return true;
      });

      const chainable = {
        populate: () => chainable,
        sort: () => chainable,
        lean: async () => list.map((v) => ({ ...v })),
        then: (resolve, reject) => Promise.resolve(list).then(resolve, reject),
      };
      return chainable;
    };

    ProductVariant.findOne = (query) => {
      const v = variants.find((x) => {
        if (query._id && String(x._id) !== String(query._id)) return false;
        if (query.productId && String(x.productId) !== String(query.productId)) return false;
        if (query.sku && x.sku !== query.sku) return false;
        return true;
      });

      const doc = v
        ? {
            ...v,
            save: async function () {
              Object.assign(v, this);
              return this;
            },
            toObject: function () {
              return { ...this };
            },
          }
        : null;

      const chainable = {
        populate: () => chainable,
        sort: () => chainable,
        lean: async () => (doc ? { ...v } : null),
        then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject),
      };
      return chainable;
    };

    ProductVariant.updateMany = async (query, update) => {
      let count = 0;
      variants.forEach((v) => {
        if (query.productId && String(v.productId) === String(query.productId)) {
          Object.assign(v, update);
          count++;
        }
      });
      return { modifiedCount: count };
    };

    // Mock DealershipProduct methods
    DealershipProduct.create = async (doc) => {
      const record = {
        ...doc,
        _id: new mongoose.Types.ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date(),
        toObject: function () {
          return { ...this };
        },
      };
      dealershipProducts.push(record);
      return record;
    };

    DealershipProduct.findOne = (query) => {
      const dp = dealershipProducts.find((x) => {
        if (query.dealershipId && String(x.dealershipId) !== String(query.dealershipId)) return false;
        if (query.productId && String(x.productId) !== String(query.productId)) return false;
        return true;
      });

      const doc = dp
        ? {
            ...dp,
            save: async function () {
              Object.assign(dp, this);
              return this;
            },
            toObject: function () {
              return { ...this };
            },
          }
        : null;

      const chainable = {
        populate: () => chainable,
        lean: async () => (doc ? { ...dp } : null),
        then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject),
      };
      return chainable;
    };

    DealershipProduct.find = (query) => {
      const list = dealershipProducts.filter((x) => {
        if (query.dealershipId && String(x.dealershipId) !== String(query.dealershipId)) return false;
        if (query.status && x.status !== query.status) return false;
        if (query.isAvailable !== undefined && x.isAvailable !== query.isAvailable) return false;
        return true;
      });

      const chainable = {
        populate: (pop) => {
          // Mock basic population for product
          return {
            ...chainable,
            populate: () => chainable,
            lean: async () => {
              return list.map((item) => {
                const prod = products.find((p) => String(p._id) === String(item.productId));
                return {
                  ...item,
                  productId: prod ? { ...prod } : null,
                };
              });
            },
          };
        },
        lean: async () => list.map((x) => ({ ...x })),
        then: (resolve, reject) => Promise.resolve(list).then(resolve, reject),
      };
      return chainable;
    };

    // Mock DealershipPrice methods
    DealershipPrice.create = async (doc) => {
      const record = {
        ...doc,
        _id: new mongoose.Types.ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date(),
        toObject: function () {
          return { ...this };
        },
      };
      dealershipPrices.push(record);
      return record;
    };

    DealershipPrice.findOne = (query) => {
      const dp = dealershipPrices.find((x) => {
        if (query.dealershipId && String(x.dealershipId) !== String(query.dealershipId)) return false;
        if (query.productId && String(x.productId) !== String(query.productId)) return false;
        if (query.variantId && String(x.variantId) !== String(query.variantId)) return false;
        if (query.status && x.status !== query.status) return false;
        return true;
      });

      const doc = dp
        ? {
            ...dp,
            save: async function () {
              Object.assign(dp, this);
              return this;
            },
          }
        : null;

      const chainable = {
        sort: () => chainable,
        lean: async () => (doc ? { ...dp } : null),
        then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject),
      };
      return chainable;
    };

    // Mock PriceHistory methods
    PriceHistory.create = async (doc) => {
      const record = {
        ...doc,
        _id: new mongoose.Types.ObjectId(),
        createdAt: new Date(),
      };
      priceHistories.push(record);
      return record;
    };

    PriceHistory.find = (query) => {
      const list = priceHistories.filter((x) => {
        if (query.productId && String(x.productId) !== String(query.productId)) return false;
        if (query.variantId && String(x.variantId) !== String(query.variantId)) return false;
        if (query.dealershipId && String(x.dealershipId) !== String(query.dealershipId)) return false;
        return true;
      });

      const chainable = {
        populate: () => chainable,
        sort: () => chainable,
        limit: () => chainable,
        lean: async () => list.map((h) => ({ ...h })),
        then: (resolve, reject) => Promise.resolve(list).then(resolve, reject),
      };
      return chainable;
    };
  });

  // ==========================================
  // SECTION 1: Product Creation & Tenancy
  // ==========================================
  describe("Product Creation & Schema Integrity", () => {
    test("Creates product with SKU, code, barcode, UOM, and default variant", async () => {
      const created = await ProductService.createProduct(
        {
          businessId: bId,
          principalCompanyId,
          name: "Walton Prime Refrigerator 220L",
          sku: "WLTN-REF-220",
          code: "REF-220L",
          barcode: "8941122334455",
          categoryId: catId,
          brandId,
          unit: "pcs",
          uom: "pcs",
          purchasePrice: 60000,
          customerPrice: 80000,
          retailPrice: 100000,
        },
        ownerActor
      );

      assert.ok(created._id, "Product should have an _id");
      assert.equal(created.sku, "WLTN-REF-220");
      assert.equal(created.code, "REF-220L");
      assert.equal(created.barcode, "8941122334455");
      assert.equal(created.unit, "pcs");
      assert.equal(created.status, "active");
      assert.equal(created.variants.length, 1, "Default variant should be created");

      // Verify audit log recorded
      assert.equal(auditLogs.length, 1);
      assert.equal(auditLogs[0].action, "PRODUCT_CREATED");
    });

    test("Rejects duplicate SKU within the same business organization", async () => {
      await ProductService.createProduct(
        {
          businessId: bId,
          name: "Original Product",
          sku: "DUP-SKU-001",
          categoryId: catId,
          purchasePrice: 100,
          customerPrice: 150,
          retailPrice: 200,
        },
        ownerActor
      );

      await assert.rejects(
        async () => {
          await ProductService.createProduct(
            {
              businessId: bId,
              name: "Duplicate Product",
              sku: "DUP-SKU-001",
              categoryId: catId,
              purchasePrice: 100,
              customerPrice: 150,
              retailPrice: 200,
            },
            ownerActor
          );
        },
        {
          message: "Product with SKU 'DUP-SKU-001' already exists in this organization",
        }
      );
    });

    test("Creates variable product with multiple custom variants", async () => {
      const created = await ProductService.createProduct(
        {
          businessId: bId,
          name: "Walton Smart TV 55 Inch",
          sku: "WLTN-TV-55",
          categoryId: catId,
          productType: "variable",
          variants: [
            {
              variantName: "Standard HD",
              sku: "WLTN-TV-55-HD",
              barcode: "89411001",
              attributes: [{ name: "Resolution", value: "1080p" }],
              purchasePrice: 40000,
              customerPrice: 50000,
              retailPrice: 60000,
            },
            {
              variantName: "4K UHD Pro",
              sku: "WLTN-TV-55-4K",
              barcode: "89411002",
              attributes: [{ name: "Resolution", value: "4K UHD" }],
              purchasePrice: 55000,
              customerPrice: 68000,
              retailPrice: 80000,
            },
          ],
        },
        ownerActor
      );

      assert.equal(created.hasVariants, true);
      assert.equal(created.variants.length, 2);
      assert.equal(created.variants[0].sku, "WLTN-TV-55-HD");
      assert.equal(created.variants[1].sku, "WLTN-TV-55-4K");
    });
  });

  // ==========================================
  // SECTION 2: DealershipProduct Availability
  // ==========================================
  describe("Dealership-Specific Product Availability", () => {
    let testProduct;

    beforeEach(async () => {
      testProduct = await ProductService.createProduct(
        {
          businessId: bId,
          principalCompanyId,
          name: "Marcel Split Air Conditioner 1.5 Ton",
          sku: "MRCL-AC-15",
          categoryId: catId,
          purchasePrice: 45000,
          customerPrice: 55000,
          retailPrice: 65000,
        },
        ownerActor
      );
    });

    test("Assigns product to dealership without duplicating catalog records", async () => {
      const assignment = await DealershipProductService.assignProduct({
        businessId: bId,
        dealershipId: dId,
        productId: testProduct._id,
        assignedBy: ownerActor.userId,
      });

      assert.ok(assignment._id);
      assert.equal(String(assignment.dealershipId), String(dId));
      assert.equal(String(assignment.productId), String(testProduct._id));
      assert.equal(assignment.isAvailable, true);
      assert.equal(products.length, 1, "Catalog Product count must remain exactly 1");
    });

    test("Toggles product availability per branch independently", async () => {
      // Assign to Dealership 1 and Dealership 2
      await DealershipProductService.assignProduct({
        businessId: bId,
        dealershipId: dId,
        productId: testProduct._id,
      });
      await DealershipProductService.assignProduct({
        businessId: bId,
        dealershipId: d2Id,
        productId: testProduct._id,
      });

      // Disable in Dealership 1
      await DealershipProductService.setAvailability({
        dealershipId: dId,
        productId: testProduct._id,
        isAvailable: false,
        actor: { userId: ownerActor.userId },
      });

      const d1Items = await DealershipProductService.getDealershipProducts({
        dealershipId: dId,
        isAvailable: true,
      });
      assert.equal(d1Items.length, 0, "Dealership 1 should have no active available items");

      const d2Items = await DealershipProductService.getDealershipProducts({
        dealershipId: d2Id,
        isAvailable: true,
      });
      assert.equal(d2Items.length, 1, "Dealership 2 must still have the product available");
    });

    test("Performs bulk assignment of products to dealership", async () => {
      const p2 = await ProductService.createProduct(
        {
          businessId: bId,
          name: "Product 2",
          sku: "P2",
          categoryId: catId,
          customerPrice: 100,
          retailPrice: 120,
          purchasePrice: 80,
        },
        ownerActor
      );

      const bulkRes = await DealershipProductService.bulkAssign(
        bId,
        dId,
        [testProduct._id, p2._id],
        ownerActor.userId
      );

      assert.equal(bulkRes.assignedCount, 2);
      assert.equal(bulkRes.productIds.length, 2);
    });
  });

  // ==========================================
  // SECTION 3: 3-Level Pricing & Confidentiality
  // ==========================================
  describe("3-Level Pricing & Confidentiality Governance", () => {
    let variableProduct;

    beforeEach(async () => {
      variableProduct = await ProductService.createProduct(
        {
          businessId: bId,
          name: "Standard Motorcycle Helmet",
          sku: "HELMET-STD",
          categoryId: catId,
          purchasePrice: 60, // Confidential Acquisition Cost
          customerPrice: 80, // Wholesale Dealership Price
          retailPrice: 100,  // Suggested Retail Price (MSRP)
        },
        ownerActor
      );
    });

    test("Calculates retailer margin and dealership margins accurately", () => {
      const purchasePrice = 60;
      const customerPrice = 80;
      const retailPrice = 100;

      // Retailer margin: (retailPrice - customerPrice) / retailPrice
      const retailerMarginAmount = retailPrice - customerPrice;
      const retailerMarginPct = (retailerMarginAmount / retailPrice) * 100;
      assert.equal(retailerMarginAmount, 20);
      assert.equal(retailerMarginPct, 20);

      // Dealer margin: (customerPrice - purchasePrice) / customerPrice
      const dealerMarginAmount = customerPrice - purchasePrice;
      const dealerMarginPct = (dealerMarginAmount / customerPrice) * 100;
      assert.equal(dealerMarginAmount, 20);
      assert.equal(dealerMarginPct, 25);
    });

    test("Strict Purchase Price Confidentiality: Strips purchasePrice for unauthorized roles", () => {
      const rawVariant = variants[0];

      // Sales staff should NEVER see purchasePrice
      const salesView = PricingService.sanitizeVariant(rawVariant, "sales_staff");
      assert.equal(salesView.purchasePrice, undefined, "Purchase price must be undefined for sales staff");
      assert.equal(salesView.customerPrice, 80);
      assert.equal(salesView.retailPrice, 100);

      // Cashier should NEVER see purchasePrice
      const cashierView = PricingService.sanitizeVariant(rawVariant, "cashier");
      assert.equal(cashierView.purchasePrice, undefined, "Purchase price must be undefined for cashier");

      // Sales manager should NEVER see purchasePrice
      const salesManagerView = PricingService.sanitizeVariant(rawVariant, "sales_manager");
      assert.equal(salesManagerView.purchasePrice, undefined, "Purchase price must be undefined for sales manager");

      // Authorized roles DO see purchasePrice
      const ownerView = PricingService.sanitizeVariant(rawVariant, "owner");
      assert.equal(ownerView.purchasePrice, 60, "Owner can view purchase price");

      const adminView = PricingService.sanitizeVariant(rawVariant, "super_admin");
      assert.equal(adminView.purchasePrice, 60, "Super admin can view purchase price");

      const accountantView = PricingService.sanitizeVariant(rawVariant, "accountant");
      assert.equal(accountantView.purchasePrice, 60, "Accountant can view purchase price");

      const purchaserView = PricingService.sanitizeVariant(rawVariant, "purchase_manager");
      assert.equal(purchaserView.purchasePrice, 60, "Purchase manager can view purchase price");
    });

    test("Supports dealership-specific price overrides with precedence", async () => {
      const variant = variants[0];

      // Set Dealership override: Customer ৳85, Retail ৳110, Purchase ৳62
      await PricingService.setDealershipPrice({
        businessId: bId,
        dealershipId: dId,
        productId: variableProduct._id,
        variantId: variant._id,
        purchasePrice: 62,
        customerPrice: 85,
        retailPrice: 110,
        reason: "Regional tax and freight adjustment",
      });

      // Price resolution for Dealership 1 -> Should return override
      const resolvedD1 = await PricingService.resolveActivePrice({
        dealershipId: dId,
        productId: variableProduct._id,
        variantId: variant._id,
      });
      assert.equal(resolvedD1.customerPrice, 85);
      assert.equal(resolvedD1.retailPrice, 110);
      assert.equal(resolvedD1.priceSource, "dealership_override");

      // Price resolution for Dealership 2 (no override) -> Should fallback to catalog base
      const resolvedD2 = await PricingService.resolveActivePrice({
        dealershipId: d2Id,
        productId: variableProduct._id,
        variantId: variant._id,
      });
      assert.equal(resolvedD2.customerPrice, 80);
      assert.equal(resolvedD2.retailPrice, 100);
      assert.equal(resolvedD2.priceSource, "catalog_base");
    });
  });

  // ==========================================
  // SECTION 4: Transaction Price Snapshot
  // ==========================================
  describe("Transaction Price Snapshot Structure", () => {
    let testProduct;

    beforeEach(async () => {
      testProduct = await ProductService.createProduct(
        {
          businessId: bId,
          name: "Generator 5KVA",
          sku: "GEN-5KVA",
          categoryId: catId,
          purchasePrice: 120000,
          customerPrice: 150000,
          retailPrice: 175000,
        },
        ownerActor
      );
    });

    test("Captures complete transaction snapshot with margins for authorized actor", async () => {
      const snapshot = await PricingService.createPriceSnapshot(
        {
          dealershipId: dId,
          productId: testProduct._id,
          variantId: variants[0]._id,
        },
        "owner"
      );

      assert.equal(String(snapshot.productId), String(testProduct._id));
      assert.equal(snapshot.customerPrice, 150000);
      assert.equal(snapshot.retailPrice, 175000);
      assert.equal(snapshot.purchasePrice, 120000);
      assert.equal(snapshot.dealerMarginAmount, 30000); // 150k - 120k
      assert.equal(snapshot.retailerMarginAmount, 25000); // 175k - 150k
      assert.ok(snapshot.snapshotAt instanceof Date);
    });

    test("Strips confidential purchase data in snapshot for sales staff", async () => {
      const snapshot = await PricingService.createPriceSnapshot(
        {
          dealershipId: dId,
          productId: testProduct._id,
          variantId: variants[0]._id,
        },
        "sales_staff"
      );

      assert.equal(snapshot.customerPrice, 150000);
      assert.equal(snapshot.retailPrice, 175000);
      assert.equal(snapshot.purchasePrice, undefined, "Confidential acquisition cost must be stripped");
      assert.equal(snapshot.dealerMarginAmount, undefined, "Dealer cost margin must be stripped");
      assert.equal(snapshot.dealerMarginPercentage, undefined);
      assert.equal(snapshot.retailerMarginAmount, 25000, "Retailer margin remains visible");
    });
  });

  // ==========================================
  // SECTION 5: Immutable Price History Audit
  // ==========================================
  describe("Price History Immutability & Audit Trail", () => {
    test("Records full price revisions with actor, reason, and timestamps", async () => {
      const prod = await ProductService.createProduct(
        {
          businessId: bId,
          name: "Ceiling Fan 56 Inch",
          sku: "FAN-56",
          categoryId: catId,
          purchasePrice: 2000,
          customerPrice: 2500,
          retailPrice: 3000,
        },
        ownerActor
      );

      const variantId = variants[0]._id;

      // Update base catalog prices
      await PricingService.updatePrices({
        productId: prod._id,
        variantId,
        newPurchasePrice: 2200,
        newCustomerPrice: 2800,
        newRetailPrice: 3400,
        changedBy: purchaseManagerActor.userId,
        reason: "Copper price inflation",
      });

      assert.equal(priceHistories.length, 1);
      const entry = priceHistories[0];
      assert.equal(entry.oldPurchasePrice, 2000);
      assert.equal(entry.newPurchasePrice, 2200);
      assert.equal(entry.oldCustomerPrice, 2500);
      assert.equal(entry.newCustomerPrice, 2800);
      assert.equal(entry.oldRetailPrice, 3000);
      assert.equal(entry.newRetailPrice, 3400);
      assert.equal(entry.reason, "Copper price inflation");
    });

    test("Sanitizes price history for unauthorized users querying audit logs", async () => {
      const prod = await ProductService.createProduct(
        {
          businessId: bId,
          name: "LED Bulb 12W",
          sku: "LED-12W",
          categoryId: catId,
          purchasePrice: 100,
          customerPrice: 150,
          retailPrice: 180,
        },
        ownerActor
      );

      await PricingService.updatePrices({
        productId: prod._id,
        variantId: variants[0]._id,
        newPurchasePrice: 110,
        newCustomerPrice: 160,
        newRetailPrice: 195,
        changedBy: purchaseManagerActor.userId,
        reason: "Component price increase",
      });

      // Query history as sales staff
      const staffHistory = await PricingService.getPriceHistory(
        { productId: prod._id },
        "sales_staff"
      );
      assert.equal(staffHistory.length, 1);
      assert.equal(staffHistory[0].oldPurchasePrice, undefined, "oldPurchasePrice must be undefined");
      assert.equal(staffHistory[0].newPurchasePrice, undefined, "newPurchasePrice must be undefined");
      assert.equal(staffHistory[0].newCustomerPrice, 160);
      assert.equal(staffHistory[0].newRetailPrice, 195);

      // Query history as accountant
      const accountantHistory = await PricingService.getPriceHistory(
        { productId: prod._id },
        "accountant"
      );
      assert.equal(accountantHistory.length, 1);
      assert.equal(accountantHistory[0].oldPurchasePrice, 100);
      assert.equal(accountantHistory[0].newPurchasePrice, 110);
    });
  });
});
