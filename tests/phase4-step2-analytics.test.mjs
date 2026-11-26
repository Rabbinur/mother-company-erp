import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

// Models
import { Order } from "../src/models/Order.ts";
import { Product } from "../src/models/Product.ts";
import { Customer } from "../src/models/Customer.ts";
import { CustomerDealershipAccount } from "../src/models/CustomerDealershipAccount.ts";
import { User } from "../src/models/User.ts";
import { Payment } from "../src/models/Payment.ts";
import { SalesReturn } from "../src/models/SalesReturn.ts";
import { GoodsReceiptNote } from "../src/models/GoodsReceiptNote.ts";
import { PurchaseReturn } from "../src/models/PurchaseReturn.ts";
import { Vendor } from "../src/models/Vendor";
import { PrincipalCompany } from "../src/models/PrincipalCompany";
import { InventoryBalance } from "../src/models/InventoryBalance.ts";
import { Dealership } from "../src/models/Dealership.ts";

// Services under test
import { ProductIntelligenceService } from "../src/services/analytics/ProductIntelligenceService.ts";
import { CustomerIntelligenceService } from "../src/services/analytics/CustomerIntelligenceService.ts";
import { SalesmanPerformanceService } from "../src/services/analytics/SalesmanPerformanceService.ts";
import { SupplierIntelligenceService } from "../src/services/analytics/SupplierIntelligenceService.ts";
import { DemandIntelligenceService } from "../src/services/analytics/DemandIntelligenceService.ts";
import { OperationalAnalyticsService } from "../src/services/analytics/OperationalAnalyticsService.ts";

describe("Phase 4 - Step 2: Advanced Business Intelligence & Operational Analytics Test Suite", () => {
  let orders = [];
  let products = [];
  let customers = [];
  let customerAccounts = [];
  let users = [];
  let payments = [];
  let salesReturns = [];
  let grns = [];
  let purchaseReturns = [];
  let vendors = [];
  let principalCompanies = [];
  let inventoryBalances = [];
  let dealerships = [];

  const bId = new mongoose.Types.ObjectId();
  const dId1 = new mongoose.Types.ObjectId();
  const pcId1 = new mongoose.Types.ObjectId();
  const vendorId1 = new mongoose.Types.ObjectId();
  const prodId1 = new mongoose.Types.ObjectId();
  const prodId2 = new mongoose.Types.ObjectId();
  const custId1 = new mongoose.Types.ObjectId();
  const custId2 = new mongoose.Types.ObjectId();
  const custId3 = new mongoose.Types.ObjectId();
  const custId4 = new mongoose.Types.ObjectId();
  const salesmanId1 = new mongoose.Types.ObjectId();
  const salesmanId2 = new mongoose.Types.ObjectId();
  const salesmanId3 = new mongoose.Types.ObjectId();

  beforeEach(() => {
    orders = [];
    products = [];
    customers = [];
    customerAccounts = [];
    users = [];
    payments = [];
    salesReturns = [];
    grns = [];
    purchaseReturns = [];
    vendors = [];
    principalCompanies = [];
    inventoryBalances = [];
    dealerships = [];

    const createChainable = (getItems) => {
      const chain = {
        populate: () => chain,
        sort: () => chain,
        limit: (n) => Promise.resolve(getItems().slice(0, n)),
        lean: () => Promise.resolve(getItems()),
        then: (resolve, reject) => Promise.resolve(getItems()).then(resolve, reject),
      };
      return chain;
    };

    const matchDateRange = (itemDate, range) => {
      if (!range || !itemDate) return true;
      const d = new Date(itemDate).getTime();
      if (range.$gte && d < new Date(range.$gte).getTime()) return false;
      if (range.$lte && d > new Date(range.$lte).getTime()) return false;
      return true;
    };

    Dealership.find = (query) => {
      let filtered = dealerships.slice();
      if (query?.businessId) filtered = filtered.filter((d) => String(d.businessId) === String(query.businessId));
      return createChainable(() => filtered);
    };

    Order.find = (query) => {
      let filtered = orders.slice();
      if (query?.businessId) filtered = filtered.filter((o) => String(o.businessId) === String(query.businessId));
      if (query?.dealershipId) filtered = filtered.filter((o) => String(o.dealershipId) === String(query.dealershipId));
      if (query?.principalCompanyId) filtered = filtered.filter((o) => String(o.principalCompanyId) === String(query.principalCompanyId));
      if (query?.salesmanId?.$exists) filtered = filtered.filter((o) => o.salesmanId !== null && o.salesmanId !== undefined);

      if (query?.$and) {
        for (const clause of query.$and) {
          if (clause.$or) {
            filtered = filtered.filter((o) => {
              const d = o.fulfilledDate || o.orderDate;
              return clause.$or.some((orClause) => {
                const range = orClause.fulfilledDate || orClause.orderDate;
                return matchDateRange(d, range);
              });
            });
          }
        }
      } else if (query?.orderDate) {
        filtered = filtered.filter((o) => matchDateRange(o.orderDate, query.orderDate));
      }
      return createChainable(() => filtered);
    };

    Product.find = (query) => {
      let filtered = products.slice();
      if (query?.businessId) filtered = filtered.filter((p) => String(p.businessId) === String(query.businessId));
      if (query?.principalCompanyId) filtered = filtered.filter((p) => String(p.principalCompanyId) === String(query.principalCompanyId));
      if (query?._id?.$in) {
        const idStrs = query._id.$in.map(String);
        filtered = filtered.filter((p) => idStrs.includes(String(p._id)));
      }
      return createChainable(() => filtered);
    };

    Customer.find = (query) => {
      let filtered = customers.slice();
      if (query?.businessId) filtered = filtered.filter((c) => String(c.businessId) === String(query.businessId));
      if (query?._id?.$in) {
        const idStrs = query._id.$in.map(String);
        filtered = filtered.filter((c) => idStrs.includes(String(c._id)));
      }
      return createChainable(() => filtered);
    };

    CustomerDealershipAccount.find = (query) => {
      let filtered = customerAccounts.slice();
      if (query?.businessId) filtered = filtered.filter((c) => !c.businessId || String(c.businessId) === String(query.businessId));
      if (query?.dealershipId) filtered = filtered.filter((c) => String(c.dealershipId) === String(query.dealershipId));
      return createChainable(() => filtered);
    };

    User.find = (query) => {
      let filtered = users.slice();
      if (query?._id?.$in) {
        const idStrs = query._id.$in.map(String);
        filtered = filtered.filter((u) => idStrs.includes(String(u._id)));
      }
      return createChainable(() => filtered);
    };

    Payment.find = (query) => {
      let filtered = payments.slice();
      if (query?.paymentType) filtered = filtered.filter((p) => p.paymentType === query.paymentType);
      if (query?.status) filtered = filtered.filter((p) => p.status === query.status);
      if (query?.date) filtered = filtered.filter((p) => matchDateRange(p.date, query.date));
      return createChainable(() => filtered);
    };

    SalesReturn.find = (query) => {
      let filtered = salesReturns.slice();
      if (query?.businessId) filtered = filtered.filter((r) => String(r.businessId) === String(query.businessId));
      if (query?.status) {
        if (query.status.$in) filtered = filtered.filter((r) => query.status.$in.includes(r.status));
        else filtered = filtered.filter((r) => r.status === query.status);
      }
      return createChainable(() => filtered);
    };

    GoodsReceiptNote.find = (query) => {
      let filtered = grns.slice();
      if (query?.businessId) filtered = filtered.filter((g) => String(g.businessId) === String(query.businessId));
      if (query?.status?.$nin) filtered = filtered.filter((g) => !query.status.$nin.includes(g.status));
      return createChainable(() => filtered);
    };

    PurchaseReturn.find = (query) => {
      let filtered = purchaseReturns.slice();
      if (query?.businessId) filtered = filtered.filter((pr) => String(pr.businessId) === String(query.businessId));
      if (query?.status?.$nin) filtered = filtered.filter((pr) => !query.status.$nin.includes(pr.status));
      return createChainable(() => filtered);
    };

    Vendor.find = (query) => {
      let filtered = vendors.slice();
      if (query?._id?.$in) {
        const idStrs = query._id.$in.map(String);
        filtered = filtered.filter((v) => idStrs.includes(String(v._id)));
      }
      return createChainable(() => filtered);
    };

    PrincipalCompany.find = (query) => {
      let filtered = principalCompanies.slice();
      if (query?._id?.$in) {
        const idStrs = query._id.$in.map(String);
        filtered = filtered.filter((p) => idStrs.includes(String(p._id)));
      }
      return createChainable(() => filtered);
    };

    InventoryBalance.find = (query) => {
      let filtered = inventoryBalances.slice();
      if (query?.businessId) filtered = filtered.filter((ib) => String(ib.businessId) === String(query.businessId));
      if (query?.dealershipId) filtered = filtered.filter((ib) => String(ib.dealershipId) === String(query.dealershipId));
      return createChainable(() => filtered);
    };
  });

  test("1. Product Intelligence: Sales, actual COGS, gross margins, and return rate calculation", async () => {
    dealerships.push({ _id: dId1, businessId: bId, name: "Dhaka Central", code: "DHK" });
    const dealershipMap = new Map([[String(dId1), { name: "Dhaka Central", code: "DHK" }]]);

    const now = new Date();
    orders.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      dealershipId: dId1,
      orderDate: now,
      orderStatus: "delivered",
      subtotal: 20000,
      totalAmount: 20000,
      items: [
        {
          productId: prodId1,
          name: "Synthetic Motor Oil",
          sku: "OIL-SYN",
          quantity: 20,
          unitPrice: 1000,
          costPrice: 600,
          totalPrice: 20000,
        },
      ],
    });

    salesReturns.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      dealershipId: dId1,
      status: "approved",
      createdAt: now,
      items: [{ productId: prodId1, quantity: 2, returnedQuantity: 2 }],
    });

    inventoryBalances.push({
      businessId: bId,
      dealershipId: dId1,
      productId: prodId1,
      availableQuantity: 50,
    });

    const result = await ProductIntelligenceService.getProductIntelligence({
      businessId: bId,
      dateFilter: { startDate: new Date(now.getTime() - 86400000), endDate: new Date(now.getTime() + 86400000) },
      canViewCosts: true,
      dealershipMap,
    });

    assert.strictEqual(result.products.length, 1);
    const prod = result.products[0];
    assert.strictEqual(prod.quantitySold, 20);
    assert.strictEqual(prod.netRevenue, 20000);
    assert.strictEqual(prod.costOfGoodsSold, 12000);
    assert.strictEqual(prod.grossProfit, 8000);
    assert.strictEqual(prod.grossMarginPercentage, 40);
    assert.strictEqual(prod.returnedQuantity, 2);
    assert.strictEqual(prod.returnRatePercentage, 10);
  });

  test("2. Customer Intelligence: Deterministic INACTIVE vs AT_RISK priority and safe creditLimit handling", async () => {
    dealerships.push({ _id: dId1, businessId: bId, name: "Dhaka Central", code: "DHK" });
    const dealershipMap = new Map([[String(dId1), { name: "Dhaka Central", code: "DHK" }]]);

    const now = new Date();
    customers.push(
      { _id: custId1, businessId: bId, name: "Active VIP", shopName: "VIP Motors", phone: "01711111111" },
      { _id: custId2, businessId: bId, name: "Lapsed Customer", shopName: "Lapsed Shop", phone: "01722222222" },
      { _id: custId3, businessId: bId, name: "At Risk Customer", shopName: "At Risk Shop", phone: "01733333333" },
      { _id: custId4, businessId: bId, name: "Zero Credit Limit", shopName: "Unrestricted Shop", phone: "01744444444" }
    );

    customerAccounts.push(
      { customerId: custId1, businessId: bId, dealershipId: dId1, creditLimit: 200000, currentBalance: 50000, totalInvoiced: 150000, totalCollected: 100000 },
      { customerId: custId2, businessId: bId, dealershipId: dId1, creditLimit: 100000, currentBalance: 20000, totalInvoiced: 50000, totalCollected: 30000 },
      { customerId: custId3, businessId: bId, dealershipId: dId1, creditLimit: 80000, currentBalance: 15000, totalInvoiced: 40000, totalCollected: 25000 },
      // Edge Case: creditLimit is 0 or negative
      { customerId: custId4, businessId: bId, dealershipId: dId1, creditLimit: 0, currentBalance: 60000, totalInvoiced: 60000, totalCollected: 0 }
    );

    // Active VIP: ordered 2 days ago
    orders.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      dealershipId: dId1,
      customerId: custId1,
      orderDate: new Date(now.getTime() - 2 * 86400000),
      orderStatus: "delivered",
      subtotal: 120000,
      totalAmount: 120000,
      items: [],
    });

    // Lapsed Customer: ordered 75 days ago (>= inactive threshold 60) -> MUST be INACTIVE (not AT_RISK!)
    orders.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      dealershipId: dId1,
      customerId: custId2,
      orderDate: new Date(now.getTime() - 75 * 86400000),
      orderStatus: "delivered",
      subtotal: 50000,
      totalAmount: 50000,
      items: [],
    });

    // At Risk Customer: ordered 50 days ago (> 45 and < 60) -> MUST be AT_RISK
    orders.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      dealershipId: dId1,
      customerId: custId3,
      orderDate: new Date(now.getTime() - 50 * 86400000),
      orderStatus: "delivered",
      subtotal: 40000,
      totalAmount: 40000,
      items: [],
    });

    const result = await CustomerIntelligenceService.getCustomerIntelligence({
      businessId: bId,
      dateFilter: { startDate: new Date(now.getTime() - 90 * 86400000), endDate: now },
      inactiveDaysThreshold: 60,
      dealershipMap,
    });

    const vip = result.customers.find((c) => c.customerId === String(custId1));
    const lapsed = result.customers.find((c) => c.customerId === String(custId2));
    const atRisk = result.customers.find((c) => c.customerId === String(custId3));
    const noLimit = result.customers.find((c) => c.customerId === String(custId4));

    assert.strictEqual(vip?.segment, "VIP");
    assert.strictEqual(vip?.creditUtilizationPercentage, 25);

    // Deterministic hierarchy check: 75 days dormancy MUST classify as INACTIVE despite having past orders
    assert.strictEqual(lapsed?.segment, "INACTIVE");
    assert.strictEqual(lapsed?.daysSinceLastOrder, 75);

    // 50 days dormancy classifies as AT_RISK
    assert.strictEqual(atRisk?.segment, "AT_RISK");
    assert.strictEqual(atRisk?.daysSinceLastOrder, 50);

    // Edge case: creditLimit <= 0 returns null (N/A) rather than dividing by zero or claiming 0%
    assert.strictEqual(noLimit?.creditUtilizationPercentage, null);
    assert.strictEqual(noLimit?.creditLimit, 0);
  });

  test("3. Salesman Performance: Penalty applies to entire score with 0%, 50%, and 100% cancellation tests", async () => {
    dealerships.push({ _id: dId1, businessId: bId, name: "Dhaka Central", code: "DHK" });
    const dealershipMap = new Map([[String(dId1), { name: "Dhaka Central", code: "DHK" }]]);

    users.push(
      { _id: salesmanId1, name: "Perfect Ali (0% Cancel)", email: "ali@erp.com" },
      { _id: salesmanId2, name: "Half Basher (50% Cancel)", email: "basher@erp.com" },
      { _id: salesmanId3, name: "All Cancelled (100% Cancel)", email: "cancelled@erp.com" }
    );

    const now = new Date();
    const ord1Id = new mongoose.Types.ObjectId();
    const ord2Id = new mongoose.Types.ObjectId();

    // 1. Salesman 1: Booked 100k, Fulfilled 100k, Collected 80k, 0 Cancellations (0%)
    // Base score = (100k * 0.5 + 80k * 0.5) = 90,000. Cancellation factor = 1.0 -> 90,000
    orders.push({
      _id: ord1Id,
      businessId: bId,
      dealershipId: dId1,
      salesmanId: salesmanId1,
      orderDate: now,
      orderStatus: "delivered",
      subtotal: 100000,
      totalAmount: 100000,
      items: [],
    });

    // 2. Salesman 2: 1 Booked (100k), 1 Cancelled (100k) -> Cancellation Rate = 50%
    // Fulfilled 100k, Collected 80k.
    // Whole score penalty: (100k * 0.5 + 80k * 0.5) * 0.5 = 45,000
    orders.push(
      {
        _id: ord2Id,
        businessId: bId,
        dealershipId: dId1,
        salesmanId: salesmanId2,
        orderDate: now,
        orderStatus: "delivered",
        subtotal: 100000,
        totalAmount: 100000,
        items: [],
      },
      {
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        dealershipId: dId1,
        salesmanId: salesmanId2,
        orderDate: now,
        orderStatus: "cancelled",
        subtotal: 100000,
        totalAmount: 100000,
        items: [],
      }
    );

    // 3. Salesman 3: 0 Booked, 1 Cancelled (100k) -> Cancellation Rate = 100% -> Score must be 0
    orders.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      dealershipId: dId1,
      salesmanId: salesmanId3,
      orderDate: now,
      orderStatus: "cancelled",
      subtotal: 100000,
      totalAmount: 100000,
      items: [],
    });

    payments.push(
      { paymentType: "customer_receipt", status: "verified", date: now, allocations: [{ invoiceId: ord1Id, amountAllocated: 80000 }] },
      { paymentType: "customer_receipt", status: "verified", date: now, allocations: [{ invoiceId: ord2Id, amountAllocated: 80000 }] }
    );

    const result = await SalesmanPerformanceService.getSalesmanPerformance({
      businessId: bId,
      dateFilter: { startDate: new Date(now.getTime() - 86400000), endDate: new Date(now.getTime() + 86400000) },
      dealershipMap,
    });

    const ali = result.salesmen.find((s) => s.salesmanId === String(salesmanId1));
    const basher = result.salesmen.find((s) => s.salesmanId === String(salesmanId2));
    const zeroMan = result.salesmen.find((s) => s.salesmanId === String(salesmanId3));

    // 0% cancellation test
    assert.strictEqual(ali?.cancellationRatePercentage, 0);
    assert.strictEqual(ali?.compositeScore, 90000); // (100k*0.5 + 80k*0.5) * 1.0

    // 50% cancellation test: entire weighted performance is penalized by 50%
    assert.strictEqual(basher?.cancellationRatePercentage, 50);
    assert.strictEqual(basher?.compositeScore, 45000); // (100k*0.5 + 80k*0.5) * 0.5

    // 100% cancellation test
    assert.strictEqual(zeroMan?.cancellationRatePercentage, 100);
    assert.strictEqual(zeroMan?.compositeScore, 0);
  });

  test("4. Supplier Intelligence: Zero or missing challan quantities return null shortage rate safely", async () => {
    vendors.push(
      { _id: vendorId1, name: "Normal Supplier" },
      { _id: custId1, name: "Missing Challan Supplier" }
    );

    const now = new Date();
    grns.push(
      {
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        dealershipId: dId1,
        vendorId: vendorId1,
        supplierId: vendorId1,
        status: "VERIFIED",
        createdAt: now,
        items: [
          {
            productName: "5W30 Oil",
            sku: "5W30",
            challanQuantity: 100,
            receivedQuantity: 95,
            shortageQuantity: 5,
            unitPurchasePrice: 800,
            lineTotal: 76000,
          },
        ],
      },
      // Missing / Zero Challan Quantity GRN
      {
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        dealershipId: dId1,
        vendorId: custId1,
        supplierId: custId1,
        status: "VERIFIED",
        createdAt: now,
        items: [
          {
            productName: "Manual Adjustment Stock",
            sku: "MAN-01",
            challanQuantity: 0, // Zero challan quantity
            receivedQuantity: 10,
            shortageQuantity: 0,
            unitPurchasePrice: 500,
            lineTotal: 5000,
          },
        ],
      }
    );

    const result = await SupplierIntelligenceService.getSupplierIntelligence({
      businessId: bId,
      dateFilter: { startDate: new Date(now.getTime() - 86400000), endDate: new Date(now.getTime() + 86400000) },
      canViewCosts: true,
    });

    const normal = result.suppliers.find((s) => s.vendorId === String(vendorId1));
    const zeroChallan = result.suppliers.find((s) => s.vendorId === String(custId1));

    assert.strictEqual(normal?.shortageRatePercentage, 5); // 5 / 100 = 5%
    // Division-by-zero avoided: returns null instead of NaN or 0
    assert.strictEqual(zeroChallan?.shortageRatePercentage, null);
  });

  test("5. Demand Intelligence: Safety stock policy and aligned dealership-scoped history and stock", async () => {
    products.push({
      _id: prodId1,
      businessId: bId,
      name: "Spark Plug",
      sku: "SPK-1",
      minStock: 25,
      status: "active",
    });

    const now = new Date();
    const startDate = new Date(now.getTime() - 10 * 86400000);

    // Sales scoped to Dealership 1
    orders.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      dealershipId: dId1,
      orderDate: now,
      orderStatus: "delivered",
      items: [{ productId: prodId1, quantity: 70 }], // 7 units/day in 10 days
    });

    // Available stock scoped to Dealership 1
    inventoryBalances.push({
      businessId: bId,
      dealershipId: dId1,
      productId: prodId1,
      availableQuantity: 30,
    });

    const result = await DemandIntelligenceService.getDemandForecasts({
      businessId: bId,
      dealershipId: dId1,
      dateFilter: { startDate, endDate: now },
    });

    assert.strictEqual(result.forecasts.length, 1);
    const f = result.forecasts[0];
    assert.strictEqual(f.historicalUnitsSold, 70);
    assert.strictEqual(f.dailyRunRate, 7);
    assert.strictEqual(f.leadTimeDays, 7); // Preserved 7-day lead-time assumption
    assert.strictEqual(f.minStockThreshold, 25); // Baseline safety stock buffer
    // Reorder Point = (7 dailyRunRate * 7 leadTimeDays) + 25 safety stock buffer = 49 + 25 = 74
    // Suggested Reorder Qty = 74 - 30 available = 44 (Safety stock buffer NOT doubled)
    assert.strictEqual(f.reorderPoint, 74);
    assert.strictEqual(f.suggestedReorderQuantity, 44);
    assert.strictEqual(f.isStatisticalEstimate, true);
  });
});
