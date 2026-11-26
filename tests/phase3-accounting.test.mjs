import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

// Models
import { Account } from "../src/models/Account.ts";
import { JournalEntry } from "../src/models/JournalEntry.ts";
import { AccountingPeriod } from "../src/models/AccountingPeriod.ts";
import { Counter } from "../src/models/Counter.ts";
import { AuditLog } from "../src/models/AuditLog.ts";

// Service
import { AccountingService } from "../src/services/AccountingService.ts";

describe("Phase 3 - Step 8: Financial Accounting & General Ledger Engine Test Suite", () => {
  let accounts = [];
  let journalEntries = [];
  let periods = [];
  let auditLogs = [];
  let counters = new Map();

  const bId = new mongoose.Types.ObjectId();
  const dId1 = new mongoose.Types.ObjectId();
  const dId2 = new mongoose.Types.ObjectId();
  const actId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    accounts = [];
    journalEntries = [];
    periods = [];
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

    // Mock Account model methods
    Account.find = (query = {}) => {
      let filtered = accounts.filter((a) => {
        if (query.status && a.status !== query.status) return false;
        if (query.businessId && String(a.businessId) !== String(query.businessId)) return false;
        if (query.$or) {
          const matches = query.$or.some((clause) => {
            if (clause.dealershipId) {
              if (clause.dealershipId.$exists === false || clause.dealershipId === null) {
                return !a.dealershipId;
              }
              return a.dealershipId && String(a.dealershipId) === String(clause.dealershipId);
            }
            return true;
          });
          if (!matches) return false;
        } else if (query.dealershipId && String(a.dealershipId) !== String(query.dealershipId)) {
          return false;
        }
        if (query.code && a.code !== query.code) return false;
        if (query.category && a.category !== query.category) return false;
        return true;
      });

      const chainable = {
        sort: (sortObj) => {
          if (sortObj?.code) {
            filtered.sort((a, b) => a.code.localeCompare(b.code));
          }
          return chainable;
        },
        lean: async () => filtered,
        session: () => chainable,
        then: (resolve, reject) => Promise.resolve(filtered).then(resolve, reject),
      };
      return chainable;
    };

    Account.findOne = (query = {}) => {
      const acc = accounts.find((a) => {
        if (query.code && a.code !== query.code) return false;
        if (query.subType && a.subType !== query.subType) return false;
        if (query.businessId && a.businessId && String(a.businessId) !== String(query.businessId)) return false;
        if (query.dealershipId && a.dealershipId && String(a.dealershipId) !== String(query.dealershipId)) return false;
        return true;
      });

      const chainable = {
        session: () => chainable,
        lean: async () => acc || null,
        then: (resolve, reject) => Promise.resolve(acc || null).then(resolve, reject),
      };
      return chainable;
    };

    Account.findById = (id) => {
      const acc = accounts.find((a) => String(a._id) === String(id));
      const chainable = {
        session: () => chainable,
        lean: async () => acc || null,
        then: (resolve, reject) => Promise.resolve(acc || null).then(resolve, reject),
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

    Account.findByIdAndUpdate = async (id, update, options = {}) => {
      const acc = accounts.find((a) => String(a._id) === String(id));
      if (!acc) return null;
      if (update?.$inc) {
        for (const [key, val] of Object.entries(update.$inc)) {
          acc[key] = Math.round(((acc[key] || 0) + Number(val)) * 100) / 100;
        }
      }
      if (update?.$set) {
        Object.assign(acc, update.$set);
      }
      return acc;
    };

    // Mock JournalEntry model methods
    JournalEntry.find = (query = {}) => {
      let filtered = journalEntries.filter((j) => {
        if (query.businessId && String(j.businessId) !== String(query.businessId)) return false;
        if (query.dealershipId && String(j.dealershipId) !== String(query.dealershipId)) return false;
        if (query.status && j.status !== query.status) return false;
        if (query.isPosted !== undefined && j.isPosted !== query.isPosted) return false;
        if (query.idempotencyKey && j.idempotencyKey !== query.idempotencyKey) return false;
        if (query.postingDate?.$gte && new Date(j.postingDate) < new Date(query.postingDate.$gte)) return false;
        if (query.postingDate?.$lte && new Date(j.postingDate) > new Date(query.postingDate.$lte)) return false;
        return true;
      });

      const chainable = {
        sort: (sortObj) => {
          filtered.sort((a, b) => new Date(a.postingDate || a.date).getTime() - new Date(b.postingDate || b.date).getTime());
          return chainable;
        },
        populate: () => chainable,
        skip: () => chainable,
        limit: () => chainable,
        lean: async () => filtered,
        session: () => chainable,
        then: (resolve, reject) => Promise.resolve(filtered).then(resolve, reject),
      };
      return chainable;
    };

    JournalEntry.findOne = (query = {}) => {
      const j = journalEntries.find((entry) => {
        if (query.idempotencyKey && entry.idempotencyKey !== query.idempotencyKey) return false;
        if (query._id && String(entry._id) !== String(query._id)) return false;
        if (query.journalNumber && entry.journalNumber !== query.journalNumber) return false;
        return true;
      });

      const chainable = {
        session: () => chainable,
        lean: async () => j || null,
        then: (resolve, reject) => Promise.resolve(j || null).then(resolve, reject),
      };
      return chainable;
    };

    JournalEntry.findById = (id) => {
      const j = journalEntries.find((entry) => String(entry._id) === String(id));
      const chainable = {
        session: () => chainable,
        lean: async () => j || null,
        then: (resolve, reject) => Promise.resolve(j || null).then(resolve, reject),
      };
      return chainable;
    };

    JournalEntry.findOneAndUpdate = async (query = {}, update = {}, options = {}) => {
      const j = journalEntries.find((entry) => {
        if (query._id && String(entry._id) !== String(query._id)) return false;
        if (query.status?.$in && !query.status.$in.includes(entry.status)) return false;
        if (query.reversedByJournalId?.$exists === false && entry.reversedByJournalId) return false;
        return true;
      });
      if (!j) return null;
      if (update?.$set) {
        Object.assign(j, update.$set);
      }
      return j;
    };

    JournalEntry.create = async (docOrDocs) => {
      const arr = Array.isArray(docOrDocs) ? docOrDocs : [docOrDocs];
      const created = arr.map((d) => {
        const item = {
          _id: d._id || new mongoose.Types.ObjectId(),
          createdAt: new Date(),
          updatedAt: new Date(),
          status: "POSTED",
          isPosted: true,
          ...d,
          save: async function () {
            const idx = journalEntries.findIndex((j) => String(j._id) === String(this._id));
            if (idx >= 0) journalEntries[idx] = this;
            return this;
          },
        };
        journalEntries.push(item);
        return item;
      });
      return created;
    };

    // Mock AccountingPeriod model methods
    AccountingPeriod.find = (query = {}) => {
      let filtered = periods.filter((p) => {
        if (query.businessId && String(p.businessId) !== String(query.businessId)) return false;
        if (query.dealershipId && String(p.dealershipId) !== String(query.dealershipId)) return false;
        if (query.status && p.status !== query.status) return false;
        return true;
      });

      const chainable = {
        sort: () => chainable,
        populate: () => chainable,
        lean: async () => filtered,
        session: () => chainable,
        then: (resolve, reject) => Promise.resolve(filtered).then(resolve, reject),
      };
      return chainable;
    };

    AccountingPeriod.findOne = (query = {}) => {
      const p = periods.find((item) => {
        if (query.businessId && item.businessId && String(item.businessId) !== String(query.businessId)) return false;
        if (query.status && item.status !== query.status) return false;
        if (query.startDate?.$lte && query.endDate?.$gte) {
          const date = new Date(query.startDate.$lte);
          if (date < new Date(item.startDate) || date > new Date(item.endDate)) return false;
        }
        return true;
      });

      const chainable = {
        session: () => chainable,
        lean: async () => p || null,
        then: (resolve, reject) => Promise.resolve(p || null).then(resolve, reject),
      };
      return chainable;
    };

    AccountingPeriod.findById = (id) => {
      const p = periods.find((item) => String(item._id) === String(id));
      const chainable = {
        session: () => chainable,
        lean: async () => p || null,
        then: (resolve, reject) => Promise.resolve(p || null).then(resolve, reject),
      };
      return chainable;
    };

    AccountingPeriod.create = async (docOrDocs) => {
      const arr = Array.isArray(docOrDocs) ? docOrDocs : [docOrDocs];
      const created = arr.map((d) => {
        const item = {
          _id: d._id || new mongoose.Types.ObjectId(),
          status: "OPEN",
          createdAt: new Date(),
          ...d,
          save: async function () {
            const idx = periods.findIndex((p) => String(p._id) === String(this._id));
            if (idx >= 0) periods[idx] = this;
            return this;
          },
        };
        periods.push(item);
        return item;
      });
      return Array.isArray(docOrDocs) ? created : created[0];
    };
  });

  // ========================================================
  // 1. Chart of Accounts & Shared Treasury Foundation
  // ========================================================
  test("1.1 should seed default Chart of Accounts with standard codes and categories", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);

    const seeded = await Account.find({ businessId: bId });
    assert.ok(seeded.length >= 19, `Expected at least 19 accounts seeded, got ${seeded.length}`);

    // Verify critical codes
    const cash = accounts.find((a) => a.code === "1010");
    const bank = accounts.find((a) => a.code === "1020");
    const ar = accounts.find((a) => a.code === "1100");
    const inv = accounts.find((a) => a.code === "1200");
    const ap = accounts.find((a) => a.code === "2010");
    const rev = accounts.find((a) => a.code === "4010");
    const ret = accounts.find((a) => a.code === "4110");
    const cogs = accounts.find((a) => a.code === "5010");

    assert.ok(cash && bank && ar && inv && ap && rev && ret && cogs);
    assert.equal(cash.category, "ASSET");
    assert.equal(cash.normalBalance, "DEBIT");
    assert.equal(ap.category, "LIABILITY");
    assert.equal(ap.normalBalance, "CREDIT");
    assert.equal(rev.category, "REVENUE");
    assert.equal(rev.normalBalance, "CREDIT");
    assert.equal(ret.category, "CONTRA_REVENUE");
    assert.equal(ret.normalBalance, "DEBIT");
    assert.equal(cogs.category, "EXPENSE");
    assert.equal(cogs.normalBalance, "DEBIT");
  });

  test("1.2 should maintain Shared Treasury for Cash 1010 and Bank 1020 without dealership partition", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);

    const cash = accounts.find((a) => a.code === "1010");
    const bank = accounts.find((a) => a.code === "1020");
    const ar = accounts.find((a) => a.code === "1100");

    // Cash and Bank must have dealershipId: undefined (Shared Treasury)
    assert.equal(cash.dealershipId, undefined);
    assert.equal(bank.dealershipId, undefined);

    // Operational accounts must be scoped to dealership
    assert.equal(String(ar.dealershipId), String(dId1));
  });

  // ========================================================
  // 2. Double-Entry General Ledger Balancing Invariant
  // ========================================================
  test("2.1 should reject unbalanced journal entries (Debits != Credits)", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);

    await assert.rejects(
      async () => {
        await AccountingService.postJournalEntry({
          businessId: bId,
          dealershipId: dId1,
          sourceType: "manual_adjustment",
          narration: "Unbalanced Entry Test",
          lines: [
            { accountCode: "1010", debit: 5000, credit: 0 },
            { accountCode: "2010", debit: 0, credit: 4000 }, // 1000 mismatch!
          ],
        });
      },
      /Unbalanced journal entry/
    );

    assert.equal(journalEntries.length, 0);
  });

  test("2.2 should post balanced journal entry and correctly update normal balances", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);

    const cashBefore = accounts.find((a) => a.code === "1010").balance;
    const revBefore = accounts.find((a) => a.code === "4010").balance;

    const entry = await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId1,
      sourceType: "manual_adjustment",
      narration: "Direct Cash Sale",
      lines: [
        { accountCode: "1010", debit: 12500, credit: 0 },
        { accountCode: "4010", debit: 0, credit: 12500 },
      ],
    });

    assert.ok(entry);
    assert.equal(entry.status, "POSTED");
    assert.equal(entry.debitsTotal, 12500);
    assert.equal(entry.creditsTotal, 12500);

    const cashAfter = accounts.find((a) => a.code === "1010").balance;
    const revAfter = accounts.find((a) => a.code === "4010").balance;

    // Asset (Debit normal) increases by 12500
    assert.equal(cashAfter, cashBefore + 12500);
    // Revenue (Credit normal) increases by 12500
    assert.equal(revAfter, revBefore + 12500);
  });

  // ========================================================
  // 3. Immutability & Reversal Entries (Hardened)
  // ========================================================
  test("3.1 should reverse a posted journal entry with inverse lines, preserve original isPosted: true with status REVERSED, and restore balances", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);

    const original = await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId1,
      sourceType: "manual_adjustment",
      narration: "Initial Entry",
      lines: [
        { accountCode: "1010", debit: 5000, credit: 0 },
        { accountCode: "2010", debit: 0, credit: 5000 },
      ],
    });

    assert.equal(accounts.find((a) => a.code === "1010").balance, 5000);
    assert.equal(accounts.find((a) => a.code === "2010").balance, 5000);

    const reversal = await AccountingService.reverseJournalEntry({
      journalId: original._id,
      reason: "Post error correction",
      postedBy: actId,
    });

    assert.ok(reversal);
    assert.equal(reversal.status, "POSTED");
    assert.equal(reversal.isPosted, true);
    assert.equal(String(reversal.reversalOfJournalId), String(original._id));

    // CRITICAL REQUIREMENT: Original journal must remain historically immutable!
    // isPosted MUST remain true, and status is REVERSED
    assert.equal(original.status, "REVERSED");
    assert.equal(original.isPosted, true);
    assert.equal(String(original.reversedByJournalId), String(reversal._id));

    // Lines of original entry must remain unchanged
    assert.equal(original.lines[0].debit, 5000);
    assert.equal(original.lines[0].credit, 0);
    assert.equal(original.lines[1].debit, 0);
    assert.equal(original.lines[1].credit, 5000);

    // Reversal entry must have exact inverse lines
    assert.equal(reversal.lines[0].debit, 0);
    assert.equal(reversal.lines[0].credit, 5000);
    assert.equal(reversal.lines[1].debit, 5000);
    assert.equal(reversal.lines[1].credit, 0);

    // Account balances must be restored to 0
    assert.equal(accounts.find((a) => a.code === "1010").balance, 0);
    assert.equal(accounts.find((a) => a.code === "2010").balance, 0);
  });

  test("3.2 should reject reversing an already reversed journal entry (prevent duplicate reversal)", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);

    const original = await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId1,
      sourceType: "manual_adjustment",
      narration: "Entry to reverse twice",
      lines: [
        { accountCode: "1010", debit: 1000, credit: 0 },
        { accountCode: "2010", debit: 0, credit: 1000 },
      ],
    });

    await AccountingService.reverseJournalEntry({ journalId: original._id });

    // Subsequent reversal attempt on the same journal entry must be rejected or returned idempotently
    await assert.rejects(
      async () => {
        // Clear reversedByJournalId temporarily to test re-reversal rejection check
        original.status = "REVERSED";
        await AccountingService.reverseJournalEntry({ journalId: original._id });
      },
      /Journal entry is already reversed/
    );
  });

  test("3.3 should preserve both original and reversal entries in General Ledger, netting to zero running balance", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);

    const original = await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId1,
      postingDate: new Date("2026-11-10"),
      sourceType: "manual_adjustment",
      narration: "Equipment purchase recorded in error",
      lines: [
        { accountCode: "1010", debit: 10000, credit: 0 },
        { accountCode: "2010", debit: 0, credit: 10000 },
      ],
    });

    await AccountingService.reverseJournalEntry({
      journalId: original._id,
      reason: "Void erroneous posting",
      postedBy: actId,
    });

    const glCash = await AccountingService.getGeneralLedger({
      accountCode: "1010",
      businessId: bId,
      dealershipId: dId1,
    });

    assert.ok(glCash);
    // Both original and reversal entries MUST appear in General Ledger
    assert.equal(glCash.lines.length, 2);
    assert.equal(glCash.lines[0].debit, 10000);
    assert.equal(glCash.lines[0].runningBalance, 10000);
    assert.equal(glCash.lines[1].credit, 10000);
    assert.equal(glCash.lines[1].runningBalance, 0); // Net effect is zero
    assert.equal(glCash.closingBalance, 0);
  });

  test("3.4 should fail closed in production (NODE_ENV=production) when transaction guarantees cannot be maintained", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "production";

      // With connection readyState === 0 in mock environment, executeInTransaction must throw in production
      await assert.rejects(
        async () => {
          await AccountingService.executeInTransaction(async () => {
            return "should_never_reach";
          });
        },
        /Financial transaction failed/
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  test("3.5 should update account balances atomically via findByIdAndUpdate ($inc)", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);

    const cashAcc = accounts.find((a) => a.code === "1010");
    const initialBalance = cashAcc.balance;

    await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId1,
      sourceType: "manual_adjustment",
      narration: "Atomic balance verification",
      lines: [
        { accountCode: "1010", debit: 3500, credit: 0 },
        { accountCode: "2010", debit: 0, credit: 3500 },
      ],
    });

    assert.equal(cashAcc.balance, initialBalance + 3500);
  });

  // ========================================================
  // 4. Financial Period Controls
  // ========================================================
  test("4.1 should reject posting journal entry inside a CLOSED financial period", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);

    // Create a closed period spanning October 2026
    const period = await AccountingService.createPeriod({
      businessId: bId,
      periodName: "October 2026",
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-10-31"),
    });

    await AccountingService.closePeriod(period._id, actId, "Month-end close completed");

    // Attempt posting in closed period
    await assert.rejects(
      async () => {
        await AccountingService.postJournalEntry({
          businessId: bId,
          dealershipId: dId1,
          postingDate: new Date("2026-10-15"),
          sourceType: "manual_adjustment",
          narration: "Late October adjustment",
          lines: [
            { accountCode: "1010", debit: 2000, credit: 0 },
            { accountCode: "2010", debit: 0, credit: 2000 },
          ],
        });
      },
      /Cannot post journal entry: Accounting period 'October 2026' is CLOSED/
    );
  });

  test("4.2 should permit posting after reopening a previously closed period", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);

    const period = await AccountingService.createPeriod({
      businessId: bId,
      periodName: "September 2026",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-30"),
    });

    await AccountingService.closePeriod(period._id, actId);
    await AccountingService.reopenPeriod(period._id);

    const entry = await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId1,
      postingDate: new Date("2026-09-15"),
      sourceType: "manual_adjustment",
      narration: "Adjustment after reopening",
      lines: [
        { accountCode: "1010", debit: 3000, credit: 0 },
        { accountCode: "2010", debit: 0, credit: 3000 },
      ],
    });

    assert.ok(entry);
    assert.equal(entry.status, "POSTED");
  });

  // ========================================================
  // 5. Idempotent Journal Postings
  // ========================================================
  test("5.1 should return existing journal entry without duplicate balance postings on replay", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);

    const idempotencyKey = "unique_op_event_12345";

    const first = await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId1,
      sourceType: "manual_adjustment",
      narration: "First Attempt",
      idempotencyKey,
      lines: [
        { accountCode: "1010", debit: 5000, credit: 0 },
        { accountCode: "4010", debit: 0, credit: 5000 },
      ],
    });

    assert.equal(accounts.find((a) => a.code === "1010").balance, 5000);

    // Second call with same idempotencyKey
    const second = await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId1,
      sourceType: "manual_adjustment",
      narration: "Duplicate Attempt",
      idempotencyKey,
      lines: [
        { accountCode: "1010", debit: 5000, credit: 0 },
        { accountCode: "4010", debit: 0, credit: 5000 },
      ],
    });

    assert.equal(String(second._id), String(first._id));
    assert.equal(journalEntries.length, 1);
    // Balance must NOT have doubled to 10,000
    assert.equal(accounts.find((a) => a.code === "1010").balance, 5000);
  });

  // ========================================================
  // 6. Operational Event Accounting Integrations
  // ========================================================
  test("6.1 Purchase GRN: Dr Inventory Asset (1200), Cr Accounts Payable (2010)", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);

    const grnId = new mongoose.Types.ObjectId();
    const grnNumber = "GRN-202611-0001";
    const landedCostTotal = 45000;

    const entry = await AccountingService.recordGrnConfirmation({
      businessId: bId,
      dealershipId: dId1,
      grnId,
      grnNumber,
      landedCostTotal,
      supplierName: "Beximco Pharma",
      postedBy: actId,
    });

    assert.ok(entry);
    assert.equal(entry.sourceType, "purchase_grn");
    assert.equal(entry.debitsTotal, 45000);
    assert.equal(entry.creditsTotal, 45000);

    // Dr 1200 Inventory Asset
    const inv = accounts.find((a) => a.code === "1200");
    assert.equal(inv.balance, 45000);

    // Cr 2010 Accounts Payable
    const ap = accounts.find((a) => a.code === "2010");
    assert.equal(ap.balance, 45000);
  });

  test("6.2 Supplier Payment: Dr Accounts Payable (2010), Cr Bank (1020)", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);

    // Setup initial AP balance
    const ap = accounts.find((a) => a.code === "2010");
    ap.balance = 45000;

    const paymentId = new mongoose.Types.ObjectId();
    const entry = await AccountingService.recordSupplierPayment({
      businessId: bId,
      dealershipId: dId1,
      paymentId,
      paymentNumber: "PMT-VEND-1001",
      amount: 25000,
      paymentMethod: "bank_transfer",
      vendorName: "Beximco Pharma",
      postedBy: actId,
    });

    assert.ok(entry);
    assert.equal(entry.sourceType, "supplier_payment");

    // AP reduces by 25,000 (45,000 - 25,000 = 20,000)
    assert.equal(ap.balance, 20000);

    // Bank (1020) reduces by 25,000
    const bank = accounts.find((a) => a.code === "1020");
    assert.equal(bank.balance, -25000);
  });

  test("6.3 Sales Fulfillment: Dr AR (1100), Cr Revenue (4010) AND Dr COGS (5010), Cr Inventory (1200)", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);

    // Initial inventory on hand
    const inv = accounts.find((a) => a.code === "1200");
    inv.balance = 50000;

    const orderId = new mongoose.Types.ObjectId();
    const entry = await AccountingService.recordSalesFulfillment({
      businessId: bId,
      dealershipId: dId1,
      orderId,
      orderNumber: "ORD-202611-0089",
      invoicedAmount: 32000,
      batchCostTotal: 22000,
      customerName: "Popular Pharmacy",
      postedBy: actId,
    });

    assert.ok(entry);
    assert.equal(entry.sourceType, "sales_fulfillment");
    assert.equal(entry.debitsTotal, 54000); // 32000 (AR) + 22000 (COGS)
    assert.equal(entry.creditsTotal, 54000); // 32000 (Rev) + 22000 (Inv)

    const ar = accounts.find((a) => a.code === "1100");
    const rev = accounts.find((a) => a.code === "4010");
    const cogs = accounts.find((a) => a.code === "5010");

    assert.equal(ar.balance, 32000);
    assert.equal(rev.balance, 32000);
    assert.equal(cogs.balance, 22000);
    assert.equal(inv.balance, 28000); // 50,000 - 22,000 = 28,000
  });

  test("6.4 Customer Payment: Dr Cash/Bank, Cr Accounts Receivable (1100)", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);

    const ar = accounts.find((a) => a.code === "1100");
    ar.balance = 32000;

    const paymentId = new mongoose.Types.ObjectId();
    const entry = await AccountingService.recordCustomerPayment({
      businessId: bId,
      dealershipId: dId1,
      paymentId,
      receiptNumber: "RCT-CUST-8001",
      amount: 32000,
      paymentMethod: "bank_transfer",
      customerName: "Popular Pharmacy",
      postedBy: actId,
    });

    assert.ok(entry);
    assert.equal(entry.sourceType, "customer_payment");

    // AR cleared to 0
    assert.equal(ar.balance, 0);

    // Bank increased by 32,000
    const bank = accounts.find((a) => a.code === "1020");
    assert.equal(bank.balance, 32000);
  });

  test("6.5 Customer Return: Credit Note (Dr 4110, Cr 1100) vs Cash Refund (Dr 4110, Cr 1010) without double-crediting", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);

    const retId = new mongoose.Types.ObjectId();

    // 1. Credit Note Return
    const cnEntry = await AccountingService.recordCustomerReturn({
      businessId: bId,
      dealershipId: dId1,
      returnId: retId,
      returnNumber: "RET-202611-0001",
      refundAmount: 5000,
      refundMethod: "credit_note",
    });

    assert.equal(cnEntry.lines[0].accountCode, "4110");
    assert.equal(cnEntry.lines[0].debit, 5000);
    assert.equal(cnEntry.lines[1].accountCode, "1100"); // Credits AR
    assert.equal(cnEntry.lines[1].credit, 5000);

    const retAcc = accounts.find((a) => a.code === "4110");
    const arAcc = accounts.find((a) => a.code === "1100");
    assert.equal(retAcc.balance, 5000);
    assert.equal(arAcc.balance, -5000); // reduced AR

    // 2. Cash Refund Return
    const cashRetId = new mongoose.Types.ObjectId();
    const cashEntry = await AccountingService.recordCustomerReturn({
      businessId: bId,
      dealershipId: dId1,
      returnId: cashRetId,
      returnNumber: "RET-202611-0002",
      refundAmount: 3000,
      refundMethod: "cash",
    });

    assert.equal(cashEntry.lines[0].accountCode, "4110");
    assert.equal(cashEntry.lines[0].debit, 3000);
    assert.equal(cashEntry.lines[1].accountCode, "1010"); // Credits Cash in Hand, NOT AR!
    assert.equal(cashEntry.lines[1].credit, 3000);

    const cashAcc = accounts.find((a) => a.code === "1010");
    assert.equal(cashAcc.balance, -3000);
    // AR balance must NOT be reduced again for cash refund
    assert.equal(arAcc.balance, -5000);
  });

  test("6.6 Supplier Purchase Return: Dr Accounts Payable (2010), Cr Inventory Asset (1200)", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);

    const ap = accounts.find((a) => a.code === "2010");
    ap.balance = 30000;
    const inv = accounts.find((a) => a.code === "1200");
    inv.balance = 30000;

    const prId = new mongoose.Types.ObjectId();
    const entry = await AccountingService.recordPurchaseReturn({
      businessId: bId,
      dealershipId: dId1,
      returnId: prId,
      returnNumber: "PR-202611-0005",
      debitAmount: 12000,
      vendorName: "Square Pharma",
      postedBy: actId,
    });

    assert.ok(entry);
    assert.equal(entry.sourceType, "purchase_return");

    // Dr 2010 AP reduces payable liability
    assert.equal(ap.balance, 18000);
    // Cr 1200 Inventory reduces inventory asset
    assert.equal(inv.balance, 18000);
  });

  test("6.7 Operating Expense: Dr Expense (5020-5090), Cr Cash/Bank", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);

    const exp = accounts.find((a) => a.code === "5020"); // Freight
    const cash = accounts.find((a) => a.code === "1010");

    const entry = await AccountingService.recordExpense({
      businessId: bId,
      dealershipId: dId1,
      expenseId: new mongoose.Types.ObjectId(),
      expenseNumber: "EXP-1002",
      expenseAccountCode: "5020",
      amount: 4500,
      paymentMethod: "cash",
      payee: "Dhaka Transport Agency",
      description: "Truck hiring for inter-warehouse transfer",
      postedBy: actId,
    });

    assert.ok(entry);
    assert.equal(entry.sourceType, "expense");
    assert.equal(exp.balance, 4500);
    assert.equal(cash.balance, -4500);
  });

  // ========================================================
  // 7. Financial Reports: Trial Balance, P&L, Balance Sheet, Ledger
  // ========================================================
  test("7.1 Trial Balance: Sum of Debits must equal Sum of Credits", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);

    // Perform balanced business transactions
    await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId1,
      sourceType: "manual_adjustment",
      narration: "Owner Capital Contribution",
      lines: [
        { accountCode: "1020", debit: 100000, credit: 0 },
        { accountCode: "3010", debit: 0, credit: 100000 },
      ],
    });

    await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId1,
      sourceType: "manual_adjustment",
      narration: "Inventory Purchase",
      lines: [
        { accountCode: "1200", debit: 40000, credit: 0 },
        { accountCode: "1020", debit: 0, credit: 40000 },
      ],
    });

    const tb = await AccountingService.getTrialBalance({ businessId: bId, dealershipId: dId1 });

    assert.ok(tb);
    assert.equal(tb.isBalanced, true);
    assert.equal(tb.totalDebits, tb.totalCredits);
    assert.equal(tb.totalDebits, 100000);
  });

  test("7.2 Profit & Loss Statement: Revenue - Returns - COGS - Expenses = Net Profit", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);

    // Sales Revenue: 50,000
    // Returns: 5,000 -> Net Revenue = 45,000
    // COGS: 25,000 -> Gross Profit = 20,000
    // Expenses (Salary): 8,000 -> Net Profit = 12,000

    await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId1,
      sourceType: "sales_fulfillment",
      narration: "Sale Fulfillment",
      lines: [
        { accountCode: "1100", debit: 50000, credit: 0 },
        { accountCode: "4010", debit: 0, credit: 50000 },
        { accountCode: "5010", debit: 25000, credit: 0 },
        { accountCode: "1200", debit: 0, credit: 25000 },
      ],
    });

    await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId1,
      sourceType: "customer_return",
      narration: "Customer Return",
      lines: [
        { accountCode: "4110", debit: 5000, credit: 0 },
        { accountCode: "1100", debit: 0, credit: 5000 },
      ],
    });

    await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId1,
      sourceType: "expense",
      narration: "Staff Salary",
      lines: [
        { accountCode: "5050", debit: 8000, credit: 0 },
        { accountCode: "1010", debit: 0, credit: 8000 },
      ],
    });

    const pnl = await AccountingService.getProfitAndLoss({ businessId: bId, dealershipId: dId1 });

    assert.equal(pnl.revenue.grossRevenue, 50000);
    assert.equal(pnl.revenue.returnsAndAllowances, 5000);
    assert.equal(pnl.revenue.netRevenue, 45000);
    assert.equal(pnl.cogs.cogsTotal, 25000);
    assert.equal(pnl.grossProfit, 20000);
    assert.equal(pnl.expenses.totalExpenses, 8000);
    assert.equal(pnl.netProfit, 12000);
  });

  test("7.3 Balance Sheet: Assets must equal Liabilities + Equity + Retained Earnings", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);

    // Initial Capital: 100,000 in Bank (3010 / 1020)
    await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId1,
      sourceType: "manual_adjustment",
      narration: "Owner Capital",
      lines: [
        { accountCode: "1020", debit: 100000, credit: 0 },
        { accountCode: "3010", debit: 0, credit: 100000 },
      ],
    });

    // Sale: AR 30,000, Rev 30,000 (Net Profit = 30,000)
    await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId1,
      sourceType: "sales_fulfillment",
      narration: "Sales Revenue",
      lines: [
        { accountCode: "1100", debit: 30000, credit: 0 },
        { accountCode: "4010", debit: 0, credit: 30000 },
      ],
    });

    const bs = await AccountingService.getBalanceSheet({ businessId: bId, dealershipId: dId1 });

    assert.ok(bs);
    assert.equal(bs.isBalanced, true);
    assert.equal(bs.assets.totalAssets, 130000); // 100k Bank + 30k AR
    assert.equal(bs.liabilities.totalLiabilities, 0);
    assert.equal(bs.equity.retainedEarnings, 30000);
    assert.equal(bs.totalLiabilitiesAndEquity, 130000);
  });

  test("7.4 General Ledger Running Balance: accurately accumulates debit and credit lines", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);

    // Post 3 transactions affecting Cash 1010
    await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId1,
      postingDate: new Date("2026-11-01"),
      sourceType: "manual_adjustment",
      narration: "Cash deposit",
      lines: [
        { accountCode: "1010", debit: 10000, credit: 0 },
        { accountCode: "3010", debit: 0, credit: 10000 },
      ],
    });

    await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId1,
      postingDate: new Date("2026-11-02"),
      sourceType: "manual_adjustment",
      narration: "Office supplies payment",
      lines: [
        { accountCode: "5090", debit: 2000, credit: 0 },
        { accountCode: "1010", debit: 0, credit: 2000 },
      ],
    });

    await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId1,
      postingDate: new Date("2026-11-03"),
      sourceType: "manual_adjustment",
      narration: "Petty cash collection",
      lines: [
        { accountCode: "1010", debit: 5000, credit: 0 },
        { accountCode: "4010", debit: 0, credit: 5000 },
      ],
    });

    const gl = await AccountingService.getGeneralLedger({
      accountCode: "1010",
      businessId: bId,
      dealershipId: dId1,
    });

    assert.ok(gl);
    assert.equal(gl.lines.length, 3);
    assert.equal(gl.lines[0].runningBalance, 10000);
    assert.equal(gl.lines[1].runningBalance, 8000);
    assert.equal(gl.lines[2].runningBalance, 13000);
    assert.equal(gl.closingBalance, 13000);
  });
});
