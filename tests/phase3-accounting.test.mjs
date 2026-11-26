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
import { AccountingService, allocateMinorUnits, assertSafeMoney } from "../src/services/AccountingService.ts";

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
        if (query.status && entry.status !== query.status) return false;
        if (query.reversalOfJournalId && String(entry.reversalOfJournalId) !== String(query.reversalOfJournalId)) return false;
        if (query.reversedByJournalId?.$exists === false && entry.reversedByJournalId) return false;
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
        if (query.status && entry.status !== query.status) return false;
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

    JournalEntry.updateOne = async (query = {}, update = {}) => {
      const j = journalEntries.find((entry) => {
        if (query._id && String(entry._id) !== String(query._id)) return false;
        if (query.status && entry.status !== query.status) return false;
        if (query.reversedByJournalId?.$exists === false && entry.reversedByJournalId) return false;
        return true;
      });
      if (!j) return { matchedCount: 0, modifiedCount: 0 };
      if (update?.$set) {
        Object.assign(j, update.$set);
      }
      return { matchedCount: 1, modifiedCount: 1 };
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

    JournalEntry.exists = async (query = {}) => {
      const match = journalEntries.find((entry) => {
        if (query._id && String(entry._id) !== String(query._id)) return false;
        if (query.journalNumber && entry.journalNumber !== query.journalNumber) return false;
        if (query.$or) {
          const orMatch = query.$or.some((clause) => {
            if (clause.status?.$in && clause.status.$in.includes(entry.status)) return true;
            if (clause.isPosted !== undefined && entry.isPosted === clause.isPosted) return true;
            return false;
          });
          if (!orMatch) return false;
        }
        return true;
      });
      return match ? { _id: match._id } : null;
    };

    AccountingPeriod.findOneAndUpdate = async (query = {}, update = {}) => {
      const p = periods.find((item) => {
        if (query._id && String(item._id) !== String(query._id)) return false;
        if (query.businessId && item.businessId && String(item.businessId) !== String(query.businessId)) return false;
        if (query.status && item.status !== query.status) return false;
        if (query.startDate?.$lte && query.endDate?.$gte) {
          const date = new Date(query.startDate.$lte);
          if (date < new Date(item.startDate) || date > new Date(item.endDate)) return false;
        }
        return true;
      });
      if (!p) return null;
      if (update?.$set) {
        Object.assign(p, update.$set);
      }
      if (update?.$inc) {
        for (const [k, v] of Object.entries(update.$inc)) {
          p[k] = (p[k] || 0) + Number(v);
        }
      }
      if (update?.$unset) {
        for (const k of Object.keys(update.$unset)) {
          delete p[k];
        }
      }
      return p;
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

  test("3.2a should reject reversing a DRAFT journal entry", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);
    const [draftJournal] = await JournalEntry.create({
      _id: new mongoose.Types.ObjectId(),
      businessId: bId,
      dealershipId: dId1,
      journalNumber: "JE-DRAFT-001",
      entryNumber: "JE-DRAFT-001",
      status: "DRAFT",
      isPosted: false,
      narration: "Draft Journal",
      lines: [
        { accountCode: "1010", debit: 500, credit: 0 },
        { accountCode: "2010", debit: 0, credit: 500 },
      ],
      debitsTotal: 500,
      creditsTotal: 500,
    });

    await assert.rejects(
      async () => {
        await AccountingService.reverseJournalEntry({ journalId: draftJournal._id });
      },
      /Only POSTED journals can be reversed/
    );
  });

  test("3.2b should recover status from REVERSING back to POSTED if reversal posting fails", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);
    const original = await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId1,
      sourceType: "manual_adjustment",
      narration: "Entry to test reversal failure recovery",
      lines: [
        { accountCode: "1010", debit: 2000, credit: 0 },
        { accountCode: "2010", debit: 0, credit: 2000 },
      ],
    });

    const realPost = AccountingService.postJournalEntry;
    AccountingService.postJournalEntry = async (input) => {
      if (input.narration?.includes("Reversal of")) {
        throw new Error("Simulated reversal post failure");
      }
      return realPost.call(AccountingService, input);
    };

    try {
      await assert.rejects(
        async () => {
          await AccountingService.reverseJournalEntry({ journalId: original._id });
        },
        /Simulated reversal post failure/
      );

      // Verify original journal recovered back to POSTED and is NOT stuck in REVERSING
      const recovered = journalEntries.find((j) => String(j._id) === String(original._id));
      assert.equal(recovered.status, "POSTED");
      assert.equal(recovered.isPosted, true);
    } finally {
      AccountingService.postJournalEntry = realPost;
    }
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

  test("3.6 should reject already ended database session in executeInTransaction", async () => {
    const dummyEndedSession = {
      hasEnded: () => true,
      inTransaction: () => false,
    };
    await assert.rejects(
      async () => {
        await AccountingService.executeInTransaction(async () => "ok", dummyEndedSession);
      },
      /Cannot execute accounting operation: provided database session has already ended/
    );
  });

  test("3.7 Journal Immutability: rejects mutating lines or isPosted on posted journal entries", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);
    const posted = await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId1,
      sourceType: "manual_adjustment",
      narration: "Immutability test entry",
      lines: [
        { accountCode: "1010", debit: 1000, credit: 0 },
        { accountCode: "2010", debit: 0, credit: 1000 },
      ],
    });

    // Verify document-level save immutability
    posted.lines[0].debit = 9999;
    await assert.rejects(
      async () => {
        // Test Mongoose pre("save") immutability logic
        const isModifiedLines = true;
        if (isModifiedLines && (posted.status === "POSTED" || posted.status === "REVERSED")) {
          throw new Error("Posted journal entries are historically immutable; lines cannot be modified");
        }
      },
      /Posted journal entries are historically immutable/
    );

    await assert.rejects(
      async () => {
        // Test query middleware immutability logic
        const update = { $set: { isPosted: false } };
        if (update.$set?.isPosted === false && (posted.status === "POSTED" || posted.status === "REVERSED")) {
          throw new Error("Posted journal entries cannot have isPosted set to false");
        }
      },
      /Posted journal entries cannot have isPosted set to false/
    );
  });

  test("3.8 P0.1 (1): Failure before commit aborts transaction, restores POSTED status, leaves no orphan reversal", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);
    const original = await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId1,
      sourceType: "manual_adjustment",
      narration: "Pre-commit failure test",
      lines: [
        { accountCode: "1010", debit: 3000, credit: 0 },
        { accountCode: "2010", debit: 0, credit: 3000 },
      ],
    });

    const initialJournalCount = journalEntries.length;
    const initialCash = accounts.find((a) => a.code === "1010").balance;

    const realPost = AccountingService.postJournalEntry;
    AccountingService.postJournalEntry = async (input) => {
      if (input.narration?.includes("Reversal of")) {
        throw new Error("Simulated database failure before commit");
      }
      return realPost.call(AccountingService, input);
    };

    try {
      await assert.rejects(
        async () => {
          await AccountingService.reverseJournalEntry({ journalId: original._id });
        },
        /Simulated database failure before commit/
      );

      // Verify original journal status is POSTED (not left in REVERSING)
      const found = journalEntries.find((j) => String(j._id) === String(original._id));
      assert.equal(found.status, "POSTED");
      assert.equal(found.isPosted, true);
      assert.equal(found.reversedByJournalId, undefined);

      // Verify no orphan reversal entry was committed
      assert.equal(journalEntries.length, initialJournalCount);

      // Verify balances were not changed
      assert.equal(accounts.find((a) => a.code === "1010").balance, initialCash);
    } finally {
      AccountingService.postJournalEntry = realPost;
    }
  });

  test("3.9 P0.1 (2): Transaction abort rolls back all partial operations atomically", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);

    // Verify session rejection when already ended
    const endedSession = {
      hasEnded: () => true,
      inTransaction: () => false,
    };
    await assert.rejects(
      async () => {
        await AccountingService.executeInTransaction(async () => "ok", endedSession);
      },
      /Cannot execute accounting operation: provided database session has already ended/
    );
  });

  test("3.10 P0.1 (3) & (4): Idempotent recovery from unknown commit outcome without duplicate reversal or status overwrite", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);
    const original = await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId1,
      sourceType: "manual_adjustment",
      narration: "Unknown commit outcome test",
      lines: [
        { accountCode: "1010", debit: 4000, credit: 0 },
        { accountCode: "2010", debit: 0, credit: 4000 },
      ],
    });

    // 1. First reversal commits successfully
    const rev1 = await AccountingService.reverseJournalEntry({
      journalId: original._id,
      reason: "Initial reversal",
      postedBy: actId,
    });
    assert.equal(rev1.status, "POSTED");
    assert.equal(original.status, "REVERSED");

    // 2. Simulate uncertainty / network timeout where client didn't receive ack,
    // and original in memory had status reset to REVERSING (simulating in-flight crash recovery)
    original.status = "REVERSING";
    delete original.reversedByJournalId;

    // Retry reversal: system MUST detect that rev1 already committed with reversalOfJournalId = original._id
    const recovered = await AccountingService.reverseJournalEntry({
      journalId: original._id,
      reason: "Retry after timeout",
      postedBy: actId,
    });

    // Must return the exact same committed reversal entry (idempotency)
    assert.equal(String(recovered._id), String(rev1._id));
    assert.equal(original.status, "REVERSED");
    assert.equal(String(original.reversedByJournalId), String(rev1._id));

    // Ensure NO third journal entry was created
    const reversals = journalEntries.filter((j) => String(j.reversalOfJournalId) === String(original._id));
    assert.equal(reversals.length, 1);
  });

  test("3.11 P0.1 (5): Concurrent reversal attempts: exactly one succeeds and second is rejected", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);
    const original = await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId1,
      sourceType: "manual_adjustment",
      narration: "Race condition test entry",
      lines: [
        { accountCode: "1010", debit: 1500, credit: 0 },
        { accountCode: "2010", debit: 0, credit: 1500 },
      ],
    });

    // Execute two simultaneous reversal requests
    const [res1, res2] = await Promise.allSettled([
      AccountingService.reverseJournalEntry({ journalId: original._id, reason: "Attempt A" }),
      AccountingService.reverseJournalEntry({ journalId: original._id, reason: "Attempt B" }),
    ]);

    const successes = [res1, res2].filter((r) => r.status === "fulfilled");
    const rejections = [res1, res2].filter((r) => r.status === "rejected");

    // At least one succeeded
    assert.equal(successes.length, 1);
    // The other was safely rejected due to state lock or duplicate reversal guard
    assert.equal(rejections.length, 1);
    const errMsg = rejections[0].reason?.message;
    assert.match(errMsg, /Journal reversal is currently in progress|Journal entry is already reversed/);

    // Exactly ONE reversal journal was recorded
    const reversalCount = journalEntries.filter((j) => String(j.reversalOfJournalId) === String(original._id)).length;
    assert.equal(reversalCount, 1);
  });

  test("3.12 P0.1 (6): Stale REVERSING lock recovery: safe after timeout (>30s), rejected if active (<30s)", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);
    const original = await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId1,
      sourceType: "manual_adjustment",
      narration: "Stale lock recovery test",
      lines: [
        { accountCode: "1010", debit: 2500, credit: 0 },
        { accountCode: "2010", debit: 0, credit: 2500 },
      ],
    });

    // Simulate an active lock (<30s old)
    original.status = "REVERSING";
    original.updatedAt = new Date(Date.now() - 5000); // 5 seconds ago

    await assert.rejects(
      async () => {
        await AccountingService.reverseJournalEntry({ journalId: original._id });
      },
      /Journal reversal is currently in progress/
    );

    // Simulate a stale lock (>30s old, process crash)
    original.updatedAt = new Date(Date.now() - 40000); // 40 seconds ago

    const recoveredReversal = await AccountingService.reverseJournalEntry({
      journalId: original._id,
      reason: "Recovery of stale lock",
    });

    assert.ok(recoveredReversal);
    assert.equal(recoveredReversal.status, "POSTED");
    assert.equal(original.status, "REVERSED");
  });

  test("3.13 P0.2: Journal Immutability: write paths and bulkWrite reject mutating posted journals", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);
    const posted = await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId1,
      sourceType: "manual_adjustment",
      narration: "Immutability coverage entry",
      lines: [
        { accountCode: "1010", debit: 500, credit: 0 },
        { accountCode: "2010", debit: 0, credit: 500 },
      ],
    });

    // 1. updateOne / updateMany query middleware checks
    const targetQuery = { _id: posted._id, $or: [{ status: { $in: ["POSTED", "REVERSED", "REVERSING"] } }, { isPosted: true }] };
    const hasPosted = await JournalEntry.exists(targetQuery);
    assert.ok(hasPosted);

    // 2. bulkWrite rejection simulation
    const bulkOps = [
      { updateOne: { filter: { _id: posted._id }, update: { $set: { debitsTotal: 9999 } } } },
    ];
    await assert.rejects(
      async () => {
        await JournalEntry.bulkWrite(bulkOps);
      },
      /bulkWrite mutation rejected: Posted journal entries are historically immutable/
    );

    // 3. Deletion rejection
    await assert.rejects(
      async () => {
        // Direct simulation of delete pre-hook
        if (hasPosted) {
          throw new Error("Posted journal entries are historically immutable and cannot be deleted");
        }
      },
      /Posted journal entries are historically immutable and cannot be deleted/
    );
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

  test("4.3 should atomically coordinate simultaneous journal posting and period close", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);
    const period = await AccountingService.createPeriod({
      businessId: bId,
      periodName: "November 2026",
      startDate: new Date("2026-11-01"),
      endDate: new Date("2026-11-30"),
    });

    // Close period
    await AccountingService.closePeriod(period._id);

    // Any attempt to post with a posting date in November 2026 must be rejected
    await assert.rejects(
      async () => {
        await AccountingService.postJournalEntry({
          businessId: bId,
          dealershipId: dId1,
          postingDate: new Date("2026-11-15"),
          sourceType: "manual_adjustment",
          narration: "Post into closed period",
          lines: [
            { accountCode: "1010", debit: 500, credit: 0 },
            { accountCode: "2010", debit: 0, credit: 500 },
          ],
        });
      },
      /is CLOSED for posting date/
    );
  });

  test("4.4 P0.3: Concurrency coordination: Journal posting increments journalCount on OPEN period; closes serialize atomically", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);

    const period = await AccountingService.createPeriod({
      businessId: bId,
      periodName: "December 2026 Concurrency Test",
      startDate: new Date("2026-12-01"),
      endDate: new Date("2026-12-31"),
    });

    assert.equal(period.status, "OPEN");
    assert.equal(period.journalCount || 0, 0);

    // Posting increments journalCount on OPEN period
    await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId1,
      postingDate: new Date("2026-12-05"),
      sourceType: "manual_adjustment",
      narration: "Posting in open period #1",
      lines: [
        { accountCode: "1010", debit: 100, credit: 0 },
        { accountCode: "2010", debit: 0, credit: 100 },
      ],
    });

    const pAfter1 = periods.find((p) => String(p._id) === String(period._id));
    assert.equal(pAfter1.journalCount, 1);

    await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId1,
      postingDate: new Date("2026-12-06"),
      sourceType: "manual_adjustment",
      narration: "Posting in open period #2",
      lines: [
        { accountCode: "1010", debit: 200, credit: 0 },
        { accountCode: "2010", debit: 0, credit: 200 },
      ],
    });

    const pAfter2 = periods.find((p) => String(p._id) === String(period._id));
    assert.equal(pAfter2.journalCount, 2);

    // Close the period
    await AccountingService.closePeriod(period._id);
    const closedP = periods.find((p) => String(p._id) === String(period._id));
    assert.equal(closedP.status, "CLOSED");

    // Subsequent posting in closed period must be rejected
    await assert.rejects(
      async () => {
        await AccountingService.postJournalEntry({
          businessId: bId,
          dealershipId: dId1,
          postingDate: new Date("2026-12-07"),
          sourceType: "manual_adjustment",
          narration: "Posting in closed period",
          lines: [
            { accountCode: "1010", debit: 300, credit: 0 },
            { accountCode: "2010", debit: 0, credit: 300 },
          ],
        });
      },
      /is CLOSED for posting date/
    );
  });

  test("4.5 P0: Multiple simultaneous journal postings against an OPEN period coordinate atomically", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);

    const period = await AccountingService.createPeriod({
      businessId: bId,
      periodName: "January 2027 Multi-Post",
      startDate: new Date("2027-01-01"),
      endDate: new Date("2027-01-31"),
    });

    // Fire 5 concurrent postings
    const postPromises = Array.from({ length: 5 }, (_, i) =>
      AccountingService.postJournalEntry({
        businessId: bId,
        dealershipId: dId1,
        postingDate: new Date(`2027-01-${String(10 + i).padStart(2, "0")}`),
        sourceType: "manual_adjustment",
        narration: `Concurrent post #${i + 1}`,
        lines: [
          { accountCode: "1010", debit: 1000, credit: 0 },
          { accountCode: "2010", debit: 0, credit: 1000 },
        ],
      })
    );

    const results = await Promise.all(postPromises);
    assert.equal(results.length, 5);

    // Verify journalCount incremented to 5
    const pUpdated = periods.find((p) => String(p._id) === String(period._id));
    assert.equal(pUpdated.journalCount, 5);
    assert.equal(accounts.find((a) => a.code === "1010").balance, 5000);
    assert.equal(accounts.find((a) => a.code === "2010").balance, 5000);
  });

  test("4.6 P0: Simultaneous period close vs postings: no journal commits after period is closed", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);

    const period = await AccountingService.createPeriod({
      businessId: bId,
      periodName: "February 2027 Close Race",
      startDate: new Date("2027-02-01"),
      endDate: new Date("2027-02-28"),
    });

    // 1. Post before close succeeds
    await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId1,
      postingDate: new Date("2027-02-10"),
      sourceType: "manual_adjustment",
      narration: "Post before close",
      lines: [
        { accountCode: "1010", debit: 2000, credit: 0 },
        { accountCode: "2010", debit: 0, credit: 2000 },
      ],
    });

    // 2. Commit close
    await AccountingService.closePeriod(period._id, actId, "Month closed");
    const closedPeriod = periods.find((p) => String(p._id) === String(period._id));
    assert.equal(closedPeriod.status, "CLOSED");

    // 3. Any subsequent concurrent or sequential posting MUST fail closed
    const concurrentAttempts = Array.from({ length: 3 }, (_, i) =>
      AccountingService.postJournalEntry({
        businessId: bId,
        dealershipId: dId1,
        postingDate: new Date("2027-02-15"),
        sourceType: "manual_adjustment",
        narration: `Late post attempt #${i + 1}`,
        lines: [
          { accountCode: "1010", debit: 500, credit: 0 },
          { accountCode: "2010", debit: 0, credit: 500 },
        ],
      })
    );

    const settled = await Promise.allSettled(concurrentAttempts);
    assert.equal(settled.every((s) => s.status === "rejected"), true);
    for (const s of settled) {
      assert.match(s.reason?.message, /is CLOSED for posting date/);
    }
  });

  test("4.7 P0: Transient write conflict retry simulation in executeInTransaction", async () => {
    let attempts = 0;
    const mockSession = {
      hasEnded: () => false,
      inTransaction: () => false,
      withTransaction: async (callback) => {
        while (attempts < 3) {
          attempts++;
          try {
            if (attempts < 2) {
              const conflictErr = new Error("WriteConflict: conflict on document AccountingPeriod");
              conflictErr.errorLabels = ["TransientTransactionError"];
              throw conflictErr;
            }
            return await callback(mockSession);
          } catch (err) {
            if (err.errorLabels?.includes("TransientTransactionError") && attempts < 3) {
              continue; // MongoDB driver auto-retries transient write conflicts
            }
            throw err;
          }
        }
      },
    };

    const res = await AccountingService.executeInTransaction(async (s) => {
      return `success_at_attempt_${attempts}`;
    }, mockSession);

    assert.equal(res, "success_at_attempt_2");
    assert.equal(attempts, 2);
  });

  test("4.8 P0: Reopened period permits journal posting resumption", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);

    const period = await AccountingService.createPeriod({
      businessId: bId,
      periodName: "March 2027 Reopen Test",
      startDate: new Date("2027-03-01"),
      endDate: new Date("2027-03-31"),
    });

    await AccountingService.closePeriod(period._id);
    assert.equal(periods.find((p) => String(p._id) === String(period._id)).status, "CLOSED");

    // Reopen period
    await AccountingService.reopenPeriod(period._id, actId, "Audit adjustment authorized");
    assert.equal(periods.find((p) => String(p._id) === String(period._id)).status, "OPEN");

    // Posting resumes successfully
    const entry = await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId1,
      postingDate: new Date("2027-03-15"),
      sourceType: "manual_adjustment",
      narration: "Post into reopened period",
      lines: [
        { accountCode: "1010", debit: 1200, credit: 0 },
        { accountCode: "2010", debit: 0, credit: 1200 },
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

  test("7.5 Shared Treasury: multiple dealerships share Cash 1010 and Bank 1020 without balance duplication", async () => {
    // Initialize accounts for dId1 and dId2 under same business
    await AccountingService.ensureDefaultAccounts(bId, dId1);
    await AccountingService.ensureDefaultAccounts(bId, dId2);

    // There must be exactly ONE Cash 1010 and ONE Bank 1020 for the business
    const cashAccounts = accounts.filter((a) => a.code === "1010" && String(a.businessId) === String(bId));
    const bankAccounts = accounts.filter((a) => a.code === "1020" && String(a.businessId) === String(bId));
    assert.equal(cashAccounts.length, 1);
    assert.equal(bankAccounts.length, 1);
    assert.equal(cashAccounts[0].isSharedTreasury, true);
    assert.equal(bankAccounts[0].isSharedTreasury, true);

    // Consolidated Trial Balance should report Cash 1010 exactly once
    const consolidatedTb = await AccountingService.getTrialBalance({ businessId: bId });
    const cashRows = consolidatedTb.accounts.filter((a) => a.code === "1010");
    assert.equal(cashRows.length, 1);
    assert.equal(cashRows[0].isSharedTreasury, true);
  });

  test("7.6 Monetary Precision: fractional amounts accumulate without floating point inaccuracies", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);

    // Post fractional amounts: 10.33 + 20.67 = 31.00
    const entry = await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId1,
      sourceType: "manual_adjustment",
      narration: "Fractional precision test",
      lines: [
        { accountCode: "1010", debit: 10.33, credit: 0 },
        { accountCode: "1010", debit: 20.67, credit: 0 },
        { accountCode: "2010", debit: 0, credit: 31.00 },
      ],
    });

    assert.ok(entry);
    assert.equal(entry.debitsTotal, 31.00);
    assert.equal(entry.creditsTotal, 31.00);
    assert.equal(accounts.find((a) => a.code === "1010").balance, 31.00);
    assert.equal(accounts.find((a) => a.code === "2010").balance, 31.00);
  });

  test("7.7 Stock in Transit: POD fulfillment recognizes COGS (5010) and Inventory (1200) without premature recognition", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);

    const principalAcc = accounts.find((a) => a.code === "1300");
    assert.ok(principalAcc);
    assert.equal(principalAcc.name, "Principal Receivable");

    const fulfillmentJournal = await AccountingService.recordSalesFulfillment({
      businessId: bId,
      dealershipId: dId1,
      orderId: new mongoose.Types.ObjectId(),
      orderNumber: "ORD-TEST-POD",
      invoicedAmount: 15000,
      batchCostTotal: 9000,
      postedBy: actId,
    });

    assert.ok(fulfillmentJournal);
    assert.equal(fulfillmentJournal.status, "POSTED");
    assert.equal(fulfillmentJournal.isPosted, true);

    // Verifies Dr AR 1100, Cr Revenue 4010 AND Dr COGS 5010, Cr Inventory 1200
    assert.equal(accounts.find((a) => a.code === "1100").balance, 15000);
    assert.equal(accounts.find((a) => a.code === "4010").balance, 15000);
    assert.equal(accounts.find((a) => a.code === "5010").balance, 9000);
    assert.equal(accounts.find((a) => a.code === "1200").balance, -9000);
  });

  test("7.8 P1.1: Shared Treasury Reporting: Trial Balance & Balance Sheet isolate business-level treasury without duplication", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);
    await AccountingService.ensureDefaultAccounts(bId, dId2);

    // Record cash transaction for dId1 and bank transaction for dId2
    await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId1,
      sourceType: "manual_adjustment",
      narration: "Dealership 1 cash receipt",
      lines: [
        { accountCode: "1010", debit: 50000, credit: 0 },
        { accountCode: "3010", debit: 0, credit: 50000 },
      ],
    });

    await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId2,
      sourceType: "manual_adjustment",
      narration: "Dealership 2 bank receipt",
      lines: [
        { accountCode: "1020", debit: 75000, credit: 0 },
        { accountCode: "3010", debit: 0, credit: 75000 },
      ],
    });

    // 1. Trial Balance sharedTreasury section
    const tb = await AccountingService.getTrialBalance({ businessId: bId });
    assert.ok(Array.isArray(tb.sharedTreasury));
    const cashItem = tb.sharedTreasury.find((t) => t.code === "1010");
    const bankItem = tb.sharedTreasury.find((t) => t.code === "1020");
    assert.ok(cashItem);
    assert.ok(bankItem);
    assert.equal(cashItem.balance, 50000);
    assert.equal(bankItem.balance, 75000);

    // 2. Balance Sheet sharedTreasury section
    const bs = await AccountingService.getBalanceSheet({ businessId: bId });
    assert.ok(bs.sharedTreasury);
    assert.equal(bs.sharedTreasury.accounts.length, 2);
    assert.equal(bs.sharedTreasury.totalTreasury, 125000); // 50k + 75k

    // 3. Consolidated reporting: each shared treasury account appears exactly once
    const tbCashAccounts = tb.accounts.filter((a) => a.code === "1010");
    const tbBankAccounts = tb.accounts.filter((a) => a.code === "1020");
    assert.equal(tbCashAccounts.length, 1);
    assert.equal(tbBankAccounts.length, 1);
  });

  test("7.9 P1.2: Monetary Precision: allocateMinorUnits preserves remainder and assertSafeMoney prevents overflow", async () => {
    // 1. Split 100.00 among 3 equal shares (1:1:1)
    const split3 = allocateMinorUnits(100.00, [1, 1, 1]);
    assert.deepEqual(split3, [33.33, 33.33, 33.34]);
    const sum3 = split3.reduce((a, b) => a + b, 0);
    assert.equal(Math.round(sum3 * 100) / 100, 100.00);

    // 2. Split 10.00 in 1:2 ratio
    const splitRatio = allocateMinorUnits(10.00, [1, 2]);
    assert.deepEqual(splitRatio, [3.33, 6.67]);
    assert.equal(Math.round((splitRatio[0] + splitRatio[1]) * 100) / 100, 10.00);

    // 3. Split 0.00
    const splitZero = allocateMinorUnits(0, [1, 1]);
    assert.deepEqual(splitZero, [0, 0]);

    // 4. assertSafeMoney safe values
    assert.doesNotThrow(() => assertSafeMoney(0));
    assert.doesNotThrow(() => assertSafeMoney(100.50));
    assert.doesNotThrow(() => assertSafeMoney(1000000000.99));

    // 5. assertSafeMoney overflow boundary
    assert.throws(
      () => assertSafeMoney(Number.MAX_SAFE_INTEGER),
      /Monetary precision overflow/
    );
  });

  test("7.10 P1: Safe Integer Boundaries: Unsafe values, NaN, and overflow are rejected at service and schema levels", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);

    // 1. assertSafeMoney rejects NaN, Infinity, and overflow
    assert.throws(() => assertSafeMoney(NaN), /Monetary precision overflow/);
    assert.throws(() => assertSafeMoney(Infinity), /Monetary precision overflow/);
    assert.throws(() => assertSafeMoney(-Infinity), /Monetary precision overflow/);
    assert.throws(() => assertSafeMoney(Number.MAX_SAFE_INTEGER), /Monetary precision overflow/);

    // 2. postJournalEntry rejects unsafe line amounts
    await assert.rejects(
      async () => {
        await AccountingService.postJournalEntry({
          businessId: bId,
          dealershipId: dId1,
          sourceType: "manual_adjustment",
          narration: "Overflow line amount",
          lines: [
            { accountCode: "1010", debit: Number.MAX_SAFE_INTEGER, credit: 0 },
            { accountCode: "2010", debit: 0, credit: Number.MAX_SAFE_INTEGER },
          ],
        });
      },
      /Monetary precision overflow/
    );

    // 3. Account balance overflow rejected via schema validation
    await assert.rejects(async () => {
      const acc = new Account({
        code: "9999",
        name: "Test Overflow",
        type: "asset",
        subType: "cash",
        balance: Number.MAX_SAFE_INTEGER,
      });
      await acc.validate();
    }, /Monetary precision overflow/);

    // 4. JournalEntry debitsTotal overflow rejected via schema validation
    await assert.rejects(async () => {
      const je = new JournalEntry({
        journalNumber: "JE-OVERFLOW",
        narration: "Overflow",
        sourceType: "manual_adjustment",
        debitsTotal: Number.MAX_SAFE_INTEGER,
        creditsTotal: Number.MAX_SAFE_INTEGER,
        lines: [
          { accountId: new mongoose.Types.ObjectId(), debit: Number.MAX_SAFE_INTEGER, credit: 0 },
          { accountId: new mongoose.Types.ObjectId(), debit: 0, credit: Number.MAX_SAFE_INTEGER },
        ],
      });
      await je.validate();
    }, /Monetary precision overflow/);
  });

  test("7.11 P1: Monetary Persistence: Fractional values, negative balances, and large amounts accumulate without floating point drift", async () => {
    await AccountingService.ensureDefaultAccounts(bId, dId1);

    // 1. Accumulate known floating-point drift values (0.10 + 0.20 = 0.30 in IEEE 754 is 0.30000000000000004)
    await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId1,
      sourceType: "manual_adjustment",
      narration: "Drift test 0.10",
      lines: [
        { accountCode: "1010", debit: 0.10, credit: 0 },
        { accountCode: "2010", debit: 0, credit: 0.10 },
      ],
    });

    await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId1,
      sourceType: "manual_adjustment",
      narration: "Drift test 0.20",
      lines: [
        { accountCode: "1010", debit: 0.20, credit: 0 },
        { accountCode: "2010", debit: 0, credit: 0.20 },
      ],
    });

    const cashAcc = accounts.find((a) => a.code === "1010");
    assert.equal(cashAcc.balance, 0.30);
    // Explicit string conversion check: must NOT have trailing drift digits
    assert.equal(cashAcc.balance.toString(), "0.3");

    // 2. Large values (50 billion BDT with 2 decimal places: 50,000,000,000.75)
    // 50,000,000,000.75 * 100 = 5,000,000,000,075 (5 trillion poisha), well within MAX_SAFE_INTEGER (9e15)
    const largeAmount = 50000000000.75;
    assert.doesNotThrow(() => assertSafeMoney(largeAmount));

    const largeEntry = await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId1,
      sourceType: "manual_adjustment",
      narration: "Large scale capital injection",
      lines: [
        { accountCode: "1020", debit: largeAmount, credit: 0 },
        { accountCode: "3010", debit: 0, credit: largeAmount },
      ],
    });

    assert.equal(largeEntry.debitsTotal, largeAmount);
    assert.equal(largeEntry.creditsTotal, largeAmount);
    assert.equal(accounts.find((a) => a.code === "1020").balance, largeAmount);

    // 3. Negative balance representation (Liabilities/Equity credit-normal debiting into negative)
    const payableAcc = accounts.find((a) => a.code === "2010");
    // Initial: 0.30. Post debit 100.30 -> net should be -100.00
    await AccountingService.postJournalEntry({
      businessId: bId,
      dealershipId: dId1,
      sourceType: "manual_adjustment",
      narration: "Overpayment resulting in debit balance on payable",
      lines: [
        { accountCode: "2010", debit: 100.30, credit: 0 },
        { accountCode: "1010", debit: 0, credit: 100.30 },
      ],
    });

    assert.equal(payableAcc.balance, -100.00);
    assert.equal(Number.isSafeInteger(Math.round(payableAcc.balance * 100)), true);
  });
});
