import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

// Models
import { Order } from "../src/models/Order.ts";
import { JournalEntry } from "../src/models/JournalEntry.ts";
import { Account } from "../src/models/Account.ts";
import { InventoryBalance } from "../src/models/InventoryBalance.ts";
import { StockBatch } from "../src/models/StockBatch.ts";
import { CustomerDealershipAccount } from "../src/models/CustomerDealershipAccount.ts";
import { SupplierPayable } from "../src/models/SupplierPayable.ts";
import { Dealership } from "../src/models/Dealership.ts";
import { Product } from "../src/models/Product.ts";
import { Customer } from "../src/models/Customer.ts";
import { SalesReturn } from "../src/models/SalesReturn.ts";

// Service under test
import { ExecutiveDashboardService } from "../src/services/ExecutiveDashboardService.ts";

describe("Phase 4 - Step 1: Executive Dashboard & Business Analytics Test Suite", () => {
  let orders = [];
  let journalEntries = [];
  let accounts = [];
  let inventoryBalances = [];
  let stockBatches = [];
  let customerAccounts = [];
  let supplierPayables = [];
  let dealerships = [];
  let products = [];
  let customers = [];
  let salesReturns = [];

  const bId = new mongoose.Types.ObjectId();
  const dId1 = new mongoose.Types.ObjectId();
  const dId2 = new mongoose.Types.ObjectId();
  const pcId1 = new mongoose.Types.ObjectId();
  const custId1 = new mongoose.Types.ObjectId();
  const custId2 = new mongoose.Types.ObjectId();
  const prodId1 = new mongoose.Types.ObjectId();
  const prodId2 = new mongoose.Types.ObjectId();
  const varId1 = new mongoose.Types.ObjectId();
  const varId2 = new mongoose.Types.ObjectId();

  beforeEach(() => {
    orders = [];
    journalEntries = [];
    accounts = [];
    inventoryBalances = [];
    stockBatches = [];
    customerAccounts = [];
    supplierPayables = [];
    dealerships = [];
    products = [];
    customers = [];
    salesReturns = [];

    const createChainable = (getItems) => {
      const chain = {
        populate: () => chain,
        sort: (sortObj) => {
          const items = getItems();
          if (sortObj?.orderDate || sortObj?.createdAt) {
            items.sort((a, b) => new Date(a.orderDate || a.createdAt || 0) - new Date(b.orderDate || b.createdAt || 0));
          }
          return chain;
        },
        limit: (n) => {
          const items = getItems();
          return Promise.resolve(items.slice(0, n));
        },
        lean: () => Promise.resolve(getItems()),
        then: (resolve, reject) => Promise.resolve(getItems()).then(resolve, reject),
      };
      return chain;
    };

    // Mock Dealership
    Dealership.find = (query) => {
      let filtered = dealerships.slice();
      if (query?.businessId) filtered = filtered.filter((d) => String(d.businessId) === String(query.businessId));
      if (query?.status) filtered = filtered.filter((d) => d.status === query.status);
      if (query?._id) {
        if (query._id.$in) {
          const idStrs = query._id.$in.map(String);
          filtered = filtered.filter((d) => idStrs.includes(String(d._id)));
        } else {
          filtered = filtered.filter((d) => String(d._id) === String(query._id));
        }
      }
      return createChainable(() => filtered);
    };

    Dealership.countDocuments = async (query) => {
      let filtered = dealerships.slice();
      if (query?.businessId) filtered = filtered.filter((d) => String(d.businessId) === String(query.businessId));
      if (query?.status) filtered = filtered.filter((d) => d.status === query.status);
      return filtered.length;
    };

    // Helper for matching date ranges
    const matchDateRange = (itemDate, range) => {
      if (!range || !itemDate) return true;
      const d = new Date(itemDate).getTime();
      if (range.$gte && d < new Date(range.$gte).getTime()) return false;
      if (range.$lte && d > new Date(range.$lte).getTime()) return false;
      return true;
    };

    // Mock Order
    Order.find = (query) => {
      let filtered = orders.slice();
      if (query?.businessId) filtered = filtered.filter((o) => String(o.businessId) === String(query.businessId));
      if (query?.dealershipId) filtered = filtered.filter((o) => String(o.dealershipId) === String(query.dealershipId));
      if (query?.principalCompanyId) filtered = filtered.filter((o) => String(o.principalCompanyId) === String(query.principalCompanyId));

      // Handle date filters from query ($and / $or / direct)
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
      } else if (query?.fulfilledDate) {
        filtered = filtered.filter((o) => matchDateRange(o.fulfilledDate || o.orderDate, query.fulfilledDate));
      } else if (query?.orderDate) {
        filtered = filtered.filter((o) => matchDateRange(o.orderDate, query.orderDate));
      }

      return createChainable(() => filtered);
    };

    // Mock CustomerDealershipAccount
    CustomerDealershipAccount.find = (query) => {
      let filtered = customerAccounts.slice();
      if (query?.businessId) filtered = filtered.filter((c) => !c.businessId || String(c.businessId) === String(query.businessId));
      if (query?.dealershipId) {
        if (query.dealershipId.$in) {
          const idStrs = query.dealershipId.$in.map(String);
          filtered = filtered.filter((c) => idStrs.includes(String(c.dealershipId)));
        } else {
          filtered = filtered.filter((c) => String(c.dealershipId) === String(query.dealershipId));
        }
      }
      return createChainable(() => filtered);
    };

    // Mock SupplierPayable
    SupplierPayable.find = (query) => {
      let filtered = supplierPayables.slice();
      if (query?.businessId) filtered = filtered.filter((p) => String(p.businessId) === String(query.businessId));
      if (query?.dealershipId) filtered = filtered.filter((p) => String(p.dealershipId) === String(query.dealershipId));
      if (query?.principalCompanyId) filtered = filtered.filter((p) => String(p.principalCompanyId) === String(query.principalCompanyId));
      return createChainable(() => filtered);
    };

    // Mock StockBatch
    StockBatch.find = (query) => {
      let filtered = stockBatches.slice();
      if (query?.businessId) filtered = filtered.filter((b) => String(b.businessId) === String(query.businessId));
      if (query?.dealershipId) filtered = filtered.filter((b) => String(b.dealershipId) === String(query.dealershipId));
      if (query?.principalCompanyId) filtered = filtered.filter((b) => String(b.principalCompanyId) === String(query.principalCompanyId));
      if (query?.status) {
        if (query.status.$in) {
          filtered = filtered.filter((b) => query.status.$in.includes(b.status));
        } else {
          filtered = filtered.filter((b) => b.status === query.status);
        }
      }
      if (query?.remainingQuantity?.$gt !== undefined) {
        filtered = filtered.filter((b) => b.remainingQuantity > query.remainingQuantity.$gt);
      }
      return createChainable(() => filtered);
    };

    // Mock InventoryBalance
    InventoryBalance.find = (query) => {
      let filtered = inventoryBalances.slice();
      if (query?.businessId) filtered = filtered.filter((ib) => String(ib.businessId) === String(query.businessId));
      if (query?.dealershipId) filtered = filtered.filter((ib) => String(ib.dealershipId) === String(query.dealershipId));
      return createChainable(() => filtered);
    };

    // Mock Account
    Account.find = (query) => {
      let filtered = accounts.slice();
      if (query?.businessId) filtered = filtered.filter((a) => String(a.businessId) === String(query.businessId));
      if (query?.$or) {
        filtered = filtered.filter((a) => {
          return query.$or.some((cond) => {
            if (cond.code) {
              if (cond.code.$in) return cond.code.$in.includes(a.code);
              return a.code === cond.code;
            }
            if (cond.category) return a.category === cond.category;
            if (cond.type) {
              if (cond.type.$in) return cond.type.$in.includes(a.type);
              return a.type === cond.type;
            }
            if (cond.subType) {
              if (cond.subType.$in) return cond.subType.$in.includes(a.subType);
              return a.subType === cond.subType;
            }
            if (cond.isSharedTreasury) return Boolean(a.isSharedTreasury);
            return false;
          });
        });
      }
      if (query?.code?.$ne) {
        filtered = filtered.filter((a) => a.code !== query.code.$ne);
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

    // Mock SalesReturn
    SalesReturn.find = (query) => {
      let filtered = salesReturns.slice();
      if (query?.businessId) filtered = filtered.filter((r) => String(r.businessId) === String(query.businessId));
      if (query?.dealershipId) filtered = filtered.filter((r) => String(r.dealershipId) === String(query.dealershipId));
      if (query?.status) filtered = filtered.filter((r) => r.status === query.status);
      if (query?.createdAt) {
        if (query.createdAt.$gte) filtered = filtered.filter((r) => new Date(r.createdAt) >= new Date(query.createdAt.$gte));
        if (query.createdAt.$lte) filtered = filtered.filter((r) => new Date(r.createdAt) <= new Date(query.createdAt.$lte));
      }
      return createChainable(() => filtered);
    };
  });

  test("1. Date range presets and prior period calculation are mathematically accurate", () => {
    // Test preset: today
    const rangeToday = ExecutiveDashboardService.parseDateRange("today");
    assert.ok(rangeToday.startDate <= rangeToday.endDate);
    assert.strictEqual(rangeToday.preset, "today");
    const curDurationToday = rangeToday.endDate.getTime() - rangeToday.startDate.getTime();
    const priorDurationToday = rangeToday.priorEndDate.getTime() - rangeToday.priorStartDate.getTime();
    assert.strictEqual(curDurationToday, priorDurationToday);

    // Test preset: last_30_days
    const range30 = ExecutiveDashboardService.parseDateRange("last_30_days");
    assert.strictEqual(range30.preset, "last_30_days");
    const diffDays = Math.round((range30.endDate.getTime() - range30.startDate.getTime()) / (1000 * 60 * 60 * 24));
    assert.strictEqual(diffDays, 30);
    const priorDiffDays = Math.round((range30.priorEndDate.getTime() - range30.priorStartDate.getTime()) / (1000 * 60 * 60 * 24));
    assert.strictEqual(priorDiffDays, 30);

    // Test preset: custom
    const customRange = ExecutiveDashboardService.parseDateRange("custom", "2026-05-01", "2026-05-10");
    assert.strictEqual(customRange.preset, "custom");
    assert.strictEqual(customRange.startDate.getFullYear(), 2026);
    assert.strictEqual(customRange.startDate.getMonth(), 4); // May (0-indexed)
    assert.strictEqual(customRange.startDate.getDate(), 1);
    assert.strictEqual(customRange.endDate.getFullYear(), 2026);
    assert.strictEqual(customRange.endDate.getMonth(), 4);
    assert.strictEqual(customRange.endDate.getDate(), 10);
  });

  test("2. Executive Overview KPIs: Gross sales, net sales, growth % and FIFO inventory valuation", async () => {
    dealerships.push(
      { _id: dId1, businessId: bId, name: "Dhaka Central", code: "DHK", status: "active" },
      { _id: dId2, businessId: bId, name: "Chittagong Hub", code: "CTG", status: "active" }
    );

    const now = new Date();
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const fortyDaysAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);

    // Current period order (gross: 10,000, discount: 500 => net: 9,500; cost: 6,000)
    orders.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      dealershipId: dId1,
      customerId: custId1,
      orderNumber: "ORD-001",
      orderDate: tenDaysAgo,
      deliveryStatus: "delivered",
      status: "delivered",
      subtotal: 10000,
      totalDiscount: 500,
      totalAmount: 9500,
      items: [
        {
          productId: prodId1,
          variantId: varId1,
          name: "Engine Oil 1L",
          sku: "OIL-1L",
          quantity: 10,
          unitPrice: 1000,
          costPrice: 600,
          totalPrice: 10000,
        },
      ],
    });

    // Prior period order (gross: 5,000)
    orders.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      dealershipId: dId1,
      customerId: custId1,
      orderNumber: "ORD-PRIOR",
      orderDate: fortyDaysAgo,
      deliveryStatus: "delivered",
      status: "delivered",
      subtotal: 5000,
      totalDiscount: 0,
      totalAmount: 5000,
      items: [],
    });

    // Customer Receivables (AR)
    customerAccounts.push(
      { dealershipId: dId1, customerId: custId1, currentBalance: 3500 },
      { dealershipId: dId2, customerId: custId2, currentBalance: 1500 }
    );

    // Supplier Payables (AP)
    supplierPayables.push(
      { businessId: bId, dealershipId: dId1, outstandingBalance: 4000 },
      { businessId: bId, dealershipId: dId2, outstandingBalance: 2000 }
    );

    // Active Stock Batches for FIFO landed cost valuation
    stockBatches.push(
      {
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        dealershipId: dId1,
        batchNumber: "BATCH-001",
        productId: prodId1,
        status: "active",
        remainingQuantity: 50,
        netLandedUnitCost: 600, // 50 * 600 = 30,000
      },
      {
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        dealershipId: dId2,
        batchNumber: "BATCH-002",
        productId: prodId2,
        status: "active",
        remainingQuantity: 20,
        netLandedUnitCost: 1000, // 20 * 1000 = 20,000
      }
    );

    const result = await ExecutiveDashboardService.getExecutiveDashboard({
      businessId: String(bId),
      periodPreset: "last_30_days",
      canViewCosts: true,
    });

    assert.strictEqual(result.overview.totalSales, 10000);
    assert.strictEqual(result.overview.netSales, 9500);
    assert.strictEqual(result.overview.grossProfit, 3500); // 9500 - 6000
    assert.strictEqual(result.overview.priorPeriodSales, 5000);
    // Sales Growth: ((10000 - 5000) / 5000) * 100 = 100%
    assert.strictEqual(result.overview.salesGrowthPercentage, 100);
    assert.strictEqual(result.overview.totalReceivables, 5000); // 3500 + 1500
    assert.strictEqual(result.overview.totalPayables, 6000); // 4000 + 2000
    assert.strictEqual(result.overview.inventoryValuation, 50000); // 30,000 + 20,000
    assert.strictEqual(result.overview.activeDealerships, 2);
  });

  test("3. Sales Analytics: Product rankings, customer rankings, and branch distributions", async () => {
    dealerships.push(
      { _id: dId1, businessId: bId, name: "Dhaka Central", code: "DHK", status: "active" },
      { _id: dId2, businessId: bId, name: "Chittagong Hub", code: "CTG", status: "active" }
    );
    customers.push(
      { _id: custId1, businessId: bId, name: "Rahim Auto", shopName: "Rahim Auto", phone: "01711111111" },
      { _id: custId2, businessId: bId, name: "Karim Motors", shopName: "Karim Motors", phone: "01722222222" }
    );
    customerAccounts.push(
      { dealershipId: dId1, customerId: custId1, currentBalance: 2000 },
      { dealershipId: dId2, customerId: custId2, currentBalance: 4000 }
    );

    const now = new Date();
    orders.push(
      {
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        dealershipId: dId1,
        customerId: custId1,
        orderDate: now,
        deliveryStatus: "delivered",
        subtotal: 15000,
        totalAmount: 15000,
        items: [
          {
            productId: prodId1,
            variantId: varId1,
            name: "Super Synthetic Oil",
            sku: "SYN-1L",
            quantity: 15,
            unitPrice: 1000,
            costPrice: 700,
            totalPrice: 15000,
          },
        ],
      },
      {
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        dealershipId: dId2,
        customerId: custId2,
        orderDate: now,
        deliveryStatus: "delivered",
        subtotal: 5000,
        totalAmount: 5000,
        items: [
          {
            productId: prodId2,
            variantId: varId2,
            name: "Brake Fluid",
            sku: "BRK-DOT4",
            quantity: 10,
            unitPrice: 500,
            costPrice: 300,
            totalPrice: 5000,
          },
        ],
      }
    );

    const result = await ExecutiveDashboardService.getExecutiveDashboard({
      businessId: String(bId),
      periodPreset: "last_30_days",
      canViewCosts: true,
    });

    // Check top products
    assert.strictEqual(result.sales.topProducts.length, 2);
    assert.strictEqual(result.sales.topProducts[0].sku, "SYN-1L");
    assert.strictEqual(result.sales.topProducts[0].revenue, 15000);
    assert.strictEqual(result.sales.topProducts[0].quantitySold, 15);

    // Check branch distribution: Total 20,000 -> DHK (75%), CTG (25%)
    const dhk = result.sales.dealershipComparison.find((d) => d.dealershipCode === "DHK");
    const ctg = result.sales.dealershipComparison.find((d) => d.dealershipCode === "CTG");
    assert.strictEqual(dhk?.sales, 15000);
    assert.strictEqual(dhk?.sharePercentage, 75);
    assert.strictEqual(ctg?.sales, 5000);
    assert.strictEqual(ctg?.sharePercentage, 25);

    // Check top customers
    assert.strictEqual(result.sales.topCustomers.length, 2);
    assert.strictEqual(result.sales.topCustomers[0].shopName, "Rahim Auto");
    assert.strictEqual(result.sales.topCustomers[0].totalSpent, 15000);
  });

  test("4. Financial Analytics: Shared Treasury segregation from dealership operating funds", async () => {
    dealerships.push(
      { _id: dId1, businessId: bId, name: "Dhaka Central", code: "DHK", status: "active" }
    );

    // GL Accounts
    accounts.push(
      // Central Mother Company Treasury (dealershipId === null)
      {
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        dealershipId: null,
        code: "1010",
        name: "Central Cash in Hand",
        type: "ASSET",
        subType: "cash",
        isSharedTreasury: true,
        balance: 500000,
      },
      {
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        dealershipId: null,
        code: "1020",
        name: "Central Main Bank",
        type: "ASSET",
        subType: "bank",
        isSharedTreasury: true,
        balance: 1500000,
      },
      // Dealership Branch Operating Cash (dealershipId === dId1)
      {
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        dealershipId: dId1,
        code: "1010",
        name: "Dhaka Branch Petty Cash",
        type: "ASSET",
        subType: "cash",
        balance: 75000,
      },
      // Operating Expense Accounts
      {
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        dealershipId: dId1,
        code: "6010",
        name: "Warehouse Rent Expense",
        type: "EXPENSE",
        category: "EXPENSE",
        balance: 40000,
      },
      {
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        dealershipId: dId1,
        code: "6020",
        name: "Utility Bills",
        type: "EXPENSE",
        category: "EXPENSE",
        balance: 12000,
      }
    );

    const result = await ExecutiveDashboardService.getExecutiveDashboard({
      businessId: String(bId),
      periodPreset: "last_30_days",
      canViewCosts: true,
    });

    // Verify Shared Treasury vs Dealership Operating Funds isolation
    assert.strictEqual(result.financials.treasury.sharedTreasuryCash, 500000);
    assert.strictEqual(result.financials.treasury.sharedTreasuryBank, 1500000);
    assert.strictEqual(result.financials.treasury.sharedTreasuryTotal, 2000000);
    assert.strictEqual(result.financials.treasury.dealershipOperatingTreasuryTotal, 75000);
    assert.strictEqual(result.financials.treasury.totalLiquidFunds, 2075000);

    // Verify Operating Expenses
    assert.strictEqual(result.financials.totalOperatingExpenses, 52000);
    assert.strictEqual(result.financials.operatingExpenses.length, 2);
  });

  test("5. Inventory Analytics: Unit statuses, low-stock threshold alerts, and batch expiry radar", async () => {
    dealerships.push(
      { _id: dId1, businessId: bId, name: "Dhaka Central", code: "DHK", status: "active" }
    );
    products.push(
      { _id: prodId1, businessId: bId, name: "Premium Filter", sku: "FLT-001", minStock: 25 },
      { _id: prodId2, businessId: bId, name: "Coolant Concentrate", sku: "CLN-002", minStock: 10 }
    );

    // Inventory balances (available, reserved, damaged)
    inventoryBalances.push(
      {
        businessId: bId,
        dealershipId: dId1,
        productId: prodId1,
        onHandQuantity: 15,
        availableQuantity: 10, // <= minStock (25) => Low stock alert!
        reservedQuantity: 5,
        damagedQuantity: 2,
      },
      {
        businessId: bId,
        dealershipId: dId1,
        productId: prodId2,
        onHandQuantity: 50,
        availableQuantity: 50, // > minStock (10) => Safe
        reservedQuantity: 0,
        damagedQuantity: 0,
      }
    );

    const now = new Date();
    const expiredDate = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000); // 15 days ago
    const nearExpiryDate = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000); // 20 days ahead

    stockBatches.push(
      {
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        dealershipId: dId1,
        batchNumber: "EXP-BATCH",
        productId: prodId1,
        status: "active",
        remainingQuantity: 8,
        netLandedUnitCost: 200,
        expiryDate: expiredDate,
      },
      {
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        dealershipId: dId1,
        batchNumber: "NEAR-BATCH",
        productId: prodId2,
        status: "active",
        remainingQuantity: 25,
        netLandedUnitCost: 400,
        expiryDate: nearExpiryDate,
      }
    );

    const result = await ExecutiveDashboardService.getExecutiveDashboard({
      businessId: String(bId),
      periodPreset: "last_30_days",
      canViewCosts: true,
    });

    // Check stock unit totals
    assert.strictEqual(result.inventory.totalStockUnits, 65); // 15 + 50
    assert.strictEqual(result.inventory.totalAvailableUnits, 60); // 10 + 50
    assert.strictEqual(result.inventory.totalReservedUnits, 5);
    assert.strictEqual(result.inventory.totalDamagedUnits, 2);

    // Check low stock alerts
    assert.strictEqual(result.inventory.lowStockAlerts.length, 1);
    assert.strictEqual(result.inventory.lowStockAlerts[0].sku, "FLT-001");
    assert.strictEqual(result.inventory.lowStockAlerts[0].availableQuantity, 10);
    assert.strictEqual(result.inventory.lowStockAlerts[0].minStock, 25);

    // Check expiry radar
    assert.strictEqual(result.inventory.expiryAlerts.expiredBatches.length, 1);
    assert.strictEqual(result.inventory.expiryAlerts.expiredBatches[0].batchNumber, "EXP-BATCH");
    assert.ok(result.inventory.expiryAlerts.expiredBatches[0].daysExpired >= 14);

    assert.strictEqual(result.inventory.expiryAlerts.nearExpiryBatches.length, 1);
    assert.strictEqual(result.inventory.expiryAlerts.nearExpiryBatches[0].batchNumber, "NEAR-BATCH");
    assert.ok(result.inventory.expiryAlerts.nearExpiryBatches[0].daysUntilExpiry <= 21);
  });

  test("6. Cost Confidentiality: Confidential purchase costs and margins are masked when unauthorized", async () => {
    dealerships.push(
      { _id: dId1, businessId: bId, name: "Dhaka Central", code: "DHK", status: "active" }
    );
    orders.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      dealershipId: dId1,
      orderDate: new Date(),
      deliveryStatus: "delivered",
      subtotal: 10000,
      totalAmount: 10000,
      items: [
        {
          productId: prodId1,
          variantId: varId1,
          name: "Engine Oil",
          sku: "OIL-1",
          quantity: 10,
          unitPrice: 1000,
          costPrice: 650,
          totalPrice: 10000,
        },
      ],
    });
    stockBatches.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      dealershipId: dId1,
      batchNumber: "B1",
      productId: prodId1,
      status: "active",
      remainingQuantity: 50,
      netLandedUnitCost: 650,
    });

    const result = await ExecutiveDashboardService.getExecutiveDashboard({
      businessId: String(bId),
      periodPreset: "last_30_days",
      canViewCosts: false, // Cost masking active
    });

    // Verification of cost masking
    assert.strictEqual(result.overview.grossProfit, 0);
    assert.strictEqual(result.overview.netProfit, null);
    assert.strictEqual(result.overview.inventoryValuation, 0);
    assert.strictEqual(result.financials.costOfGoodsSold, 0);
    assert.strictEqual(result.financials.grossProfit, 0);
    assert.strictEqual(result.financials.grossMarginPercentage, 0);
    assert.strictEqual(result.sales.topProducts[0].grossProfit, 0);
    assert.strictEqual(result.inventory.inventoryValuation, 0);
  });

  test("7. Dealership Tenancy: Non-consolidated dealership filter strictly scopes metrics to that dealership", async () => {
    dealerships.push(
      { _id: dId1, businessId: bId, name: "Dhaka Central", code: "DHK", status: "active" },
      { _id: dId2, businessId: bId, name: "Chittagong Hub", code: "CTG", status: "active" }
    );

    const now = new Date();
    orders.push(
      {
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        dealershipId: dId1,
        orderDate: now,
        deliveryStatus: "delivered",
        subtotal: 10000,
        totalAmount: 10000,
        items: [],
      },
      {
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        dealershipId: dId2,
        orderDate: now,
        deliveryStatus: "delivered",
        subtotal: 25000,
        totalAmount: 25000,
        items: [],
      }
    );

    // Query specifically for Dhaka Central (dId1)
    const result = await ExecutiveDashboardService.getExecutiveDashboard({
      businessId: String(bId),
      dealershipId: String(dId1),
      periodPreset: "last_30_days",
      canViewCosts: true,
    });

    assert.strictEqual(result.filterScope.isConsolidated, false);
    assert.strictEqual(result.filterScope.dealershipId, String(dId1));
    // Should ONLY include Dhaka sales (10,000), NOT Chittagong sales (25,000)
    assert.strictEqual(result.overview.totalSales, 10000);
  });
});
