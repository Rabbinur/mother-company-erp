import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

// Models
import { Account } from "../src/models/Account.ts";
import { JournalEntry } from "../src/models/JournalEntry.ts";
import { CustomerDealershipAccount } from "../src/models/CustomerDealershipAccount.ts";
import { SupplierPayable } from "../src/models/SupplierPayable.ts";
import { Order } from "../src/models/Order.ts";
import { BankReconciliation } from "../src/models/BankReconciliation.ts";
import { AccountingPeriod } from "../src/models/AccountingPeriod.ts";

// Service under test
import { FinancialReportService } from "../src/services/FinancialReportService.ts";
import { AccountingService } from "../src/services/AccountingService.ts";

describe("Phase 3 - Step 9: Financial Reports & Reconciliation Engine Test Suite", () => {
  let accounts = [];
  let journalEntries = [];
  let customerAccounts = [];
  let unpaidOrders = [];
  let supplierPayables = [];
  let bankReconciliations = [];
  let periods = [];

  const bId = new mongoose.Types.ObjectId();
  const dId1 = new mongoose.Types.ObjectId();
  const dId2 = new mongoose.Types.ObjectId();
  const pcId1 = new mongoose.Types.ObjectId();
  const custId1 = new mongoose.Types.ObjectId();
  const custId2 = new mongoose.Types.ObjectId();
  const vendorId1 = new mongoose.Types.ObjectId();
  const vendorId2 = new mongoose.Types.ObjectId();

  beforeEach(() => {
    accounts = [];
    journalEntries = [];
    customerAccounts = [];
    unpaidOrders = [];
    supplierPayables = [];
    bankReconciliations = [];
    periods = [];

    // Helper for chainable queries
    const createChainable = (getItems) => {
      const chain = {
        populate: () => chain,
        sort: (sortObj) => {
          const items = getItems();
          if (sortObj?.orderDate || sortObj?.postingDate || sortObj?.invoiceDate || sortObj?.createdAt) {
            items.sort((a, b) => {
              const dateA = new Date(a.orderDate || a.postingDate || a.invoiceDate || a.createdAt || 0).getTime();
              const dateB = new Date(b.orderDate || b.postingDate || b.invoiceDate || b.createdAt || 0).getTime();
              return dateA - dateB;
            });
          }
          if (sortObj?.code) {
            items.sort((a, b) => (a.code || "").localeCompare(b.code || ""));
          }
          return chain;
        },
        lean: async () => getItems(),
        session: () => chain,
      };
      return chain;
    };

    // Mock Account
    Account.find = (query = {}) => {
      const getFiltered = () =>
        accounts.filter((a) => {
          if (query.status && a.status !== query.status) return false;
          if (query.businessId && String(a.businessId) !== String(query.businessId)) return false;
          if (query.type && a.type !== query.type) return false;
          if (query.code) {
            if (typeof query.code === "string" && a.code !== query.code) return false;
            if (query.code.$in && !query.code.$in.includes(a.code)) return false;
          }
          if (query.subType && query.subType.$in && !query.subType.$in.includes(a.subType)) return false;
          if (query._id && String(a._id) !== String(query._id)) return false;
          if (query.$or) {
            const matches = query.$or.some((clause) => {
              if (clause.dealershipId !== undefined) {
                if (clause.dealershipId === null || clause.dealershipId?.$exists === false) {
                  return !a.dealershipId;
                }
                const aDId = a.dealershipId?._id || a.dealershipId;
                return aDId && String(aDId) === String(clause.dealershipId);
              }
              if (clause.isSharedTreasury) {
                return Boolean(a.isSharedTreasury);
              }
              if (clause.code && clause.code.$in) {
                return clause.code.$in.includes(a.code);
              }
              return false;
            });
            if (!matches) return false;
          } else if (query.dealershipId) {
            const aDId = a.dealershipId?._id || a.dealershipId;
            if (String(aDId) !== String(query.dealershipId)) {
              return false;
            }
          }
          return true;
        });
      return createChainable(getFiltered);
    };

    Account.findById = async (id) => {
      return accounts.find((a) => String(a._id) === String(id)) || null;
    };

    // Mock JournalEntry
    JournalEntry.find = (query = {}) => {
      const getFiltered = () =>
        journalEntries.filter((j) => {
          if (query.isPosted !== undefined && j.isPosted !== query.isPosted) return false;
          if (query.businessId && String(j.businessId) !== String(query.businessId)) return false;
          if (query["lines.accountId"]) {
            const hasAcc = j.lines?.some((l) => String(l.accountId) === String(query["lines.accountId"]));
            if (!hasAcc) return false;
          }
          return true;
        });
      return createChainable(getFiltered);
    };

    // Mock CustomerDealershipAccount
    CustomerDealershipAccount.find = (query = {}) => {
      const getFiltered = () =>
        customerAccounts.filter((ca) => {
          if (ca.isDeleted) return false;
          if (query.businessId && String(ca.businessId) !== String(query.businessId)) return false;
          if (query.dealershipId && String(ca.dealershipId?._id || ca.dealershipId) !== String(query.dealershipId)) return false;
          if (query.customerId && String(ca.customerId?._id || ca.customerId) !== String(query.customerId)) return false;
          if (query.currentBalance && query.currentBalance.$gte !== undefined) {
            if (ca.currentBalance < query.currentBalance.$gte) return false;
          }
          return true;
        });
      return createChainable(getFiltered);
    };

    // Mock Order
    Order.find = (query = {}) => {
      const getFiltered = () =>
        unpaidOrders.filter((ord) => {
          if (query.customerId && String(ord.customerId) !== String(query.customerId)) return false;
          if (query.dealershipId && String(ord.dealershipId) !== String(query.dealershipId)) return false;
          if (query.paymentStatus && query.paymentStatus.$in) {
            if (!query.paymentStatus.$in.includes(ord.paymentStatus)) return false;
          }
          if (query.orderStatus && query.orderStatus.$nin) {
            if (query.orderStatus.$nin.includes(ord.orderStatus)) return false;
          }
          return true;
        });
      return createChainable(getFiltered);
    };

    // Mock SupplierPayable
    SupplierPayable.find = (query = {}) => {
      const getFiltered = () =>
        supplierPayables.filter((sp) => {
          if (sp.isCancelled) return false;
          if (query.status && query.status.$in) {
            if (!query.status.$in.includes(sp.status)) return false;
          }
          if (query.businessId && String(sp.businessId) !== String(query.businessId)) return false;
          if (query.dealershipId && String(sp.dealershipId?._id || sp.dealershipId) !== String(query.dealershipId)) return false;
          if (query.principalCompanyId && String(sp.principalCompanyId?._id || sp.principalCompanyId) !== String(query.principalCompanyId)) return false;
          if (query.supplierId && String(sp.supplierId?._id || sp.supplierId) !== String(query.supplierId)) return false;
          if (query.outstandingBalance && query.outstandingBalance.$gt !== undefined) {
            if (sp.outstandingBalance <= query.outstandingBalance.$gt) return false;
          }
          return true;
        });
      return createChainable(getFiltered);
    };

    // Mock BankReconciliation
    BankReconciliation.create = async (doc) => {
      const created = {
        _id: new mongoose.Types.ObjectId(),
        ...doc,
        createdAt: new Date(),
      };
      bankReconciliations.push(created);
      return created;
    };
  });

  // =========================================================================
  // 1. AR AGING REPORT TESTS
  // =========================================================================
  describe("1. Accounts Receivable (AR) Aging Engine", () => {
    test("Correctly buckets receivables by invoice age across Current, 1-30, 31-60, 61-90, 90+ days", async () => {
      const asOf = new Date("2026-11-26T12:00:00Z");

      // Setup customer account with ৳100,000 balance
      customerAccounts.push({
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        dealershipId: { _id: dId1, name: "Dhaka Central Motors" },
        customerId: { _id: custId1, name: "Rahim Traders", phone: "01711111111", shopName: "Rahim Store" },
        currentBalance: 100000,
        creditLimit: 150000,
        isDeleted: false,
      });

      // Add unpaid orders at different past dates
      // Order 1: today (Current) -> ৳10,000
      unpaidOrders.push({
        _id: new mongoose.Types.ObjectId(),
        customerId: custId1,
        dealershipId: dId1,
        orderDate: new Date("2026-11-26T00:00:00Z"),
        receivableAmount: 10000,
        paymentStatus: "unpaid",
        orderStatus: "delivered",
      });

      // Order 2: 15 days ago (1-30 days) -> ৳25,000
      unpaidOrders.push({
        _id: new mongoose.Types.ObjectId(),
        customerId: custId1,
        dealershipId: dId1,
        orderDate: new Date("2026-11-11T12:00:00Z"),
        receivableAmount: 25000,
        paymentStatus: "unpaid",
        orderStatus: "delivered",
      });

      // Order 3: 45 days ago (31-60 days) -> ৳20,000
      unpaidOrders.push({
        _id: new mongoose.Types.ObjectId(),
        customerId: custId1,
        dealershipId: dId1,
        orderDate: new Date("2026-10-12T12:00:00Z"),
        receivableAmount: 20000,
        paymentStatus: "partially_paid",
        orderStatus: "delivered",
      });

      // Order 4: 75 days ago (61-90 days) -> ৳15,000
      unpaidOrders.push({
        _id: new mongoose.Types.ObjectId(),
        customerId: custId1,
        dealershipId: dId1,
        orderDate: new Date("2026-09-12T12:00:00Z"),
        receivableAmount: 15000,
        paymentStatus: "unpaid",
        orderStatus: "delivered",
      });

      // Order 5: 120 days ago (90+ days) -> ৳30,000
      unpaidOrders.push({
        _id: new mongoose.Types.ObjectId(),
        customerId: custId1,
        dealershipId: dId1,
        orderDate: new Date("2026-07-29T12:00:00Z"),
        receivableAmount: 30000,
        paymentStatus: "unpaid",
        orderStatus: "delivered",
      });

      // GL Account 1100 setup matching ৳100,000
      accounts.push({
        _id: new mongoose.Types.ObjectId(),
        code: "1100",
        name: "Accounts Receivable",
        category: "ASSET",
        businessId: bId,
        dealershipId: dId1,
        balance: 100000,
        status: "active",
      });

      const report = await FinancialReportService.getArAgingReport({
        businessId: bId,
        dealershipId: dId1,
        asOfDate: asOf,
      });

      assert.equal(report.summary.totalReceivables, 100000);
      assert.equal(report.summary.totalCurrent, 10000);
      assert.equal(report.summary.totalDays1_30, 25000);
      assert.equal(report.summary.totalDays31_60, 20000);
      assert.equal(report.summary.totalDays61_90, 15000);
      assert.equal(report.summary.totalDays90Plus, 30000);

      // Verify GL Reconciliation
      assert.equal(report.reconciliation.glAccountCode, "1100");
      assert.equal(report.reconciliation.glBalance, 100000);
      assert.equal(report.reconciliation.subledgerTotal, 100000);
      assert.equal(report.reconciliation.discrepancy, 0);
      assert.equal(report.reconciliation.isReconciled, true);

      // Verify Customer item details
      assert.equal(report.customers.length, 1);
      const cust = report.customers[0];
      assert.equal(cust.customerName, "Rahim Traders");
      assert.equal(cust.unpaidOrdersCount, 5);
      assert.equal(cust.days90Plus, 30000);
    });

    test("Detects and reports GL Account 1100 discrepancy when subledger and GL diverge", async () => {
      // Subledger has ৳50,000
      customerAccounts.push({
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        dealershipId: { _id: dId1, name: "Dhaka Central Motors" },
        customerId: { _id: custId1, name: "Rahim Traders" },
        currentBalance: 50000,
        creditLimit: 0,
        isDeleted: false,
      });

      // GL Account 1100 has ৳48,000 (discrepancy of -2,000)
      accounts.push({
        _id: new mongoose.Types.ObjectId(),
        code: "1100",
        name: "Accounts Receivable",
        category: "ASSET",
        businessId: bId,
        dealershipId: dId1,
        balance: 48000,
        status: "active",
      });

      const report = await FinancialReportService.getArAgingReport({
        businessId: bId,
        dealershipId: dId1,
      });

      assert.equal(report.summary.totalReceivables, 50000);
      assert.equal(report.reconciliation.glBalance, 48000);
      assert.equal(report.reconciliation.discrepancy, -2000);
      assert.equal(report.reconciliation.isReconciled, false);
    });

    test("Dealership filtering segregates AR balances and does not leak cross-dealership balances", async () => {
      // Dealership 1 account
      customerAccounts.push({
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        dealershipId: { _id: dId1, name: "Dealership One" },
        customerId: { _id: custId1, name: "Customer Alpha" },
        currentBalance: 40000,
        isDeleted: false,
      });

      // Dealership 2 account
      customerAccounts.push({
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        dealershipId: { _id: dId2, name: "Dealership Two" },
        customerId: { _id: custId2, name: "Customer Beta" },
        currentBalance: 60000,
        isDeleted: false,
      });

      // Dealership 1 report
      const rep1 = await FinancialReportService.getArAgingReport({
        businessId: bId,
        dealershipId: dId1,
      });
      assert.equal(rep1.summary.totalReceivables, 40000);
      assert.equal(rep1.customers.length, 1);
      assert.equal(rep1.customers[0].customerName, "Customer Alpha");

      // Consolidated Business report (no dealershipId filter)
      const repAll = await FinancialReportService.getArAgingReport({
        businessId: bId,
      });
      assert.equal(repAll.summary.totalReceivables, 100000);
      assert.equal(repAll.customers.length, 2);
    });
  });

  // =========================================================================
  // 2. AP AGING REPORT TESTS
  // =========================================================================
  describe("2. Accounts Payable (AP) Aging Engine", () => {
    test("Correctly aggregates supplier payables across aging buckets and reconciles against GL 2010", async () => {
      const asOf = new Date("2026-11-26T12:00:00Z");

      // Setup Payables for Vendor 1
      supplierPayables.push({
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        dealershipId: { _id: dId1, name: "Dhaka Central Motors" },
        supplierId: { _id: vendorId1, name: "Yamaha Motors Ltd", code: "V-YAM" },
        principalCompanyId: { _id: pcId1, name: "Yamaha Japan" },
        outstandingBalance: 50000,
        invoiceDate: new Date("2026-11-26T00:00:00Z"), // Current
        status: "UNPAID",
      });

      supplierPayables.push({
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        dealershipId: { _id: dId1, name: "Dhaka Central Motors" },
        supplierId: { _id: vendorId1, name: "Yamaha Motors Ltd", code: "V-YAM" },
        principalCompanyId: { _id: pcId1, name: "Yamaha Japan" },
        outstandingBalance: 30000,
        invoiceDate: new Date("2026-10-15T00:00:00Z"), // 42 days -> 31-60 D
        status: "PARTIALLY_PAID",
      });

      // Setup Payable for Vendor 2
      supplierPayables.push({
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        dealershipId: { _id: dId1, name: "Dhaka Central Motors" },
        supplierId: { _id: vendorId2, name: "Atlas Battery Co", code: "V-ATL" },
        principalCompanyId: null,
        outstandingBalance: 20000,
        invoiceDate: new Date("2026-08-01T00:00:00Z"), // 117 days -> 90+ D
        status: "UNPAID",
      });

      // GL Account 2010 (Accounts Payable) setup matching ৳100,000
      accounts.push({
        _id: new mongoose.Types.ObjectId(),
        code: "2010",
        name: "Accounts Payable",
        category: "LIABILITY",
        businessId: bId,
        dealershipId: dId1,
        balance: 100000,
        status: "active",
      });

      const report = await FinancialReportService.getApAgingReport({
        businessId: bId,
        dealershipId: dId1,
        asOfDate: asOf,
      });

      assert.equal(report.summary.totalPayables, 100000);
      assert.equal(report.summary.totalCurrent, 50000);
      assert.equal(report.summary.totalDays31_60, 30000);
      assert.equal(report.summary.totalDays90Plus, 20000);
      assert.equal(report.summary.vendorCount, 2);
      assert.equal(report.summary.payablesCount, 3);

      // Verify GL 2010 Reconciliation
      assert.equal(report.reconciliation.glAccountCode, "2010");
      assert.equal(report.reconciliation.glBalance, 100000);
      assert.equal(report.reconciliation.subledgerTotal, 100000);
      assert.equal(report.reconciliation.isReconciled, true);

      // Check vendor 1 aggregation (50k + 30k = 80k)
      const v1 = report.suppliers.find((s) => s.vendorCode === "V-YAM");
      assert.ok(v1);
      assert.equal(v1.outstandingBalance, 80000);
      assert.equal(v1.current, 50000);
      assert.equal(v1.days31_60, 30000);
      assert.equal(v1.principalCompanyName, "Yamaha Japan");
    });

    test("Principal-Company filtering restricts AP Aging to designated manufacturer payables", async () => {
      supplierPayables.push({
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        dealershipId: { _id: dId1 },
        supplierId: { _id: vendorId1, name: "Yamaha Motors" },
        principalCompanyId: { _id: pcId1, name: "Yamaha" },
        outstandingBalance: 60000,
        invoiceDate: new Date(),
        status: "UNPAID",
      });

      supplierPayables.push({
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        dealershipId: { _id: dId1 },
        supplierId: { _id: vendorId2, name: "Honda Parts" },
        principalCompanyId: { _id: new mongoose.Types.ObjectId(), name: "Honda" },
        outstandingBalance: 40000,
        invoiceDate: new Date(),
        status: "UNPAID",
      });

      const rep = await FinancialReportService.getApAgingReport({
        businessId: bId,
        principalCompanyId: pcId1,
      });

      assert.equal(rep.summary.totalPayables, 60000);
      assert.equal(rep.suppliers.length, 1);
      assert.equal(rep.suppliers[0].vendorName, "Yamaha Motors");
    });
  });

  // =========================================================================
  // 3. CASH & BANK RECONCILIATION TESTS
  // =========================================================================
  describe("3. Cash & Bank Reconciliation Engine", () => {
    test("Calculates opening balance, period activity, and closing balance correctly", async () => {
      const bankAccId = new mongoose.Types.ObjectId();
      const bankAccount = {
        _id: bankAccId,
        code: "1020",
        name: "Standard Chartered Bank",
        category: "ASSET",
        type: "asset",
        subType: "bank",
        isSharedTreasury: true,
        businessId: bId,
        balance: 150000,
        status: "active",
      };
      accounts.push(bankAccount);

      // Journal 1: Prior to period -> Opening Balance = ৳100,000 (Debit)
      journalEntries.push({
        _id: new mongoose.Types.ObjectId(),
        journalNumber: "JE-2026-0001",
        businessId: bId,
        postingDate: new Date("2026-10-31T00:00:00Z"),
        isPosted: true,
        sourceType: "MANUAL",
        narration: "Initial deposit",
        lines: [
          { accountId: bankAccId, debit: 100000, credit: 0 },
          { accountId: new mongoose.Types.ObjectId(), debit: 0, credit: 100000 },
        ],
      });

      // Journal 2: In period -> Deposit ৳80,000 (Debit)
      journalEntries.push({
        _id: new mongoose.Types.ObjectId(),
        journalNumber: "JE-2026-0002",
        businessId: bId,
        postingDate: new Date("2026-11-05T00:00:00Z"),
        isPosted: true,
        sourceType: "PAYMENT",
        narration: "Customer collection",
        lines: [
          { accountId: bankAccId, debit: 80000, credit: 0 },
          { accountId: new mongoose.Types.ObjectId(), debit: 0, credit: 80000 },
        ],
      });

      // Journal 3: In period -> Payment ৳30,000 (Credit)
      journalEntries.push({
        _id: new mongoose.Types.ObjectId(),
        journalNumber: "JE-2026-0003",
        businessId: bId,
        postingDate: new Date("2026-11-15T00:00:00Z"),
        isPosted: true,
        sourceType: "EXPENSE",
        narration: "Supplier payment",
        lines: [
          { accountId: new mongoose.Types.ObjectId(), debit: 30000, credit: 0 },
          { accountId: bankAccId, debit: 0, credit: 30000 },
        ],
      });

      // Fetch reconciliation for November 2026
      const rec = await FinancialReportService.getCashBankReconciliation({
        businessId: bId,
        accountId: bankAccId,
        startDate: new Date("2026-11-01T00:00:00Z"),
        endDate: new Date("2026-11-30T23:59:59Z"),
        statementEndingBalance: 150000,
      });

      assert.equal(rec.sharedTreasury.accounts.length, 1);
      const accItem = rec.sharedTreasury.accounts[0];
      assert.equal(accItem.openingBalance, 100000);
      assert.equal(accItem.periodDebits, 80000);
      assert.equal(accItem.periodCredits, 30000);
      assert.equal(accItem.closingBalance, 150000);
      assert.equal(accItem.statementEndingBalance, 150000);
      assert.equal(accItem.discrepancy, 0);
      assert.equal(accItem.reconciliationStatus, "RECONCILED");
      assert.equal(accItem.transactionsCount, 2); // 2 in-period transactions
    });

    test("Preserves shared business treasury accounts strictly distinct from dealership operating accounts", async () => {
      // Shared Treasury Account: GL 1010 Central Cash
      accounts.push({
        _id: new mongoose.Types.ObjectId(),
        code: "1010",
        name: "Central Cash Vault",
        category: "ASSET",
        type: "asset",
        subType: "cash",
        isSharedTreasury: true,
        businessId: bId,
        balance: 500000,
        status: "active",
      });

      // Dealership Operating Account: Branch Petty Cash
      accounts.push({
        _id: new mongoose.Types.ObjectId(),
        code: "1010-D1",
        name: "Dhaka Branch Operating Cash",
        category: "ASSET",
        type: "asset",
        subType: "cash",
        isSharedTreasury: false,
        businessId: bId,
        dealershipId: { _id: dId1, name: "Dhaka Branch" },
        balance: 25000,
        status: "active",
      });

      const rec = await FinancialReportService.getCashBankReconciliation({
        businessId: bId,
        dealershipId: dId1,
      });

      // Shared treasury must be in sharedTreasury section
      assert.equal(rec.sharedTreasury.accounts.length, 1);
      assert.equal(rec.sharedTreasury.accounts[0].accountCode, "1010");
      assert.equal(rec.sharedTreasury.totalClosing, 500000);

      // Dealership operating account must be in dealershipTreasury section
      assert.equal(rec.dealershipTreasury.accounts.length, 1);
      assert.equal(rec.dealershipTreasury.accounts[0].accountCode, "1010-D1");
      assert.equal(rec.dealershipTreasury.totalClosing, 25000);

      // Summary must separate them cleanly
      assert.equal(rec.summary.sharedTreasuryClosing, 500000);
      assert.equal(rec.summary.dealershipTreasuryClosing, 25000);
      assert.equal(rec.summary.totalTreasury, 525000);
    });

    test("recordBankReconciliation creates durable snapshot and flags discrepancies", async () => {
      const bankAccId = new mongoose.Types.ObjectId();
      accounts.push({
        _id: bankAccId,
        code: "1020",
        name: "City Bank Corporate",
        category: "ASSET",
        type: "asset",
        subType: "bank",
        isSharedTreasury: true,
        businessId: bId,
        balance: 200000,
        status: "active",
      });

      // Bank statement says ৳195,000 (discrepancy of -5,000)
      const doc = await FinancialReportService.recordBankReconciliation({
        businessId: bId,
        accountId: bankAccId,
        statementDate: new Date("2026-11-26"),
        statementEndingBalance: 195000,
        notes: "Bank fee not yet reflected in GL",
      });

      assert.ok(doc._id);
      assert.equal(doc.statementEndingBalance, 195000);
      assert.equal(doc.ledgerClosingBalance, 200000);
      assert.equal(doc.discrepancy, -5000);
      assert.equal(doc.status, "DISCREPANCY");
      assert.equal(doc.isSharedTreasury, true);
      assert.equal(bankReconciliations.length, 1);
    });
  });

  // =========================================================================
  // 4. FINANCIAL REPORT CONSISTENCY & INTEGRITY TESTS
  // =========================================================================
  describe("4. Financial Report Consistency & Accounting Integrity", () => {
    test("Excludes draft journals and respects posted-only constraint", async () => {
      const cashAccId = new mongoose.Types.ObjectId();
      accounts.push({
        _id: cashAccId,
        code: "1010",
        name: "Cash",
        category: "ASSET",
        type: "asset",
        subType: "cash",
        isSharedTreasury: true,
        businessId: bId,
        balance: 10000,
        status: "active",
      });

      // DRAFT journal (should NOT be included in reconciliation or financial statements)
      journalEntries.push({
        _id: new mongoose.Types.ObjectId(),
        journalNumber: "JE-DRAFT",
        businessId: bId,
        postingDate: new Date(),
        isPosted: false, // DRAFT!
        status: "DRAFT",
        lines: [
          { accountId: cashAccId, debit: 50000, credit: 0 },
          { accountId: new mongoose.Types.ObjectId(), debit: 0, credit: 50000 },
        ],
      });

      const rec = await FinancialReportService.getCashBankReconciliation({
        businessId: bId,
        accountId: cashAccId,
      });

      const accItem = rec.sharedTreasury.accounts[0];
      // Transaction count must be 0 because the draft journal is excluded
      assert.equal(accItem.transactionsCount, 0);
      assert.equal(accItem.periodDebits, 0);
    });

    test("AccountingService delegate methods successfully forward to FinancialReportService", async () => {
      // Setup AR account
      customerAccounts.push({
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        dealershipId: { _id: dId1 },
        customerId: { _id: custId1, name: "Customer X" },
        currentBalance: 12000,
        isDeleted: false,
      });

      const arReport = await AccountingService.getArAgingReport({
        businessId: bId,
      });
      assert.equal(arReport.summary.totalReceivables, 12000);

      // Setup AP account
      supplierPayables.push({
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        dealershipId: { _id: dId1 },
        supplierId: { _id: vendorId1, name: "Supplier Y" },
        outstandingBalance: 8000,
        invoiceDate: new Date(),
        status: "UNPAID",
      });

      const apReport = await AccountingService.getApAgingReport({
        businessId: bId,
      });
      assert.equal(apReport.summary.totalPayables, 8000);
    });
  });
});
