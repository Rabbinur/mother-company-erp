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
  const salesmanId1 = new mongoose.Types.ObjectId();
  const salesmanId2 = new mongoose.Types.ObjectId();

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

    // Helper for matching date ranges
    const matchDateRange = (itemDate, range) => {
      if (!range || !itemDate) return true;
      const d = new Date(itemDate).getTime();
      if (range.$gte && d < new Date(range.$gte).getTime()) return false;
      if (range.$lte && d > new Date(range.$lte).getTime()) return false;
      return true;
    };

    // Mock Dealership
    Dealership.find = (query) => {
      let filtered = dealerships.slice();
      if (query?.businessId) filtered = filtered.filter((d) => String(d.businessId) === String(query.businessId));
      return createChainable(() => filtered);
    };

    // Mock Order
    Order.find = (query) => {
      let filtered = orders.slice();
      if (query?.businessId) filtered = filtered.filter((o) => String(o.businessId) === String(query.businessId));
      if (query?.dealershipId) filtered = filtered.filter((o) => String(o.dealershipId) === String(query.dealershipId));
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

    // Mock Product
    Product.find = (query) => {
      let filtered = products.slice();
      if (query?.businessId) filtered = filtered.filter((p) => String(p.businessId) === String(query.businessId));
      if (query?._id?.$in) {
        const idStrs = query._id.$in.map(String);
        filtered = filtered.filter((p) => idStrs.includes(String(p._id)));
      }
      return createChainable(() => filtered);
    };

    // Mock Customer
    Customer.find = (query) => {
      let filtered = customers.slice();
      if (query?.businessId) filtered = filtered.filter((c) => String(c.businessId) === String(query.businessId));
      if (query?._id?.$in) {
        const idStrs = query._id.$in.map(String);
        filtered = filtered.filter((c) => idStrs.includes(String(c._id)));
      }
      return createChainable(() => filtered);
    };

    // Mock CustomerDealershipAccount
    CustomerDealershipAccount.find = (query) => {
      let filtered = customerAccounts.slice();
      if (query?.businessId) filtered = filtered.filter((c) => !c.businessId || String(c.businessId) === String(query.businessId));
      if (query?.dealershipId) filtered = filtered.filter((c) => String(c.dealershipId) === String(query.dealershipId));
      return createChainable(() => filtered);
    };

    // Mock User
    User.find = (query) => {
      let filtered = users.slice();
      if (query?._id?.$in) {
        const idStrs = query._id.$in.map(String);
        filtered = filtered.filter((u) => idStrs.includes(String(u._id)));
      }
      return createChainable(() => filtered);
    };

    // Mock Payment
    Payment.find = (query) => {
      let filtered = payments.slice();
      if (query?.paymentType) filtered = filtered.filter((p) => p.paymentType === query.paymentType);
      if (query?.status) filtered = filtered.filter((p) => p.status === query.status);
      if (query?.date) filtered = filtered.filter((p) => matchDateRange(p.date, query.date));
      return createChainable(() => filtered);
    };

    // Mock SalesReturn
    SalesReturn.find = (query) => {
      let filtered = salesReturns.slice();
      if (query?.businessId) filtered = filtered.filter((r) => String(r.businessId) === String(query.businessId));
      if (query?.status) {
        if (query.status.$in) filtered = filtered.filter((r) => query.status.$in.includes(r.status));
        else filtered = filtered.filter((r) => r.status === query.status);
      }
      return createChainable(() => filtered);
    };

    // Mock GoodsReceiptNote
    GoodsReceiptNote.find = (query) => {
      let filtered = grns.slice();
      if (query?.businessId) filtered = filtered.filter((g) => String(g.businessId) === String(query.businessId));
      if (query?.status?.$nin) filtered = filtered.filter((g) => !query.status.$nin.includes(g.status));
      return createChainable(() => filtered);
    };

    // Mock PurchaseReturn
    PurchaseReturn.find = (query) => {
      let filtered = purchaseReturns.slice();
      if (query?.businessId) filtered = filtered.filter((pr) => String(pr.businessId) === String(query.businessId));
      if (query?.status?.$nin) filtered = filtered.filter((pr) => !query.status.$nin.includes(pr.status));
      return createChainable(() => filtered);
    };

    // Mock Vendor
    Vendor.find = (query) => {
      let filtered = vendors.slice();
      if (query?._id?.$in) {
        const idStrs = query._id.$in.map(String);
        filtered = filtered.filter((v) => idStrs.includes(String(v._id)));
      }
      return createChainable(() => filtered);
    };

    // Mock PrincipalCompany
    PrincipalCompany.find = (query) => {
      let filtered = principalCompanies.slice();
      if (query?._id?.$in) {
        const idStrs = query._id.$in.map(String);
        filtered = filtered.filter((p) => idStrs.includes(String(p._id)));
      }
      return createChainable(() => filtered);
    };

    // Mock InventoryBalance
    InventoryBalance.find = (query) => {
      let filtered = inventoryBalances.slice();
      if (query?.businessId) filtered = filtered.filter((ib) => String(ib.businessId) === String(query.businessId));
      return createChainable(() => filtered);
    };
  });

  test("1. Product Intelligence: Sales, actual COGS, gross margins, and return rate calculation", async () => {
    dealerships.push({ _id: dId1, businessId: bId, name: "Dhaka Central", code: "DHK" });
    const dealershipMap = new Map();
    dealershipMap.set(String(dId1), { name: "Dhaka Central", code: "DHK" });

    const now = new Date();
    // Order: 20 units of Product 1 (price 1000, cost 600) = 20,000 rev, 12,000 cost
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

    // Returns: 2 units of Product 1 returned
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
    assert.strictEqual(prod.grossProfit, 8000); // 20000 - 12000
    assert.strictEqual(prod.grossMarginPercentage, 40); // (8000 / 20000) * 100
    assert.strictEqual(prod.returnedQuantity, 2);
    assert.strictEqual(prod.returnRatePercentage, 10); // (2 / 20) * 100
  });

  test("2. Customer Intelligence: RFM segmentation, recency, credit utilization and inactive tracking", async () => {
    dealerships.push({ _id: dId1, businessId: bId, name: "Dhaka Central", code: "DHK" });
    const dealershipMap = new Map();
    dealershipMap.set(String(dId1), { name: "Dhaka Central", code: "DHK" });

    const now = new Date();
    customers.push(
      { _id: custId1, businessId: bId, name: "VIP Motors", shopName: "VIP Motors Shop", phone: "01711111111" },
      { _id: custId2, businessId: bId, name: "Dormant Retailer", shopName: "Dormant Shop", phone: "01722222222" }
    );

    customerAccounts.push(
      { customerId: custId1, businessId: bId, dealershipId: dId1, creditLimit: 200000, currentBalance: 50000, totalInvoiced: 150000, totalCollected: 100000 },
      { customerId: custId2, businessId: bId, dealershipId: dId1, creditLimit: 100000, currentBalance: 0, totalInvoiced: 10000, totalCollected: 10000 }
    );

    // Order for VIP: 120,000 spend
    orders.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      dealershipId: dId1,
      customerId: custId1,
      orderDate: new Date(now.getTime() - 2 * 86400000), // 2 days ago
      orderStatus: "delivered",
      subtotal: 120000,
      totalAmount: 120000,
      items: [],
    });

    const result = await CustomerIntelligenceService.getCustomerIntelligence({
      businessId: bId,
      dateFilter: { startDate: new Date(now.getTime() - 30 * 86400000), endDate: now },
      inactiveDaysThreshold: 60,
      dealershipMap,
    });

    assert.strictEqual(result.customers.length, 2);
    const vip = result.customers.find((c) => c.customerId === String(custId1));
    const dormant = result.customers.find((c) => c.customerId === String(custId2));

    assert.strictEqual(vip?.segment, "VIP");
    assert.strictEqual(vip?.totalSpent, 120000);
    assert.strictEqual(vip?.daysSinceLastOrder, 2);
    assert.strictEqual(vip?.creditUtilizationPercentage, 25); // 50000 / 200000 = 25%

    assert.strictEqual(dormant?.segment, "INACTIVE");
    assert.strictEqual(dormant?.ordersCount, 0);
  });

  test("3. Salesman Performance: Composite ranking factoring fulfillment and collection rates", async () => {
    dealerships.push({ _id: dId1, businessId: bId, name: "Dhaka Central", code: "DHK" });
    const dealershipMap = new Map();
    dealershipMap.set(String(dId1), { name: "Dhaka Central", code: "DHK" });

    users.push(
      { _id: salesmanId1, name: "Ali Ahmed", email: "ali@erp.com" },
      { _id: salesmanId2, name: "Basher Khan", email: "basher@erp.com" }
    );

    const now = new Date();
    const ord1Id = new mongoose.Types.ObjectId();
    const ord2Id = new mongoose.Types.ObjectId();

    // Salesman 1: Booked 100,000, Fulfilled 100,000, Collected 80,000, 0 Cancellations
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

    // Salesman 2: Booked 200,000, Cancelled 150,000, Fulfilled 50,000, Collected 10,000
    orders.push(
      {
        _id: ord2Id,
        businessId: bId,
        dealershipId: dId1,
        salesmanId: salesmanId2,
        orderDate: now,
        orderStatus: "delivered",
        subtotal: 50000,
        totalAmount: 50000,
        items: [],
      },
      {
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        dealershipId: dId1,
        salesmanId: salesmanId2,
        orderDate: now,
        orderStatus: "cancelled",
        subtotal: 150000,
        totalAmount: 150000,
        items: [],
      }
    );

    // Payments for ord1
    payments.push({
      paymentType: "customer_receipt",
      status: "verified",
      date: now,
      allocations: [{ invoiceId: ord1Id, amountAllocated: 80000 }],
    });

    const result = await SalesmanPerformanceService.getSalesmanPerformance({
      businessId: bId,
      dateFilter: { startDate: new Date(now.getTime() - 86400000), endDate: new Date(now.getTime() + 86400000) },
      dealershipMap,
    });

    assert.strictEqual(result.salesmen.length, 2);
    const ali = result.salesmen.find((s) => s.salesmanId === String(salesmanId1));
    const basher = result.salesmen.find((s) => s.salesmanId === String(salesmanId2));

    assert.strictEqual(ali?.fulfilledSalesAmount, 100000);
    assert.strictEqual(ali?.collectedAmount, 80000);
    assert.strictEqual(ali?.cancellationRatePercentage, 0);
    // Ali should be ranked #1 despite Basher booking 200,000 because of fulfillment & collection
    assert.strictEqual(ali?.performanceRank, 1);
    assert.ok(ali?.compositeScore > basher?.compositeScore);
  });

  test("4. Supplier Intelligence: Volumes, shortage rates, and historical price trends", async () => {
    vendors.push({ _id: vendorId1, name: "Apex Lubricants Ltd" });
    principalCompanies.push({ _id: pcId1, name: "Shell International" });

    const now = new Date();
    grns.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      dealershipId: dId1,
      vendorId: vendorId1,
      principalCompanyId: pcId1,
      status: "VERIFIED",
      createdAt: now,
      items: [
        {
          productName: "Premium 5W30",
          sku: "5W30-1L",
          challanQuantity: 100,
          receivedQuantity: 95,
          shortageQuantity: 5,
          unitPurchasePrice: 800,
          netLandedUnitCost: 820,
          lineTotal: 76000, // 95 * 800
        },
      ],
    });

    // Purchase return: 5,000 debit
    purchaseReturns.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      dealershipId: dId1,
      vendorId: vendorId1,
      status: "SETTLED",
      createdAt: now,
      totalDebitAmount: 5000,
    });

    const result = await SupplierIntelligenceService.getSupplierIntelligence({
      businessId: bId,
      dateFilter: { startDate: new Date(now.getTime() - 86400000), endDate: new Date(now.getTime() + 86400000) },
      canViewCosts: true,
    });

    assert.strictEqual(result.suppliers.length, 1);
    const sup = result.suppliers[0];
    assert.strictEqual(sup.vendorName, "Apex Lubricants Ltd");
    assert.strictEqual(sup.totalPurchasedQuantity, 95);
    assert.strictEqual(sup.totalShortageQuantity, 5);
    assert.strictEqual(sup.shortageRatePercentage, 5); // (5 / 100) * 100
    assert.strictEqual(sup.purchaseReturnAmount, 5000);
    assert.strictEqual(sup.historicalPriceTrends.length, 1);
    assert.strictEqual(sup.historicalPriceTrends[0].landedUnitCost, 820);
  });

  test("5. Demand Intelligence: Sales velocity, days of supply, and statistical reorder alerts", async () => {
    products.push({
      _id: prodId1,
      businessId: bId,
      name: "Standard Spark Plug",
      sku: "SPK-001",
      minStock: 20,
      status: "active",
    });

    const now = new Date();
    // In a 10-day period, 100 units sold => daily run rate = 10 units/day
    const startDate = new Date(now.getTime() - 10 * 86400000);
    orders.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      dealershipId: dId1,
      orderDate: now,
      orderStatus: "delivered",
      items: [{ productId: prodId1, quantity: 100 }],
    });

    // Current available stock is only 15 units (<= minStock 20)
    inventoryBalances.push({
      businessId: bId,
      productId: prodId1,
      availableQuantity: 15,
    });

    const result = await DemandIntelligenceService.getDemandForecasts({
      businessId: bId,
      dateFilter: { startDate, endDate: now },
    });

    assert.strictEqual(result.forecasts.length, 1);
    const f = result.forecasts[0];
    assert.strictEqual(f.historicalUnitsSold, 100);
    assert.strictEqual(f.dailyRunRate, 10);
    assert.strictEqual(f.projected30DayDemand, 300); // 10 * 30
    assert.strictEqual(f.currentAvailableStock, 15);
    // Days of supply: 15 / 10 = ~2 days (Critical!)
    assert.strictEqual(f.daysOfSupply, 2);
    assert.strictEqual(f.stockStatus, "CRITICAL");
    // Reorder Point = (10 run rate * 7 lead time) + 20 minStock = 90
    // Suggested Reorder = 90 - 15 = 75 units
    assert.strictEqual(f.suggestedReorderQuantity, 75);
    assert.strictEqual(f.isStatisticalEstimate, true);
  });

  test("6. Operational Analytics Orchestrator: Comprehensive payload and cost masking safety", async () => {
    dealerships.push({ _id: dId1, businessId: bId, name: "Dhaka Central", code: "DHK" });
    products.push({ _id: prodId1, businessId: bId, name: "Oil Filter", sku: "FLT-01", status: "active" });

    const now = new Date();
    orders.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      dealershipId: dId1,
      orderDate: now,
      orderStatus: "delivered",
      subtotal: 5000,
      totalAmount: 5000,
      items: [{ productId: prodId1, quantity: 5, unitPrice: 1000, costPrice: 700 }],
    });

    // Query with cost masking active (canViewCosts: false)
    const payload = await OperationalAnalyticsService.getOperationalAnalytics({
      businessId: String(bId),
      canViewCosts: false,
    });

    assert.ok(payload.productIntelligence);
    assert.ok(payload.customerIntelligence);
    assert.ok(payload.salesmanPerformance);
    assert.ok(payload.supplierIntelligence);
    assert.ok(payload.demandIntelligence);

    // Verify costs masked
    assert.strictEqual(payload.productIntelligence.products[0].costOfGoodsSold, 0);
    assert.strictEqual(payload.productIntelligence.products[0].grossProfit, 0);
  });
});
