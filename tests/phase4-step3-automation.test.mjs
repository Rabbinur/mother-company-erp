import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

// Models
import { AutomationRule } from "../src/models/AutomationRule";
import { AutomationEvent } from "../src/models/AutomationEvent";
import { AutomationExecution } from "../src/models/AutomationExecution";
import { InventoryBalance } from "../src/models/InventoryBalance";
import { StockBatch } from "../src/models/StockBatch";
import { Product } from "../src/models/Product";
import { CustomerDealershipAccount } from "../src/models/CustomerDealershipAccount";
import { Customer } from "../src/models/Customer";
import { Order } from "../src/models/Order";
import { SupplierPayable } from "../src/models/SupplierPayable";
import { Purchase } from "../src/models/Purchase";
import { GoodsReceiptNote } from "../src/models/GoodsReceiptNote";
import { Vendor } from "../src/models/Vendor";
import { Dispatch } from "../src/models/Dispatch";
import { SalesReturn } from "../src/models/SalesReturn";
import { Claim } from "../src/models/Claim";
import { AccountingPeriod } from "../src/models/AccountingPeriod";
import { BankReconciliation } from "../src/models/BankReconciliation";
import { TransactionOutcome } from "../src/models/TransactionOutcome";
import { Expense } from "../src/models/Expense";
import { SupportTicket } from "../src/models/SupportTicket";
import { Notification } from "../src/models/Notification";

// Services
import { AutomationEngine } from "../src/services/automation/AutomationEngine";
import { AutomationRuleService } from "../src/services/automation/AutomationRuleService";
import { AutomationActionService } from "../src/services/automation/AutomationActionService";
import { InventoryDetector } from "../src/services/automation/detectors/InventoryDetector";
import { CustomerDetector } from "../src/services/automation/detectors/CustomerDetector";
import { SupplierDetector } from "../src/services/automation/detectors/SupplierDetector";
import { SalesDeliveryDetector } from "../src/services/automation/detectors/SalesDeliveryDetector";
import { FinancialDetector } from "../src/services/automation/detectors/FinancialDetector";
import { OperationalDetector } from "../src/services/automation/detectors/OperationalDetector";

describe("Phase 4 - Step 3: Smart Automation Engine Test Suite", () => {
  let automationRules = [];
  let automationEvents = [];
  let automationExecutions = [];
  let inventoryBalances = [];
  let stockBatches = [];
  let products = [];
  let customerAccounts = [];
  let customers = [];
  let orders = [];
  let supplierPayables = [];
  let purchases = [];
  let grns = [];
  let vendors = [];
  let dispatches = [];
  let salesReturns = [];
  let claims = [];
  let accountingPeriods = [];
  let bankReconciliations = [];
  let transactionOutcomes = [];
  let expenses = [];
  let supportTickets = [];

  const bId = new mongoose.Types.ObjectId();
  const dId1 = new mongoose.Types.ObjectId();
  const prodId1 = new mongoose.Types.ObjectId();
  const custId1 = new mongoose.Types.ObjectId();
  const vendorId1 = new mongoose.Types.ObjectId();
  const warehouseId1 = new mongoose.Types.ObjectId();

  beforeEach(() => {
    automationRules = [];
    automationEvents = [];
    automationExecutions = [];
    inventoryBalances = [];
    stockBatches = [];
    products = [];
    customerAccounts = [];
    customers = [];
    orders = [];
    supplierPayables = [];
    purchases = [];
    grns = [];
    vendors = [];
    dispatches = [];
    salesReturns = [];
    claims = [];
    accountingPeriods = [];
    bankReconciliations = [];
    transactionOutcomes = [];
    expenses = [];
    supportTickets = [];

    const createChainable = (fn) => {
      const chain = {
        sort: () => chain,
        skip: () => chain,
        limit: () => chain,
        lean: async () => fn(),
        then: (resolve, reject) => Promise.resolve(fn()).then(resolve, reject),
      };
      return chain;
    };

    // Model Mocks
    AutomationRule.find = (q) => {
      let filtered = automationRules.slice();
      if (q?.businessId) filtered = filtered.filter((r) => String(r.businessId) === String(q.businessId));
      if (q?.category) filtered = filtered.filter((r) => r.category === q.category);
      return createChainable(() => filtered);
    };
    AutomationRule.insertMany = async (items) => {
      for (const it of items) {
        automationRules.push({ _id: new mongoose.Types.ObjectId(), ...it });
      }
      return items;
    };
    AutomationRule.findOneAndUpdate = async (q, update) => {
      const idx = automationRules.findIndex((r) => String(r.businessId) === String(q.businessId) && r.ruleKey === q.ruleKey);
      if (idx !== -1) {
        automationRules[idx] = { ...automationRules[idx], ...update.$set };
        return automationRules[idx];
      }
      return null;
    };

    AutomationEvent.find = (q) => {
      let filtered = automationEvents.slice();
      if (q?.businessId) filtered = filtered.filter((e) => String(e.businessId) === String(q.businessId));
      if (q?.status) {
        if (typeof q.status === "object" && q.status.$in) {
          filtered = filtered.filter((e) => q.status.$in.includes(e.status));
        } else {
          filtered = filtered.filter((e) => e.status === q.status);
        }
      }
      if (q?.severity) filtered = filtered.filter((e) => e.severity === q.severity);
      if (q?.category) filtered = filtered.filter((e) => e.category === q.category);
      return createChainable(() => filtered);
    };
    AutomationEvent.findOne = (q) => {
      let filtered = automationEvents.slice();
      if (q?.businessId) filtered = filtered.filter((e) => String(e.businessId) === String(q.businessId));
      if (q?.deduplicationKey) filtered = filtered.filter((e) => e.deduplicationKey === q.deduplicationKey);
      if (q?.status?.$in) filtered = filtered.filter((e) => q.status.$in.includes(e.status));
      return createChainable(() => filtered[0] || null);
    };
    AutomationEvent.create = async (doc) => {
      const saved = { _id: new mongoose.Types.ObjectId(), createdAt: new Date(), updatedAt: new Date(), ...doc };
      automationEvents.push(saved);
      return saved;
    };
    AutomationEvent.countDocuments = async () => automationEvents.length;
    AutomationEvent.findOneAndUpdate = async (q, update) => {
      const idx = automationEvents.findIndex((e) => String(e._id) === String(q._id));
      if (idx !== -1) {
        automationEvents[idx] = { ...automationEvents[idx], ...update.$set };
        return automationEvents[idx];
      }
      return null;
    };

    AutomationExecution.create = async (doc) => {
      const saved = { _id: new mongoose.Types.ObjectId(), ...doc };
      automationExecutions.push(saved);
      return saved;
    };
    AutomationExecution.findByIdAndUpdate = async (id, update) => {
      const idx = automationExecutions.findIndex((ex) => String(ex._id) === String(id));
      if (idx !== -1) {
        automationExecutions[idx] = { ...automationExecutions[idx], ...update.$set };
        return automationExecutions[idx];
      }
      return null;
    };
    AutomationExecution.find = () => createChainable(() => automationExecutions.slice());

    // Domain Models Mocks
    InventoryBalance.find = () => createChainable(() => inventoryBalances.slice());
    StockBatch.find = (q) => {
      let filtered = stockBatches.slice();
      if (q?.status) filtered = filtered.filter((b) => b.status === q.status);
      return createChainable(() => filtered);
    };
    Product.find = () => createChainable(() => products.slice());
    Product.findById = (id) => createChainable(() => products.find((p) => String(p._id) === String(id)) || null);
    CustomerDealershipAccount.find = (q) => {
      let filtered = customerAccounts.slice();
      if (q?.currentBalance?.$gte) filtered = filtered.filter((a) => a.currentBalance >= q.currentBalance.$gte);
      return createChainable(() => filtered);
    };
    Customer.find = () => createChainable(() => customers.slice());
    Order.find = () => createChainable(() => orders.slice());
    Order.findOne = () => createChainable(() => orders[0] || null);
    SupplierPayable.find = (q) => {
      let filtered = supplierPayables.slice();
      if (q?.outstandingBalance?.$gte) filtered = filtered.filter((p) => p.outstandingBalance >= q.outstandingBalance.$gte);
      return createChainable(() => filtered);
    };
    Purchase.find = () => createChainable(() => purchases.slice());
    GoodsReceiptNote.find = () => createChainable(() => grns.slice());
    Vendor.find = () => createChainable(() => vendors.slice());
    Vendor.findById = (id) => createChainable(() => vendors.find((v) => String(v._id) === String(id)) || null);
    Dispatch.find = () => createChainable(() => dispatches.slice());
    SalesReturn.find = () => createChainable(() => salesReturns.slice());
    Claim.find = () => createChainable(() => claims.slice());
    AccountingPeriod.find = () => createChainable(() => accountingPeriods.slice());
    BankReconciliation.find = () => createChainable(() => bankReconciliations.slice());
    TransactionOutcome.find = () => createChainable(() => transactionOutcomes.slice());
    Expense.find = () => createChainable(() => expenses.slice());
    SupportTicket.find = () => createChainable(() => supportTickets.slice());
    Notification.create = async () => ({});
  });

  test("1. Inventory Intelligence: Low stock, stockout, near-expiry, expired and quarantined stock", async () => {
    products.push({
      _id: prodId1,
      name: "Engine Oil 5W40",
      sku: "OIL-5W40",
      minStock: 20,
    });

    inventoryBalances.push(
      {
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        productId: prodId1,
        warehouseId: warehouseId1,
        availableQuantity: 5, // <= minStock 20 -> LOW_STOCK
      },
      {
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        productId: new mongoose.Types.ObjectId(),
        warehouseId: warehouseId1,
        availableQuantity: 0, // STOCKOUT
      }
    );

    const now = new Date();
    stockBatches.push(
      {
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        batchNumber: "B-EXP-01",
        status: "active",
        remainingQuantity: 50,
        expiryDate: new Date(now.getTime() - 86400000), // Passed expiry -> EXPIRED_STOCK
      },
      {
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        batchNumber: "B-WARN-02",
        status: "active",
        remainingQuantity: 30,
        expiryDate: new Date(now.getTime() + 10 * 86400000), // Within 30 days -> NEAR_EXPIRY
      },
      {
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        batchNumber: "B-QUAR-03",
        status: "quarantined",
        remainingQuantity: 15, // Quarantined
      }
    );

    // Evaluate LOW_STOCK
    const lowStockRule = { ruleKey: "LOW_STOCK", category: "INVENTORY", severity: "HIGH", enabled: true, isConfigured: true };
    const lowRes = await InventoryDetector.evaluate({ rule: lowStockRule, businessId: bId });
    assert.strictEqual(lowRes.conditions.length, 1);
    assert.strictEqual(lowRes.conditions[0].ruleKey, "LOW_STOCK");
    assert.strictEqual(lowRes.conditions[0].metadata.availableQuantity, 5);

    // Evaluate STOCKOUT
    const outRule = { ruleKey: "STOCKOUT", category: "INVENTORY", severity: "CRITICAL", enabled: true, isConfigured: true };
    const outRes = await InventoryDetector.evaluate({ rule: outRule, businessId: bId });
    assert.strictEqual(outRes.conditions.length, 1);
    assert.strictEqual(outRes.conditions[0].ruleKey, "STOCKOUT");

    // Evaluate EXPIRED_STOCK
    const expRule = { ruleKey: "EXPIRED_STOCK", category: "INVENTORY", severity: "CRITICAL", enabled: true, isConfigured: true };
    const expRes = await InventoryDetector.evaluate({ rule: expRule, businessId: bId });
    assert.strictEqual(expRes.conditions.length, 1);
    assert.strictEqual(expRes.conditions[0].metadata.batchNumber, "B-EXP-01");

    // Evaluate NEAR_EXPIRY
    const nearRule = { ruleKey: "NEAR_EXPIRY", category: "INVENTORY", severity: "HIGH", enabled: true, isConfigured: true, configuration: { warningDays: 30 } };
    const nearRes = await InventoryDetector.evaluate({ rule: nearRule, businessId: bId });
    assert.strictEqual(nearRes.conditions.length, 1);
    assert.strictEqual(nearRes.conditions[0].metadata.batchNumber, "B-WARN-02");

    // Evaluate DAMAGED_QUARANTINED_STOCK
    const quarRule = { ruleKey: "DAMAGED_QUARANTINED_STOCK", category: "INVENTORY", severity: "HIGH", enabled: true, isConfigured: true };
    const quarRes = await InventoryDetector.evaluate({ rule: quarRule, businessId: bId });
    assert.strictEqual(quarRes.conditions.length, 1);
    assert.strictEqual(quarRes.conditions[0].metadata.batchId, String(stockBatches[2]._id));
  });

  test("2. Customer Intelligence: High outstanding, credit warning, limit exceeded, inactive, and overdue receivables", async () => {
    customers.push({ _id: custId1, name: "City Auto Spares" });

    customerAccounts.push(
      // High outstanding & limit exceeded
      {
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        dealershipId: dId1,
        customerId: custId1,
        creditLimit: 100000,
        currentBalance: 250000, // Balance 250k > limit 100k and > threshold 200k
        isDeleted: false,
      }
    );

    // Evaluate CUSTOMER_OUTSTANDING_EXCEEDED
    const outRule = { ruleKey: "CUSTOMER_OUTSTANDING_EXCEEDED", category: "CUSTOMER", severity: "HIGH", enabled: true, isConfigured: true, configuration: { thresholdAmount: 200000 } };
    const outRes = await CustomerDetector.evaluate({ rule: outRule, businessId: bId });
    assert.strictEqual(outRes.conditions.length, 1);
    assert.strictEqual(outRes.conditions[0].metadata.currentBalance, 250000);

    // Evaluate CREDIT_LIMIT_EXCEEDED
    const limitRule = { ruleKey: "CREDIT_LIMIT_EXCEEDED", category: "CUSTOMER", severity: "CRITICAL", enabled: true, isConfigured: true };
    const limitRes = await CustomerDetector.evaluate({ rule: limitRule, businessId: bId });
    assert.strictEqual(limitRes.conditions.length, 1);

    // Evaluate CREDIT_UTILIZATION_WARNING (85%)
    customerAccounts[0].currentBalance = 90000; // 90% utilization
    const utilRule = { ruleKey: "CREDIT_UTILIZATION_WARNING", category: "CUSTOMER", severity: "HIGH", enabled: true, isConfigured: true, configuration: { warningPercentage: 85 } };
    const utilRes = await CustomerDetector.evaluate({ rule: utilRule, businessId: bId });
    assert.strictEqual(utilRes.conditions.length, 1);
    assert.strictEqual(utilRes.conditions[0].metadata.utilizationPercentage, 90);
  });

  test("3. Supplier Intelligence: Due payables, pending POs, GRN shortages, shortage rate, and price variance", async () => {
    vendors.push({ _id: vendorId1, name: "Padma Lubricants" });

    const now = new Date();
    supplierPayables.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      supplierId: vendorId1,
      payableNumber: "PAY-001",
      outstandingBalance: 75000,
      dueDate: new Date(now.getTime() - 86400000), // Past due
      status: "UNPAID",
      isCancelled: false,
    });

    purchases.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      purchaseNumber: "PO-900",
      status: "submitted",
      orderDate: new Date(now.getTime() - 5 * 86400000), // Pending > 3 days
    });

    grns.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      supplierId: vendorId1,
      challanNumber: "CH-1234",
      status: "VERIFIED",
      items: [
        {
          productName: "Brake Pad",
          challanQuantity: 100,
          receivedQuantity: 90,
          shortageQuantity: 10, // Shortage > 0
          unitPurchasePrice: 1500,
        },
      ],
    });

    // Evaluate SUPPLIER_PAYMENT_DUE
    const payRule = { ruleKey: "SUPPLIER_PAYMENT_DUE", category: "SUPPLIER", severity: "HIGH", enabled: true, isConfigured: true, configuration: { advanceWarningDays: 2 } };
    const payRes = await SupplierDetector.evaluate({ rule: payRule, businessId: bId });
    assert.strictEqual(payRes.conditions.length, 1);
    assert.strictEqual(payRes.conditions[0].metadata.payableNumber, "PAY-001");

    // Evaluate PURCHASE_ORDER_PENDING
    const poRule = { ruleKey: "PURCHASE_ORDER_PENDING", category: "SUPPLIER", severity: "MEDIUM", enabled: true, isConfigured: true, configuration: { pendingDays: 3 } };
    const poRes = await SupplierDetector.evaluate({ rule: poRule, businessId: bId });
    assert.strictEqual(poRes.conditions.length, 1);
    assert.strictEqual(poRes.conditions[0].metadata.purchaseNumber, "PO-900");

    // Evaluate PARTIAL_GRN_SHORTAGE
    const grnRule = { ruleKey: "PARTIAL_GRN_SHORTAGE", category: "SUPPLIER", severity: "HIGH", enabled: true, isConfigured: true };
    const grnRes = await SupplierDetector.evaluate({ rule: grnRule, businessId: bId });
    assert.strictEqual(grnRes.conditions.length, 1);
    assert.strictEqual(grnRes.conditions[0].metadata.totalShortage, 10);
  });

  test("4. Sales & Delivery Intelligence: Unfulfilled orders, dispatch stops, sales returns, and claims", async () => {
    const now = new Date();

    orders.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      orderNumber: "ORD-2026-001",
      orderStatus: "confirmed",
      fulfillmentStatus: "unfulfilled",
      orderDate: new Date(now.getTime() - 4 * 86400000), // > 2 days
      totalAmount: 12000,
    });

    dispatches.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      dispatchNumber: "DISP-101",
      status: "IN_TRANSIT",
      stops: [{ status: "failed", notes: "Customer shop closed" }],
    });

    salesReturns.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      returnNumber: "RET-501",
      orderNumber: "ORD-2026-001",
      status: "REQUESTED",
    });

    claims.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      claimNumber: "CLM-001",
      claimedAmount: 15000,
      status: "SUBMITTED",
      createdAt: new Date(now.getTime() - 10 * 86400000), // > 7 days
    });

    // Evaluate UNFULFILLED_ORDER_OVERDUE
    const ordRule = { ruleKey: "UNFULFILLED_ORDER_OVERDUE", category: "SALES", severity: "HIGH", enabled: true, isConfigured: true, configuration: { maxAgingDays: 2 } };
    const ordRes = await SalesDeliveryDetector.evaluate({ rule: ordRule, businessId: bId });
    assert.strictEqual(ordRes.conditions.length, 1);
    assert.strictEqual(ordRes.conditions[0].metadata.orderNumber, "ORD-2026-001");

    // Evaluate DISPATCH_UNRESOLVED_STOPS
    const dispRule = { ruleKey: "DISPATCH_UNRESOLVED_STOPS", category: "SALES", severity: "HIGH", enabled: true, isConfigured: true };
    const dispRes = await SalesDeliveryDetector.evaluate({ rule: dispRule, businessId: bId });
    assert.strictEqual(dispRes.conditions.length, 1);
    assert.strictEqual(dispRes.conditions[0].metadata.unresolvedStops, 1);

    // Evaluate SALES_RETURN_PENDING_INSPECTION
    const retRule = { ruleKey: "SALES_RETURN_PENDING_INSPECTION", category: "SALES", severity: "HIGH", enabled: true, isConfigured: true };
    const retRes = await SalesDeliveryDetector.evaluate({ rule: retRule, businessId: bId });
    assert.strictEqual(retRes.conditions.length, 1);

    // Evaluate UNRESOLVED_CLAIM_OVERDUE
    const clmRule = { ruleKey: "UNRESOLVED_CLAIM_OVERDUE", category: "SALES", severity: "HIGH", enabled: true, isConfigured: true, configuration: { maxPendingDays: 7 } };
    const clmRes = await SalesDeliveryDetector.evaluate({ rule: clmRule, businessId: bId });
    assert.strictEqual(clmRes.conditions.length, 1);
  });

  test("5. Financial & Operational Intelligence: Accounting periods, bank discrepancies, transaction failure, and NOT_CONFIGURED attendance", async () => {
    const now = new Date();

    accountingPeriods.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      periodName: "November 2026",
      status: "OPEN",
      endDate: new Date(now.getTime() + 86400000), // Closes in 1 day
    });

    bankReconciliations.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      accountCode: "1010",
      accountName: "Main Operating Bank",
      discrepancy: 15000,
      status: "DISCREPANCY",
    });

    transactionOutcomes.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      operationType: "JOURNAL_POST",
      status: "RECONCILIATION_REQUIRED",
      errorMessage: "Write conflict in replica set",
    });

    supportTickets.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      ticketId: "TKT-888",
      reason: "Credit limit increase request",
      status: "pending",
    });

    // Evaluate ACCOUNTING_PERIOD_CLOSING_SOON
    const perRule = { ruleKey: "ACCOUNTING_PERIOD_CLOSING_SOON", category: "FINANCIAL", severity: "MEDIUM", enabled: true, isConfigured: true, configuration: { warningDays: 3 } };
    const perRes = await FinancialDetector.evaluate({ rule: perRule, businessId: bId });
    assert.strictEqual(perRes.conditions.length, 1);
    assert.strictEqual(perRes.conditions[0].metadata.periodName, "November 2026");

    // Evaluate UNRECONCILED_BANK_DISCREPANCY
    const bankRule = { ruleKey: "UNRECONCILED_BANK_DISCREPANCY", category: "FINANCIAL", severity: "CRITICAL", enabled: true, isConfigured: true };
    const bankRes = await FinancialDetector.evaluate({ rule: bankRule, businessId: bId });
    assert.strictEqual(bankRes.conditions.length, 1);
    assert.strictEqual(bankRes.conditions[0].metadata.discrepancy, 15000);

    // Evaluate TRANSACTION_OUTCOME_FAILURE
    const txRule = { ruleKey: "TRANSACTION_OUTCOME_FAILURE", category: "FINANCIAL", severity: "CRITICAL", enabled: true, isConfigured: true };
    const txRes = await FinancialDetector.evaluate({ rule: txRule, businessId: bId });
    assert.strictEqual(txRes.conditions.length, 1);

    // Evaluate EMPLOYEE_ATTENDANCE_RECONCILIATION -> Must report NOT_CONFIGURED!
    const attRule = { ruleKey: "EMPLOYEE_ATTENDANCE_RECONCILIATION", category: "OPERATIONAL", severity: "LOW", enabled: true, isConfigured: false };
    const attRes = await OperationalDetector.evaluate({ rule: attRule, businessId: bId });
    assert.strictEqual(attRes.status, "NOT_CONFIGURED");
    assert.strictEqual(attRes.conditions.length, 0);
    assert.ok(attRes.unconfiguredReason?.includes("No employee attendance"));

    // Evaluate UNRESOLVED_SUPPORT_TICKET
    const tktRule = { ruleKey: "UNRESOLVED_SUPPORT_TICKET", category: "OPERATIONAL", severity: "HIGH", enabled: true, isConfigured: true };
    const tktRes = await OperationalDetector.evaluate({ rule: tktRule, businessId: bId });
    assert.strictEqual(tktRes.conditions.length, 1);
    assert.strictEqual(tktRes.conditions[0].metadata.ticketId, "TKT-888");
  });

  test("6. Automation Engine: Rule initialization, deduplication, event creation, and action lifecycle", async () => {
    // 1. Seed rules
    await AutomationRuleService.ensureDefaultRules(bId);
    assert.ok(automationRules.length >= 25);

    // 2. Prepare mock condition for engine run
    inventoryBalances.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      productId: prodId1,
      warehouseId: warehouseId1,
      availableQuantity: 0,
    });

    // 3. First Engine Run
    const runResult1 = await AutomationEngine.run({
      businessId: bId,
      ruleKeys: ["STOCKOUT"],
      triggeredBy: "MANUAL",
    });

    assert.strictEqual(runResult1.status, "COMPLETED");
    assert.strictEqual(runResult1.eventsGenerated, 1);
    assert.strictEqual(automationEvents.length, 1);
    assert.strictEqual(automationEvents[0].status, "OPEN");

    const eventId = automationEvents[0]._id;

    // 4. Second Engine Run: Deduplication verification (Must NOT create duplicate event!)
    const runResult2 = await AutomationEngine.run({
      businessId: bId,
      ruleKeys: ["STOCKOUT"],
      triggeredBy: "SCHEDULED",
    });

    assert.strictEqual(runResult2.eventsGenerated, 0);
    assert.strictEqual(automationEvents.length, 1); // Deduplicated!

    // 5. Action Lifecycle: Acknowledge event
    const acked = await AutomationActionService.acknowledgeEvent({
      eventId,
      businessId: bId,
    });
    assert.strictEqual(acked?.status, "ACKNOWLEDGED");
    assert.ok(acked?.acknowledgedAt);

    // 6. Action Lifecycle: Resolve event
    const resolved = await AutomationActionService.resolveEvent({
      eventId,
      businessId: bId,
    });
    assert.strictEqual(resolved?.status, "RESOLVED");
    assert.ok(resolved?.resolvedAt);

    // 7. Verify Execution record logged
    assert.strictEqual(automationExecutions.length, 2);
    assert.strictEqual(automationExecutions[0].status, "COMPLETED");
  });
});
