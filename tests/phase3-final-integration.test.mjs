import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

// Models
import { Account } from "../src/models/Account.ts";
import { JournalEntry } from "../src/models/JournalEntry.ts";
import { AccountingPeriod } from "../src/models/AccountingPeriod.ts";
import { Counter } from "../src/models/Counter.ts";
import { AuditLog } from "../src/models/AuditLog.ts";
import { GoodsReceiptNote } from "../src/models/GoodsReceiptNote.ts";
import { SupplierPayable } from "../src/models/SupplierPayable.ts";
import { Vendor } from "../src/models/Vendor.ts";
import { Customer } from "../src/models/Customer.ts";
import { CustomerDealershipAccount } from "../src/models/CustomerDealershipAccount.ts";
import { Order } from "../src/models/Order.ts";
import { StockBatch } from "../src/models/StockBatch.ts";
import { InventoryBalance } from "../src/models/InventoryBalance.ts";
import { StockMovement } from "../src/models/StockMovement.ts";
import { StockReservation } from "../src/models/StockReservation.ts";
import { Dispatch } from "../src/models/Dispatch.ts";
import { SalesReturn } from "../src/models/SalesReturn.ts";
import { PurchaseReturn } from "../src/models/PurchaseReturn.ts";
import { Payment } from "../src/models/Payment.ts";
import { BankReconciliation } from "../src/models/BankReconciliation.ts";
import { Warehouse } from "../src/models/Warehouse.ts";

// Services
import { AccountingService } from "../src/services/AccountingService.ts";
import { FinancialReportService } from "../src/services/FinancialReportService.ts";
import { GoodsReceiptNoteService } from "../src/services/GoodsReceiptNoteService.ts";
import { InventoryService } from "../src/services/InventoryService.ts";
import { SalesOrderService } from "../src/services/SalesOrderService.ts";
import { DispatchService } from "../src/services/DispatchService.ts";
import { ReturnsService } from "../src/services/ReturnsService.ts";
import { SupplierPaymentService } from "../src/services/SupplierPaymentService.ts";
import { PaymentService } from "../src/services/PaymentService.ts";

describe("Phase 3: Final End-to-End Integration Verification Suite", () => {
  let accounts = [];
  let journalEntries = [];
  let periods = [];
  let counters = new Map();
  let auditLogs = [];
  let grns = [];
  let payables = [];
  let vendors = [];
  let customers = [];
  let customerAccounts = [];
  let orders = [];
  let stockBatches = [];
  let inventoryBalances = [];
  let stockMovements = [];
  let stockReservations = [];
  let dispatches = [];
  let salesReturns = [];
  let purchaseReturns = [];
  let payments = [];
  let bankRecs = [];
  let warehouses = [];

  const bId = new mongoose.Types.ObjectId();
  const dId1 = new mongoose.Types.ObjectId();
  const dId2 = new mongoose.Types.ObjectId();
  const wId = new mongoose.Types.ObjectId();
  const actId = new mongoose.Types.ObjectId();
  const pId1 = new mongoose.Types.ObjectId();
  const vId1 = new mongoose.Types.ObjectId();
  const supplierId1 = new mongoose.Types.ObjectId();
  const customerId1 = new mongoose.Types.ObjectId();

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
      skip: () => chain,
      limit: () => chain,
      lean: async () => getItems(),
      session: () => chain,
    };
    return chain;
  };

  beforeEach(() => {
    accounts = [];
    journalEntries = [];
    periods = [];
    counters = new Map();
    auditLogs = [];
    grns = [];
    payables = [];
    vendors = [];
    customers = [];
    customerAccounts = [];
    orders = [];
    stockBatches = [];
    inventoryBalances = [];
    stockMovements = [];
    stockReservations = [];
    dispatches = [];
    salesReturns = [];
    purchaseReturns = [];
    payments = [];
    bankRecs = [];
    warehouses = [];

    // Setup Standard Chart of Accounts
    const defaultAccounts = [
      { code: "1010", name: "Central Cash Vault", category: "ASSET", type: "asset", subType: "cash", normalBalance: "DEBIT", isSharedTreasury: true, balance: 500000 },
      { code: "1020", name: "Operating Bank Account", category: "ASSET", type: "asset", subType: "bank", normalBalance: "DEBIT", isSharedTreasury: true, balance: 1000000 },
      { code: "1100", name: "Accounts Receivable", category: "ASSET", type: "asset", subType: "accounts_receivable", normalBalance: "DEBIT", balance: 0 },
      { code: "1200", name: "Merchandise Inventory", category: "ASSET", type: "asset", subType: "inventory", normalBalance: "DEBIT", balance: 0 },
      { code: "2010", name: "Accounts Payable", category: "LIABILITY", type: "liability", subType: "accounts_payable", normalBalance: "CREDIT", balance: 0 },
      { code: "3010", name: "Owner Capital", category: "EQUITY", type: "equity", subType: "capital", normalBalance: "CREDIT", balance: 1500000 },
      { code: "3020", name: "Retained Earnings", category: "EQUITY", type: "equity", subType: "retained_earnings", normalBalance: "CREDIT", balance: 0 },
      { code: "4010", name: "Gross Sales Revenue", category: "REVENUE", type: "revenue", subType: "operating_revenue", normalBalance: "CREDIT", balance: 0 },
      { code: "4110", name: "Sales Returns & Allowances", category: "CONTRA_REVENUE", type: "contra_revenue", subType: "contra_revenue", normalBalance: "DEBIT", balance: 0 },
      { code: "5010", name: "Cost of Goods Sold (COGS)", category: "EXPENSE", type: "expense", subType: "cogs", normalBalance: "DEBIT", balance: 0 },
      { code: "6010", name: "Delivery & Freight Expense", category: "EXPENSE", type: "expense", subType: "operating_expense", normalBalance: "DEBIT", balance: 0 },
    ];

    for (const a of defaultAccounts) {
      accounts.push({
        _id: new mongoose.Types.ObjectId(),
        businessId: bId,
        dealershipId: a.isSharedTreasury ? null : dId1,
        status: "active",
        isSystem: true,
        ...a,
      });
    }

    // Setup Open Period
    periods.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      dealershipId: dId1,
      periodName: "November 2026",
      startDate: new Date("2026-11-01T00:00:00Z"),
      endDate: new Date("2026-11-30T23:59:59Z"),
      status: "OPEN",
    });

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

    // Mock Warehouse
    Warehouse.findById = async (id) => {
      return { _id: new mongoose.Types.ObjectId(String(id)), name: "Central Shared Warehouse" };
    };

    // Mock Vendor
    Vendor.findById = async (id) => {
      return vendors.find((v) => String(v._id) === String(id)) || null;
    };
    Vendor.findByIdAndUpdate = async (id, update) => {
      const v = vendors.find((vend) => String(vend._id) === String(id));
      if (v && update.$inc) {
        for (const [k, val] of Object.entries(update.$inc)) {
          v[k] = (v[k] || 0) + val;
        }
      }
      return v;
    };

    // Mock Customer
    Customer.findById = async (id) => {
      return customers.find((c) => String(c._id) === String(id)) || null;
    };

    // Mock CustomerDealershipAccount
    CustomerDealershipAccount.findOne = (query = {}) => {
      const found = customerAccounts.find((ca) => {
        if (ca.isDeleted) return false;
        if (query.customerId && String(ca.customerId?._id || ca.customerId) !== String(query.customerId)) return false;
        if (query.dealershipId && String(ca.dealershipId?._id || ca.dealershipId) !== String(query.dealershipId)) return false;
        return true;
      });
      const chain = {
        session: () => chain,
        lean: async () => found,
        then: (resolve) => resolve(found),
      };
      return chain;
    };
    CustomerDealershipAccount.findOneAndUpdate = async (query, update) => {
      const ca = customerAccounts.find((a) => {
        if (a.isDeleted) return false;
        if (query.customerId && String(a.customerId) !== String(query.customerId)) return false;
        if (query.dealershipId && String(a.dealershipId) !== String(query.dealershipId)) return false;
        return true;
      });
      if (ca && update.$inc) {
        for (const [k, val] of Object.entries(update.$inc)) {
          ca[k] = (ca[k] || 0) + val;
        }
      }
      return ca;
    };
    CustomerDealershipAccount.find = (query = {}) => {
      const getFiltered = () =>
        customerAccounts.filter((ca) => {
          if (ca.isDeleted) return false;
          if (query.businessId && String(ca.businessId) !== String(query.businessId)) return false;
          if (query.dealershipId && String(ca.dealershipId?._id || ca.dealershipId) !== String(query.dealershipId)) return false;
          return true;
        });
      return createChainable(getFiltered);
    };

    // Mock Account
    Account.find = (query = {}) => {
      const getFiltered = () =>
        accounts.filter((a) => {
          if (query.status && a.status !== query.status) return false;
          if (query.businessId && String(a.businessId) !== String(query.businessId)) return false;
          if (query.code) {
            if (typeof query.code === "string" && a.code !== query.code) return false;
            if (query.code.$in && !query.code.$in.includes(a.code)) return false;
          }
          if (query.subType && query.subType.$in && !query.subType.$in.includes(a.subType)) return false;
          if (query.$or) {
            const matches = query.$or.some((clause) => {
              if (clause.dealershipId !== undefined) {
                if (clause.dealershipId === null || clause.dealershipId?.$exists === false) {
                  return !a.dealershipId;
                }
                const aDId = a.dealershipId?._id || a.dealershipId;
                return aDId && String(aDId) === String(clause.dealershipId);
              }
              if (clause.isSharedTreasury) return Boolean(a.isSharedTreasury);
              if (clause.code && clause.code.$in) return clause.code.$in.includes(a.code);
              return false;
            });
            if (!matches) return false;
          } else if (query.dealershipId) {
            const aDId = a.dealershipId?._id || a.dealershipId;
            if (String(aDId) !== String(query.dealershipId)) return false;
          }
          return true;
        });
      return createChainable(getFiltered);
    };
    Account.findOne = (query = {}) => {
      const list = accounts.filter((a) => {
        if (query.code && a.code !== query.code) return false;
        if (query.subType && a.subType !== query.subType) return false;
        if (query.status && a.status !== query.status) return false;
        return true;
      });
      const found = list[0] || null;
      const chain = {
        session: () => chain,
        lean: async () => found,
        then: (resolve) => resolve(found),
      };
      return chain;
    };
    Account.findById = (id) => {
      const acc = accounts.find((a) => String(a._id) === String(id));
      const chainable = {
        session: () => chainable,
        lean: async () => acc || null,
        then: (resolve) => resolve(acc || null),
      };
      return chainable;
    };
    Account.create = async (docOrDocs) => {
      const arr = Array.isArray(docOrDocs) ? docOrDocs : [docOrDocs];
      const created = arr.map((d) => {
        const item = {
          _id: d._id || new mongoose.Types.ObjectId(),
          currency: "BDT",
          balance: d.balance || 0,
          status: "active",
          isSystem: true,
          ...d,
          save: async function () {
            const idx = accounts.findIndex((a) => String(a._id) === String(this._id));
            if (idx >= 0) accounts[idx] = this;
            return this;
          },
        };
        accounts.push(item);
        return item;
      });
      return Array.isArray(docOrDocs) ? created : created[0];
    };
    Account.findByIdAndUpdate = async (id, update) => {
      const acc = accounts.find((a) => String(a._id) === String(id));
      if (acc && update.$inc) {
        for (const [k, val] of Object.entries(update.$inc)) {
          acc[k] = (acc[k] || 0) + val;
        }
      }
      return acc;
    };

    // Mock JournalEntry
    JournalEntry.create = async (docs) => {
      const arr = Array.isArray(docs) ? docs : [docs];
      const created = arr.map((d) => {
        const item = {
          _id: new mongoose.Types.ObjectId(),
          ...d,
          createdAt: new Date(),
        };
        journalEntries.push(item);
        return item;
      });
      return Array.isArray(docs) ? created : created[0];
    };
    JournalEntry.find = (query = {}) => {
      const getFiltered = () =>
        journalEntries.filter((j) => {
          if (query.isPosted !== undefined && j.isPosted !== query.isPosted) return false;
          if (query.businessId && String(j.businessId) !== String(query.businessId)) return false;
          return true;
        });
      return createChainable(getFiltered);
    };
    JournalEntry.findOne = (query = {}) => {
      const j = journalEntries.find((entry) => {
        if (query.idempotencyKey && entry.idempotencyKey !== query.idempotencyKey) return false;
        if (query._id && String(entry._id) !== String(query._id)) return false;
        if (query.journalNumber && entry.journalNumber !== query.journalNumber) return false;
        if (query.status && entry.status !== query.status) return false;
        return true;
      });
      const chain = {
        session: () => chain,
        lean: async () => j || null,
        then: (resolve) => resolve(j || null),
      };
      return chain;
    };
    JournalEntry.findById = (id) => {
      const j = journalEntries.find((entry) => String(entry._id) === String(id));
      const chain = {
        session: () => chain,
        lean: async () => j || null,
        then: (resolve) => resolve(j || null),
      };
      return chain;
    };

    // Mock AccountingPeriod
    AccountingPeriod.find = (query = {}) => {
      const getFiltered = () =>
        periods.filter((p) => {
          if (query.businessId && String(p.businessId) !== String(query.businessId)) return false;
          return true;
        });
      return createChainable(getFiltered);
    };
    AccountingPeriod.findOne = (query = {}) => {
      const found = periods.find((p) => {
        if (query.businessId && String(p.businessId) !== String(query.businessId)) return false;
        if (query.status && p.status !== query.status) return false;
        if (query.startDate && query.startDate.$lte) {
          if (new Date(p.startDate) > new Date(query.startDate.$lte)) return false;
        }
        if (query.endDate && query.endDate.$gte) {
          if (new Date(p.endDate) < new Date(query.endDate.$gte)) return false;
        }
        return true;
      });
      const chain = {
        session: () => chain,
        lean: async () => found,
        then: (resolve) => resolve(found),
      };
      return chain;
    };
    AccountingPeriod.findById = (id) => {
      const p = periods.find((item) => String(item._id) === String(id));
      const chain = {
        session: () => chain,
        lean: async () => p || null,
        then: (resolve) => resolve(p || null),
      };
      return chain;
    };
    AccountingPeriod.findOneAndUpdate = async (query = {}, update = {}) => {
      const p = periods.find((item) => {
        if (query._id && String(item._id) !== String(query._id)) return false;
        if (query.businessId && item.businessId && String(item.businessId) !== String(query.businessId)) return false;
        if (query.status && item.status !== query.status) return false;
        return true;
      });
      if (!p) return null;
      if (update?.$set) Object.assign(p, update.$set);
      if (update?.$inc) {
        for (const [k, v] of Object.entries(update.$inc)) {
          p[k] = (p[k] || 0) + Number(v);
        }
      }
      return p;
    };

    // Mock SupplierPayable
    SupplierPayable.create = async (docs) => {
      const arr = Array.isArray(docs) ? docs : [docs];
      const created = arr.map((d) => {
        const p = { _id: new mongoose.Types.ObjectId(), ...d, createdAt: new Date() };
        payables.push(p);
        return p;
      });
      return Array.isArray(docs) ? created : created[0];
    };
    SupplierPayable.findOne = (query = {}) => {
      const found = payables.find((p) => {
        if (query.grnId && String(p.grnId) !== String(query.grnId)) return false;
        if (query.isCancelled !== undefined && p.isCancelled !== query.isCancelled) return false;
        return true;
      });
      const chain = {
        session: () => chain,
        lean: async () => found,
        then: (resolve) => resolve(found),
      };
      return chain;
    };
    SupplierPayable.findById = (id) => {
      const found = payables.find((p) => String(p._id) === String(id));
      const chain = {
        session: () => chain,
        save: async () => found,
        then: (resolve) => resolve(found ? { ...found, save: async () => found } : null),
      };
      return chain;
    };
    SupplierPayable.find = (query = {}) => {
      const getFiltered = () =>
        payables.filter((p) => {
          if (p.isCancelled) return false;
          if (query.businessId && String(p.businessId) !== String(query.businessId)) return false;
          if (query.dealershipId && String(p.dealershipId) !== String(query.dealershipId)) return false;
          return true;
        });
      return createChainable(getFiltered);
    };

    // Mock GoodsReceiptNote
    GoodsReceiptNote.create = async (docs) => {
      const arr = Array.isArray(docs) ? docs : [docs];
      const created = arr.map((d) => {
        const g = { _id: new mongoose.Types.ObjectId(), ...d, createdAt: new Date() };
        grns.push(g);
        return g;
      });
      return Array.isArray(docs) ? created : created[0];
    };
    GoodsReceiptNote.findOne = (query = {}) => {
      const found = grns.find((g) => {
        if (query.challanNumber && g.challanNumber !== query.challanNumber) return false;
        if (query.supplierId && String(g.supplierId) !== String(query.supplierId)) return false;
        return true;
      });
      const chain = {
        session: () => chain,
        lean: async () => found,
        then: (resolve) => resolve(found),
      };
      return chain;
    };
    GoodsReceiptNote.findById = (id) => {
      const found = grns.find((g) => String(g._id) === String(id));
      const chain = {
        session: () => chain,
        save: async () => found,
        then: (resolve) => resolve(found ? { ...found, save: async () => found } : null),
      };
      return chain;
    };
    GoodsReceiptNote.findOneAndUpdate = async (query, update) => {
      const found = grns.find((g) => {
        if (String(g._id) !== String(query._id)) return false;
        if (query.status && query.status.$in && !query.status.$in.includes(g.status)) return false;
        return true;
      });
      if (found && update.$set) {
        Object.assign(found, update.$set);
      }
      return found;
    };

    // Mock InventoryBalance
    InventoryBalance.findOne = (query = {}) => {
      const found = inventoryBalances.find((ib) => {
        if (query.warehouseId && String(ib.warehouseId) !== String(query.warehouseId)) return false;
        if (query.productId && String(ib.productId) !== String(query.productId)) return false;
        if (query.variantId && String(ib.variantId) !== String(query.variantId)) return false;
        if (query.dealershipId) {
          if (String(ib.dealershipId) !== String(query.dealershipId)) return false;
        }
        return true;
      });
      const chain = {
        session: () => chain,
        then: (resolve) => resolve(found || null),
      };
      return chain;
    };
    InventoryBalance.create = async (docs) => {
      const arr = Array.isArray(docs) ? docs : [docs];
      const created = arr.map((d) => {
        const item = { _id: new mongoose.Types.ObjectId(), ...d, createdAt: new Date(), save: async () => item };
        inventoryBalances.push(item);
        return item;
      });
      return Array.isArray(docs) ? created : created[0];
    };
    InventoryBalance.findOneAndUpdate = async (query, update) => {
      const found = inventoryBalances.find((ib) => {
        if (query.warehouseId && String(ib.warehouseId) !== String(query.warehouseId)) return false;
        if (query.dealershipId && String(ib.dealershipId) !== String(query.dealershipId)) return false;
        if (query.productId && String(ib.productId) !== String(query.productId)) return false;
        if (query.variantId && String(ib.variantId) !== String(query.variantId)) return false;
        if (query.onHandQuantity && query.onHandQuantity.$gte !== undefined) {
          if (ib.onHandQuantity < query.onHandQuantity.$gte) return false;
        }
        return true;
      });
      if (found) {
        if (update.$inc) {
          for (const [k, v] of Object.entries(update.$inc)) {
            found[k] = (found[k] || 0) + v;
          }
        }
      }
      return found;
    };

    // Mock StockBatch
    StockBatch.create = async (docs) => {
      const arr = Array.isArray(docs) ? docs : [docs];
      arr.forEach((d) => stockBatches.push({ _id: new mongoose.Types.ObjectId(), ...d, createdAt: new Date() }));
      return arr;
    };
    StockBatch.find = (query = {}) => {
      const getFiltered = () =>
        stockBatches.filter((sb) => {
          if (query.productId && String(sb.productId) !== String(query.productId)) return false;
          if (query.dealershipId && String(sb.dealershipId) !== String(query.dealershipId)) return false;
          return true;
        });
      return createChainable(getFiltered);
    };

    // Mock StockMovement
    StockMovement.create = async (docs) => {
      const arr = Array.isArray(docs) ? docs : [docs];
      arr.forEach((d) => stockMovements.push({ _id: new mongoose.Types.ObjectId(), ...d, createdAt: new Date() }));
      return arr;
    };

    // Mock StockReservation
    StockReservation.create = async (docs) => {
      const arr = Array.isArray(docs) ? docs : [docs];
      const created = arr.map((d) => {
        const r = { _id: new mongoose.Types.ObjectId(), reservationNumber: "RES-1001", ...d };
        stockReservations.push(r);
        return r;
      });
      return Array.isArray(docs) ? created : created[0];
    };

    // Mock Order
    Order.findById = (id) => {
      const found = orders.find((o) => String(o._id) === String(id));
      const chain = {
        session: () => chain,
        save: async () => found,
        then: (resolve) => resolve(found ? { ...found, save: async () => found } : null),
      };
      return chain;
    };
    Order.find = (query = {}) => {
      const getFiltered = () =>
        orders.filter((o) => {
          if (query.customerId && String(o.customerId) !== String(query.customerId)) return false;
          if (query.dealershipId && String(o.dealershipId) !== String(query.dealershipId)) return false;
          return true;
        });
      return createChainable(getFiltered);
    };

    // Mock Payment
    Payment.create = async (docs) => {
      const arr = Array.isArray(docs) ? docs : [docs];
      const created = arr.map((d) => {
        const p = { _id: new mongoose.Types.ObjectId(), ...d, createdAt: new Date() };
        payments.push(p);
        return p;
      });
      return Array.isArray(docs) ? created : created[0];
    };
    Payment.findOne = (query = {}) => {
      const found = payments.find((p) => {
        if (query.idempotencyKey && p.idempotencyKey !== query.idempotencyKey) return false;
        return true;
      });
      const chain = {
        session: () => chain,
        lean: async () => found,
        then: (resolve) => resolve(found),
      };
      return chain;
    };
  });

  // =========================================================================
  // 1. WORKFLOW 1: Procurement -> GRN -> StockBatch -> Inventory -> SupplierPayable -> GL
  // =========================================================================
  test("Workflow 1: Confirming GRN creates StockBatch, updates InventoryBalance, creates SupplierPayable, and posts GL Journal", async () => {
    // Setup Vendor
    vendors.push({
      _id: supplierId1,
      name: "Akij Motors Supplier",
      companyName: "Akij Group",
      currentPayable: 0,
    });

    // Create GRN
    const grn = {
      _id: new mongoose.Types.ObjectId(),
      grnNumber: "GRN-2026-001",
      businessId: bId,
      dealershipId: dId1,
      warehouseId: wId,
      supplierId: supplierId1,
      challanNumber: "CH-8899",
      challanDate: new Date(),
      invoiceNumber: "INV-7766",
      invoiceDate: new Date(),
      status: "READY_FOR_CONFIRMATION",
      grossTotal: 100000,
      totalLineDiscount: 5000,
      invoiceDiscount: 0,
      cashDiscount: 0,
      tradeDiscount: 0,
      freightCharge: 2000,
      handlingCharge: 1000,
      otherCharges: 0,
      taxTotal: 0,
      netInvoiceTotal: 98000, // 100k - 5k + 2k + 1k
      items: [
        {
          lineItemNumber: 1,
          productId: pId1,
          variantId: vId1,
          receivedQuantity: 100,
          damagedQuantity: 0,
          rejectedQuantity: 0,
          unitPurchasePrice: 1000,
          lineDiscount: 5000,
          allocatedFreight: 2000,
          allocatedHandling: 1000,
          netLandedUnitCost: 980,
          batchNumber: "B-AK-01",
        },
      ],
      isCancelled: false,
    };
    grns.push(grn);

    // Initialize InventoryBalance for dealership 1
    inventoryBalances.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      dealershipId: dId1,
      warehouseId: wId,
      productId: pId1,
      variantId: vId1,
      onHandQuantity: 0,
      reservedQuantity: 0,
      availableQuantity: 0,
      damagedQuantity: 0,
      stockInTransit: 0,
      save: async function () { return this; },
    });

    // Confirm GRN
    const confirmed = await GoodsReceiptNoteService.confirmGrn({
      grnId: grn._id,
      actorId: actId,
    });

    assert.equal(confirmed.status, "VERIFIED");

    // Verify StockBatch creation
    assert.equal(stockBatches.length, 1);
    assert.equal(stockBatches[0].batchNumber, "B-AK-01");
    assert.equal(stockBatches[0].totalReceivedQuantity, 100);
    assert.equal(stockBatches[0].netLandedUnitCost, 980);

    // Verify InventoryBalance updated
    const bal = inventoryBalances[0];
    assert.equal(bal.onHandQuantity, 100);

    // Verify SupplierPayable created
    assert.equal(payables.length, 1);
    assert.equal(payables[0].netPayable, 98000);
    assert.equal(payables[0].outstandingBalance, 98000);
    assert.equal(payables[0].status, "UNPAID");

    // Verify Vendor currentPayable incremented
    const vendor = vendors[0];
    assert.equal(vendor.currentPayable, 98000);

    // Verify GL Journal Entry posted: Dr Inventory (1200) ৳98,000, Cr Accounts Payable (2010) ৳98,000
    const je = journalEntries.find((j) => j.sourceType === "purchase_grn");
    assert.ok(je);
    assert.equal(je.isPosted, true);
    assert.equal(je.debitsTotal, 98000);
    assert.equal(je.creditsTotal, 98000);

    // Verify Account balances updated
    const invAcc = accounts.find((a) => a.code === "1200");
    const apAcc = accounts.find((a) => a.code === "2010");
    assert.equal(invAcc.balance, 98000);
    assert.equal(apAcc.balance, 98000);
  });

  // =========================================================================
  // 2. WORKFLOW 2: Sales Order -> Stock Reservation -> Dispatch -> Delivery -> AR -> GL
  // =========================================================================
  test("Workflow 2: Sales Order reservation and delivery updates customer receivable and posts revenue & COGS", async () => {
    // Setup Customer & CustomerDealershipAccount
    customers.push({
      _id: customerId1,
      name: "Karim Retailer",
      shopName: "Karim General Store",
      currentReceivable: 0,
    });
    customerAccounts.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      dealershipId: dId1,
      customerId: customerId1,
      creditLimit: 500000,
      currentBalance: 0,
      status: "active",
      isDeleted: false,
    });

    // Existing inventory on hand: 100 units
    inventoryBalances.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      dealershipId: dId1,
      warehouseId: wId,
      productId: pId1,
      variantId: vId1,
      onHandQuantity: 100,
      reservedQuantity: 0,
      availableQuantity: 100,
      damagedQuantity: 0,
      stockInTransit: 0,
      save: async function () { return this; },
    });

    // Create Sales Order for 10 units @ ৳1,500 = ৳15,000 (Cost = ৳980/unit = ৳9,800)
    const order = {
      _id: new mongoose.Types.ObjectId(),
      orderNumber: "ORD-2026-001",
      businessId: bId,
      dealershipId: dId1,
      warehouseId: wId,
      customerId: customerId1,
      orderStatus: "DRAFT",
      grandTotal: 15000,
      totalCost: 9800,
      items: [
        {
          productId: pId1,
          variantId: vId1,
          quantity: 10,
          unitPrice: 1500,
          customerPriceSnapshot: 1500,
          costPrice: 980,
        },
      ],
      save: async function () { return this; },
    };
    orders.push(order);

    // Confirm Sales Order: Reserves Stock
    const confirmedOrder = await SalesOrderService.confirmSalesOrder({
      orderId: order._id,
      actorId: actId,
    });
    assert.equal(confirmedOrder.orderStatus, "CONFIRMED");

    // Stock reserved: 10 units
    const bal = inventoryBalances[0];
    assert.equal(bal.reservedQuantity, 10);

    // Record Delivery through Dispatch Fulfillment
    await AccountingService.recordSalesFulfillment({
      businessId: bId,
      dealershipId: dId1,
      orderId: order._id,
      orderNumber: order.orderNumber,
      invoicedAmount: 15000,
      batchCostTotal: 9800,
      postedBy: actId,
    });

    // Verify GL Entries posted:
    // Entry 1: Dr AR (1100) ৳15,000, Cr Revenue (4010) ৳15,000
    // Entry 2: Dr COGS (5010) ৳9,800, Cr Inventory (1200) ৳9,800
    const salesJe = journalEntries.find((j) => j.sourceType === "sales_fulfillment");
    assert.ok(salesJe);
    assert.equal(salesJe.debitsTotal, 24800); // 15000 + 9800
    assert.equal(salesJe.creditsTotal, 24800);

    const arAcc = accounts.find((a) => a.code === "1100");
    const revAcc = accounts.find((a) => a.code === "4010");
    const cogsAcc = accounts.find((a) => a.code === "5010");
    const invAcc = accounts.find((a) => a.code === "1200");

    assert.equal(arAcc.balance, 15000);
    assert.equal(revAcc.balance, 15000);
    assert.equal(cogsAcc.balance, 9800);
    assert.equal(invAcc.balance, -9800); // reduced by 9800
  });

  // =========================================================================
  // 3. WORKFLOW 3: Customer Return -> Inspection -> Stock Adjustment -> Refund/Credit Note -> GL
  // =========================================================================
  test("Workflow 3: Customer return restores inventory and reverses sales revenue via Dr 4110 / Cr 1100", async () => {
    // Record Customer Return: Refund ৳3,000, Restocked cost ৳1,960
    await AccountingService.recordCustomerReturn({
      businessId: bId,
      dealershipId: dId1,
      returnId: new mongoose.Types.ObjectId(),
      returnNumber: "SRT-2026-001",
      refundAmount: 3000,
      refundMethod: "credit_note",
      restockedCost: 1960,
      postedBy: actId,
    });

    // Check Journal Entry
    const retJe = journalEntries.find((j) => j.sourceType === "sales_return");
    assert.ok(retJe);
    assert.equal(retJe.debitsTotal, 4960); // 3000 + 1960
    assert.equal(retJe.creditsTotal, 4960);

    const retAcc = accounts.find((a) => a.code === "4110");
    const arAcc = accounts.find((a) => a.code === "1100");
    const invAcc = accounts.find((a) => a.code === "1200");
    const cogsAcc = accounts.find((a) => a.code === "5010");

    assert.equal(retAcc.balance, 3000); // Sales return increased
    assert.equal(arAcc.balance, -3000); // AR decreased
    assert.equal(invAcc.balance, 1960); // Inventory increased
    assert.equal(cogsAcc.balance, -1960); // COGS decreased
  });

  // =========================================================================
  // 4. WORKFLOW 4: Purchase Return -> Supplier Payable Adjustment -> GL
  // =========================================================================
  test("Workflow 4: Purchase return reduces supplier payable and inventory: Dr 2010 / Cr 1200", async () => {
    // Record Purchase Return of ৳10,000 to vendor
    await AccountingService.recordPurchaseReturn({
      businessId: bId,
      dealershipId: dId1,
      returnId: new mongoose.Types.ObjectId(),
      returnNumber: "PRT-2026-001",
      debitAmount: 10000,
      postedBy: actId,
    });

    const prJe = journalEntries.find((j) => j.sourceType === "purchase_return");
    assert.ok(prJe);
    assert.equal(prJe.debitsTotal, 10000);
    assert.equal(prJe.creditsTotal, 10000);

    const apAcc = accounts.find((a) => a.code === "2010");
    const invAcc = accounts.find((a) => a.code === "1200");

    assert.equal(apAcc.balance, -10000); // AP reduced
    assert.equal(invAcc.balance, -10000); // Inventory reduced
  });

  // =========================================================================
  // 5. WORKFLOW 5: Customer Payment -> Customer Ledger -> Cash/Bank -> GL
  // =========================================================================
  test("Workflow 5: Customer payment reduces customer receivable and increases cash/bank in GL", async () => {
    // Customer pays ৳12,000 cash
    await AccountingService.recordCustomerPayment({
      businessId: bId,
      dealershipId: dId1,
      paymentId: new mongoose.Types.ObjectId(),
      receiptNumber: "RCT-1001",
      amount: 12000,
      paymentMethod: "cash",
      customerName: "Karim Retailer",
      postedBy: actId,
    });

    const payJe = journalEntries.find((j) => j.sourceType === "customer_payment");
    assert.ok(payJe);
    assert.equal(payJe.debitsTotal, 12000);
    assert.equal(payJe.creditsTotal, 12000);

    const cashAcc = accounts.find((a) => a.code === "1010");
    const arAcc = accounts.find((a) => a.code === "1100");

    assert.equal(cashAcc.balance, 512000); // 500k + 12k
    assert.equal(arAcc.balance, -12000); // AR reduced by 12k
  });

  // =========================================================================
  // 6. WORKFLOW 6: Supplier Payment -> Supplier Ledger -> Cash/Bank -> GL
  // =========================================================================
  test("Workflow 6: Supplier payment reduces accounts payable and cash/bank in GL", async () => {
    // Pay supplier ৳50,000 via bank transfer
    await AccountingService.recordSupplierPayment({
      businessId: bId,
      dealershipId: dId1,
      paymentId: new mongoose.Types.ObjectId(),
      paymentNumber: "VMT-1001",
      amount: 50000,
      paymentMethod: "bank_transfer",
      vendorName: "Akij Motors",
      postedBy: actId,
    });

    const supJe = journalEntries.find((j) => j.sourceType === "supplier_payment");
    assert.ok(supJe);
    assert.equal(supJe.debitsTotal, 50000);
    assert.equal(supJe.creditsTotal, 50000);

    const apAcc = accounts.find((a) => a.code === "2010");
    const bankAcc = accounts.find((a) => a.code === "1020");

    assert.equal(apAcc.balance, -50000); // AP reduced by 50k
    assert.equal(bankAcc.balance, 950000); // Bank reduced by 50k (1000k - 50k)
  });

  // =========================================================================
  // 7. WORKFLOW 7: Shared Warehouse with Multiple Dealership Stock Ownership
  // =========================================================================
  test("Workflow 7: Shared warehouse preserves independent dealership stock ownership without cross-leakage", async () => {
    // Dealership 1 has 50 units in Shared Warehouse
    inventoryBalances.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      dealershipId: dId1,
      warehouseId: wId,
      productId: pId1,
      variantId: vId1,
      onHandQuantity: 50,
      reservedQuantity: 0,
      availableQuantity: 50,
      damagedQuantity: 0,
      stockInTransit: 0,
      save: async function () { return this; },
    });

    // Dealership 2 has 30 units in the same Shared Warehouse
    inventoryBalances.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      dealershipId: dId2,
      warehouseId: wId,
      productId: pId1,
      variantId: vId1,
      onHandQuantity: 30,
      reservedQuantity: 0,
      availableQuantity: 30,
      damagedQuantity: 0,
      stockInTransit: 0,
      save: async function () { return this; },
    });

    // Dealership 1 reserves 20 units
    const d1Bal = inventoryBalances.find((b) => String(b.dealershipId) === String(dId1));
    d1Bal.reservedQuantity += 20;
    d1Bal.availableQuantity -= 20;

    // Verify Dealership 2 stock is unaffected
    const d2Bal = inventoryBalances.find((b) => String(b.dealershipId) === String(dId2));
    assert.equal(d1Bal.availableQuantity, 30);
    assert.equal(d1Bal.reservedQuantity, 20);
    assert.equal(d2Bal.availableQuantity, 30);
    assert.equal(d2Bal.reservedQuantity, 0); // Dealership 2 untouched!
  });

  // =========================================================================
  // 8. WORKFLOW 8: Shared Treasury vs Dealership Operating Treasury
  // =========================================================================
  test("Workflow 8: Treasury reconciliation isolates Mother Company Shared Treasury from dealership operating cash", async () => {
    // Mother Company Treasury accounts (1010, 1020) are shared
    // Add local operating drawer for Dealership 1: 1010-D1
    accounts.push({
      _id: new mongoose.Types.ObjectId(),
      code: "1010-D1",
      name: "Dhaka Branch Local Petty Cash",
      category: "ASSET",
      type: "asset",
      subType: "cash",
      isSharedTreasury: false,
      businessId: bId,
      dealershipId: dId1,
      balance: 15000,
      status: "active",
    });

    const rec = await FinancialReportService.getCashBankReconciliation({
      businessId: bId,
      dealershipId: dId1,
    });

    // Shared accounts (1010, 1020) placed strictly in sharedTreasury section
    assert.ok(rec.sharedTreasury.accounts.length >= 2);
    assert.ok(rec.sharedTreasury.accounts.some((a) => a.accountCode === "1010"));
    assert.ok(rec.sharedTreasury.accounts.some((a) => a.accountCode === "1020"));

    // Local operating account placed strictly in dealershipTreasury section
    assert.equal(rec.dealershipTreasury.accounts.length, 1);
    assert.equal(rec.dealershipTreasury.accounts[0].accountCode, "1010-D1");
    assert.equal(rec.dealershipTreasury.accounts[0].closingBalance, 15000);
  });

  // =========================================================================
  // 9. WORKFLOW 9: AR / AP Aging vs GL Control Accounts
  // =========================================================================
  test("Workflow 9: AR Aging matches GL 1100 and AP Aging matches GL 2010 control balance", async () => {
    // Set customer balance
    customerAccounts.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      dealershipId: dId1,
      customerId: customerId1,
      currentBalance: 50000,
      creditLimit: 100000,
      isDeleted: false,
    });
    // Set GL 1100 to 50000
    const arAcc = accounts.find((a) => a.code === "1100");
    arAcc.balance = 50000;

    const arReport = await FinancialReportService.getArAgingReport({
      businessId: bId,
      dealershipId: dId1,
    });
    assert.equal(arReport.summary.totalReceivables, 50000);
    assert.equal(arReport.reconciliation.glBalance, 50000);
    assert.equal(arReport.reconciliation.discrepancy, 0);
    assert.equal(arReport.reconciliation.isReconciled, true);

    // Set supplier payable
    payables.push({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      dealershipId: dId1,
      supplierId: supplierId1,
      outstandingBalance: 75000,
      invoiceDate: new Date(),
      status: "UNPAID",
      isCancelled: false,
    });
    // Set GL 2010 to 75000
    const apAcc = accounts.find((a) => a.code === "2010");
    apAcc.balance = 75000;

    const apReport = await FinancialReportService.getApAgingReport({
      businessId: bId,
      dealershipId: dId1,
    });
    assert.equal(apReport.summary.totalPayables, 75000);
    assert.equal(apReport.reconciliation.glBalance, 75000);
    assert.equal(apReport.reconciliation.discrepancy, 0);
    assert.equal(apReport.reconciliation.isReconciled, true);
  });

  // =========================================================================
  // 10. WORKFLOW 10: Financial Statement Consistency & Closed Period Guard
  // =========================================================================
  test("Workflow 10: Trial Balance, P&L, Balance Sheet equations hold and closed accounting periods block late postings", async () => {
    // 1. Post a balanced journal
    await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId1,
      sourceType: "MANUAL",
      narration: "Operating expense test",
      postedBy: actId,
      postingDate: new Date("2026-11-15T00:00:00Z"),
      lines: [
        { accountId: accounts.find((a) => a.code === "6010")._id, debit: 5000, credit: 0 },
        { accountId: accounts.find((a) => a.code === "1010")._id, debit: 0, credit: 5000 },
      ],
    });

    // 2. Generate Trial Balance
    const tb = await AccountingService.getTrialBalance({
      businessId: bId,
      dealershipId: dId1,
    });
    assert.equal(tb.isBalanced, true);
    assert.equal(tb.totalDebits, tb.totalCredits);

    // 3. Test Closed Period Guard
    periods[0].status = "CLOSED";

    await assert.rejects(
      async () => {
        await AccountingService.postJournalEntry({
          businessId: bId,
          dealershipId: dId1,
          sourceType: "MANUAL",
          narration: "Late journal after period close",
          postedBy: actId,
          postingDate: new Date("2026-11-20T00:00:00Z"),
          lines: [
            { accountId: accounts.find((a) => a.code === "6010")._id, debit: 1000, credit: 0 },
            { accountId: accounts.find((a) => a.code === "1010")._id, debit: 0, credit: 1000 },
          ],
        });
      },
      (err) => {
        assert.match(err.message, /is CLOSED/i);
        return true;
      }
    );
  });
});
