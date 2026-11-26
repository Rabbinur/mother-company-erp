import mongoose from "mongoose";
import { Account, type IAccount, type AccountType, type AccountSubType, type AccountCategory } from "@/models/Account";
import { JournalEntry, type IJournalEntry, type IJournalLine, type JournalSourceType } from "@/models/JournalEntry";
import { AccountingPeriod, type IAccountingPeriod } from "@/models/AccountingPeriod";
import { Counter } from "@/models/Counter";
import { generateReferenceCode } from "@/lib/utils";

/**
 * Monetary Precision Utilities (Minor Units / Poisha Integer Arithmetic)
 * Avoids unsafe JavaScript floating-point accumulation (e.g. 0.1 + 0.2 != 0.3).
 */
export function roundMoney(amount: number): number {
  return Math.round((Number(amount) || 0) * 100) / 100;
}

export function toMinorUnits(amount: number): number {
  return Math.round((Number(amount) || 0) * 100);
}

export function fromMinorUnits(minor: number): number {
  return Math.round(minor) / 100;
}

export function addMoney(...amounts: number[]): number {
  const sumMinor = amounts.reduce((acc, val) => acc + Math.round((Number(val) || 0) * 100), 0);
  return sumMinor / 100;
}

export function subtractMoney(a: number, b: number): number {
  return (Math.round((Number(a) || 0) * 100) - Math.round((Number(b) || 0) * 100)) / 100;
}

export function assertSafeMoney(amount: number): void {
  const num = Number(amount);
  if (isNaN(num) || !isFinite(num)) {
    throw new Error(`Monetary precision overflow: value is not a finite number (${amount})`);
  }
  const minor = Math.round(num * 100);
  if (!Number.isSafeInteger(minor)) {
    throw new Error(`Monetary precision overflow: value exceeds safe integer boundary (${amount})`);
  }
}

export function allocateMinorUnits(totalAmount: number, ratios: number[]): number[] {
  assertSafeMoney(totalAmount);
  const totalMinor = toMinorUnits(totalAmount);
  const sumRatios = ratios.reduce((a, b) => a + b, 0);
  if (sumRatios === 0) return ratios.map(() => 0);

  let allocatedMinor = 0;
  const result: number[] = [];

  for (let i = 0; i < ratios.length; i++) {
    if (i === ratios.length - 1) {
      const remainder = totalMinor - allocatedMinor;
      result.push(fromMinorUnits(remainder));
    } else {
      const share = Math.round((totalMinor * ratios[i]) / sumRatios);
      allocatedMinor += share;
      result.push(fromMinorUnits(share));
    }
  }
  return result;
}

export interface DefaultAccountDefinition {
  code: string;
  name: string;
  category: AccountCategory;
  type: AccountType;
  subType: AccountSubType;
  description: string;
  isSystem: boolean;
  isSharedTreasury?: boolean;
  normalBalance: "DEBIT" | "CREDIT";
}

export const DEFAULT_ACCOUNTS: DefaultAccountDefinition[] = [
  // ─── ASSETS (1000s) ──────────────────────────────────────────────────────────
  {
    code: "1010",
    name: "Cash in Hand",
    category: "ASSET",
    type: "asset",
    subType: "cash",
    normalBalance: "DEBIT",
    description: "Physical cash in hand and cashier vaults (Shared Business Treasury)",
    isSystem: true,
    isSharedTreasury: true,
  },
  {
    code: "1020",
    name: "Bank Account",
    category: "ASSET",
    type: "asset",
    subType: "bank",
    normalBalance: "DEBIT",
    description: "Primary commercial checking bank account (Shared Business Treasury)",
    isSystem: true,
    isSharedTreasury: true,
  },
  {
    code: "1031",
    name: "bKash Merchant Account",
    category: "ASSET",
    type: "asset",
    subType: "mfs_bkash",
    normalBalance: "DEBIT",
    description: "bKash MFS merchant wallet",
    isSystem: true,
  },
  {
    code: "1032",
    name: "Nagad Merchant Account",
    category: "ASSET",
    type: "asset",
    subType: "mfs_nagad",
    normalBalance: "DEBIT",
    description: "Nagad MFS merchant wallet",
    isSystem: true,
  },
  {
    code: "1033",
    name: "Rocket Merchant Account",
    category: "ASSET",
    type: "asset",
    subType: "mfs_rocket",
    normalBalance: "DEBIT",
    description: "Rocket MFS merchant wallet",
    isSystem: true,
  },
  {
    code: "1100",
    name: "Accounts Receivable",
    category: "ASSET",
    type: "asset",
    subType: "accounts_receivable",
    normalBalance: "DEBIT",
    description: "Amounts owed by customers and retailers for credit sales",
    isSystem: true,
  },
  {
    code: "1200",
    name: "Inventory Asset",
    category: "ASSET",
    type: "asset",
    subType: "inventory_asset",
    normalBalance: "DEBIT",
    description: "Total valuation of stock on hand in warehouses",
    isSystem: true,
  },
  {
    code: "1300",
    name: "Principal Receivable",
    category: "ASSET",
    type: "asset",
    subType: "principal_receivable",
    normalBalance: "DEBIT",
    description: "Reimbursements and approved claims owed by principal manufacturer",
    isSystem: true,
  },

  // ─── LIABILITIES (2000s) ─────────────────────────────────────────────────────
  {
    code: "2010",
    name: "Accounts Payable",
    category: "LIABILITY",
    type: "liability",
    subType: "accounts_payable",
    normalBalance: "CREDIT",
    description: "Amounts owed to suppliers and vendors for inventory purchases",
    isSystem: true,
  },
  {
    code: "2020",
    name: "Customer Advance",
    category: "LIABILITY",
    type: "liability",
    subType: "customer_advance",
    normalBalance: "CREDIT",
    description: "Advance payments received from customers before fulfillment",
    isSystem: true,
  },
  {
    code: "2030",
    name: "Other Payables",
    category: "LIABILITY",
    type: "liability",
    subType: "other_payable",
    normalBalance: "CREDIT",
    description: "Short term operational payables and accrued liabilities",
    isSystem: true,
  },
  {
    code: "2200",
    name: "Sales Tax / VAT Payable",
    category: "LIABILITY",
    type: "liability",
    subType: "tax_payable",
    normalBalance: "CREDIT",
    description: "Collected government sales taxes and VAT",
    isSystem: true,
  },

  // ─── EQUITY (3000s) ──────────────────────────────────────────────────────────
  {
    code: "3010",
    name: "Owner Capital",
    category: "EQUITY",
    type: "equity",
    subType: "owner_capital",
    normalBalance: "CREDIT",
    description: "Initial invested capital by business owner",
    isSystem: true,
  },
  {
    code: "3020",
    name: "Retained Earnings",
    category: "EQUITY",
    type: "equity",
    subType: "retained_earnings",
    normalBalance: "CREDIT",
    description: "Accumulated net earnings retained in business",
    isSystem: true,
  },

  // ─── REVENUE (4000s) ─────────────────────────────────────────────────────────
  {
    code: "4010",
    name: "Sales Revenue",
    category: "REVENUE",
    type: "revenue",
    subType: "sales_revenue",
    normalBalance: "CREDIT",
    description: "Gross revenue recognized from fulfilled customer orders",
    isSystem: true,
  },
  {
    code: "4020",
    name: "Other Operating Revenue",
    category: "REVENUE",
    type: "revenue",
    subType: "other_revenue",
    normalBalance: "CREDIT",
    description: "Ancillary revenue from services, commissions, or logistics",
    isSystem: true,
  },

  // ─── CONTRA REVENUE (4100s) ──────────────────────────────────────────────────
  {
    code: "4110",
    name: "Sales Returns",
    category: "CONTRA_REVENUE",
    type: "contra_revenue",
    subType: "sales_return",
    normalBalance: "DEBIT",
    description: "Returns of delivered products from customers",
    isSystem: true,
  },
  {
    code: "4120",
    name: "Sales Discounts",
    category: "CONTRA_REVENUE",
    type: "contra_revenue",
    subType: "sales_discount",
    normalBalance: "DEBIT",
    description: "Commercial discounts and trade promotions allowed to customers",
    isSystem: true,
  },

  // ─── EXPENSES (5000s) ────────────────────────────────────────────────────────
  {
    code: "5010",
    name: "Cost of Goods Sold (COGS)",
    category: "EXPENSE",
    type: "expense",
    subType: "cost_of_goods_sold",
    normalBalance: "DEBIT",
    description: "Direct historical cost of inventory goods delivered to customers",
    isSystem: true,
  },
  {
    code: "5020",
    name: "Delivery Expense",
    category: "EXPENSE",
    type: "expense",
    subType: "delivery_expense",
    normalBalance: "DEBIT",
    description: "Transport, fuel, and trip costs for product dispatch",
    isSystem: true,
  },
  {
    code: "5030",
    name: "Loading and Unloading",
    category: "EXPENSE",
    type: "expense",
    subType: "loading_unloading_expense",
    normalBalance: "DEBIT",
    description: "Labor charges for cargo loading, handling, and unloading",
    isSystem: true,
  },
  {
    code: "5040",
    name: "Warehouse Expense",
    category: "EXPENSE",
    type: "expense",
    subType: "warehouse_expense",
    normalBalance: "DEBIT",
    description: "Warehouse lease, utilities, storage, and maintenance",
    isSystem: true,
  },
  {
    code: "5050",
    name: "Salary Expense",
    category: "EXPENSE",
    type: "expense",
    subType: "salary_expense",
    normalBalance: "DEBIT",
    description: "Staff payroll, allowances, and compensation",
    isSystem: true,
  },
  {
    code: "5090",
    name: "Other Operating Expense",
    category: "EXPENSE",
    type: "expense",
    subType: "operating_expense",
    normalBalance: "DEBIT",
    description: "General administrative, office, and sundry operating costs",
    isSystem: true,
  },
];

export interface PostJournalInput {
  businessId?: string | mongoose.Types.ObjectId;
  dealershipId?: string | mongoose.Types.ObjectId;
  sourceType?: JournalSourceType | string;
  sourceId?: string;
  referenceType?: string;
  referenceId?: string;
  narration: string;
  description?: string;
  postingDate?: Date;
  date?: Date;
  idempotencyKey?: string;
  lines: Array<{
    accountId?: string | mongoose.Types.ObjectId;
    accountCode?: string;
    accountName?: string;
    dealershipId?: string | mongoose.Types.ObjectId;
    debit?: number;
    credit?: number;
    memo?: string;
    description?: string;
  }>;
  postedBy?: string | mongoose.Types.ObjectId;
  session?: mongoose.ClientSession;
}

export class AccountingService {
  /**
   * Check if MongoDB is connected or if models are mocked in memory.
   * Prevents 10-second Mongoose query buffering in disconnected mock tests.
   */
  static isDbReady(): boolean {
    if (mongoose.connection.readyState === 1) return true;
    return (Account.findOne as any) !== (mongoose.Model as any).findOne;
  }

  /**
   * Helper to execute operations within a MongoDB transaction.
   * Gracefully degrades in standalone/mock environments.
   * In production (NODE_ENV === "production"), FAILS CLOSED to guarantee financial safety.
   * Verifies existing session validity and transaction state before execution.
   */
  static async executeInTransaction<T>(
    fn: (session: mongoose.ClientSession | undefined) => Promise<T>,
    existingSession?: mongoose.ClientSession
  ): Promise<T> {
    const isProduction = process.env.NODE_ENV === "production";

    // 1. Existing Session Validation
    if (existingSession) {
      if (typeof (existingSession as any).hasEnded === "function" && (existingSession as any).hasEnded()) {
        throw new Error("Cannot execute accounting operation: provided database session has already ended");
      }
      if (typeof existingSession.inTransaction === "function" && existingSession.inTransaction()) {
        return await fn(existingSession);
      }
      // If session exists but transaction has not started, start one on that session
      if (typeof existingSession.withTransaction === "function") {
        let res: T;
        await existingSession.withTransaction(async (s) => {
          res = await fn(s);
        });
        return res!;
      }
      if (isProduction) {
        throw new Error("Financial transaction failed: existing session does not support transactions in production");
      }
      return await fn(existingSession);
    }

    // 2. Database readiness check
    if (mongoose.connection.readyState !== 1) {
      if (isProduction) {
        throw new Error("Financial transaction failed: Database connection is not ready in production");
      }
      return await fn(undefined);
    }

    // 3. Initiate dedicated ClientSession
    let session: mongoose.ClientSession | undefined;
    try {
      session = await mongoose.startSession();
    } catch (sessionErr: any) {
      if (isProduction) {
        throw new Error(`Financial transaction failed in production: cannot start session (${sessionErr?.message})`);
      }
      if (
        sessionErr?.message?.includes("replica set") ||
        sessionErr?.message?.includes("Transaction numbers are only allowed") ||
        sessionErr?.message?.includes("startSession is not a function")
      ) {
        return await fn(undefined);
      }
      throw sessionErr;
    }

    // 4. Execute transaction with safe failure handling
    try {
      let result: T;
      await session.withTransaction(async (s) => {
        result = await fn(s);
      });
      return result!;
    } catch (err: any) {
      if (isProduction) {
        throw new Error(`Financial transaction failed in production: ${err?.message || "Transaction aborted"}`);
      }
      // In non-production, only downgrade if engine specifically rejected transaction numbers before any writes
      if (
        (err?.message?.includes("replica set") ||
         err?.message?.includes("Transaction numbers are only allowed") ||
         err?.message?.includes("startSession is not a function")) &&
        typeof session.inTransaction === "function" &&
        !session.inTransaction()
      ) {
        return await fn(undefined);
      }
      throw err;
    } finally {
      if (session) {
        await session.endSession();
      }
    }
  }

  /**
   * Generate an atomic journal reference code: JE-YYYYMM-XXXX
   */
  static async generateJournalNumber(
    businessId?: string | mongoose.Types.ObjectId,
    session?: mongoose.ClientSession
  ): Promise<string> {
    const ym = new Date().toISOString().slice(0, 7).replace("-", "");
    const key = businessId ? `je_${String(businessId)}_${ym}` : `je_global_${ym}`;
    const seq = await Counter.getNextSequence(key, session);
    return generateReferenceCode("JE", seq);
  }

  /**
   * Initialize standard Chart of Accounts for business and dealerships
   */
  static async ensureDefaultAccounts(
    businessId?: string | mongoose.Types.ObjectId,
    dealershipId?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    if (!this.isDbReady()) return;

    const bId = businessId ? new mongoose.Types.ObjectId(String(businessId)) : undefined;
    const dId = dealershipId ? new mongoose.Types.ObjectId(String(dealershipId)) : undefined;

    for (const def of DEFAULT_ACCOUNTS) {
      // Shared accounts (Cash 1010 and Bank 1020) are business-level if dealershipId is not specified
      const isSharedTreasury = def.code === "1010" || def.code === "1020";
      const targetDealershipId = isSharedTreasury ? undefined : dId;

      const query: Record<string, any> = { code: def.code };
      if (bId) query.businessId = bId;
      if (targetDealershipId) query.dealershipId = targetDealershipId;
      else if (bId) query.dealershipId = { $in: [null, undefined] };

      const exists = await Account.findOne(query);
      if (!exists) {
        await Account.create({
          ...def,
          businessId: bId,
          dealershipId: targetDealershipId,
          isSharedTreasury,
          balance: 0,
          currency: "BDT",
          status: "active",
        });
      }
    }
  }

  /**
   * Find an active account by code
   */
  static async getAccountByCode(
    code: string,
    businessId?: string | mongoose.Types.ObjectId,
    dealershipId?: string | mongoose.Types.ObjectId
  ): Promise<IAccount> {
    const cleanCode = String(code).trim();
    const bId = businessId ? new mongoose.Types.ObjectId(String(businessId)) : undefined;
    const dId = dealershipId ? new mongoose.Types.ObjectId(String(dealershipId)) : undefined;

    // 1. Try exact dealership match
    if (bId && dId) {
      const match = await Account.findOne({
        businessId: bId,
        dealershipId: dId,
        code: cleanCode,
        status: "active",
      });
      if (match) return match;
    }

    // 2. Try business-level match
    if (bId) {
      const bMatch = await Account.findOne({
        businessId: bId,
        code: cleanCode,
        status: "active",
      });
      if (bMatch) return bMatch;
    }

    // 3. Fallback to global match
    const globalMatch = await Account.findOne({ code: cleanCode, status: "active" });
    if (globalMatch) return globalMatch;

    // Ensure defaults and retry
    await this.ensureDefaultAccounts(businessId, dealershipId);
    const retry = await Account.findOne({ code: cleanCode, status: "active" });
    if (!retry) {
      throw new Error(`Account code '${cleanCode}' not found in Chart of Accounts`);
    }
    return retry;
  }

  /**
   * Find an active account by subType
   */
  static async getAccountBySubType(
    subType: AccountSubType | string,
    businessId?: string | mongoose.Types.ObjectId,
    dealershipId?: string | mongoose.Types.ObjectId
  ): Promise<IAccount> {
    const bId = businessId ? new mongoose.Types.ObjectId(String(businessId)) : undefined;
    const dId = dealershipId ? new mongoose.Types.ObjectId(String(dealershipId)) : undefined;

    if (bId && dId) {
      const match = await Account.findOne({
        businessId: bId,
        dealershipId: dId,
        subType: subType as any,
        status: "active",
      });
      if (match) return match as unknown as IAccount;
    }

    if (bId) {
      const bMatch = await Account.findOne({
        businessId: bId,
        subType: subType as any,
        status: "active",
      });
      if (bMatch) return bMatch as unknown as IAccount;
    }

    const globalMatch = await Account.findOne({ subType: subType as any, status: "active" });
    if (globalMatch) return globalMatch as unknown as IAccount;

    await this.ensureDefaultAccounts(businessId, dealershipId);
    const retry = await Account.findOne({ subType: subType as any, status: "active" });
    if (!retry) {
      throw new Error(`Account for subType '${subType}' not found in Chart of Accounts`);
    }
    return retry as unknown as IAccount;
  }

  /**
   * Post a balanced double-entry journal entry atomically.
   * Invariant: Total Debits === Total Credits.
   * Updates Account balances based on normal balance configuration.
   */
  static async postJournalEntry(input: PostJournalInput): Promise<IJournalEntry> {
    if (!this.isDbReady()) return {} as any;

    return await this.executeInTransaction(async (session) => {
      // 1. Idempotency Check
      if (input.idempotencyKey) {
        const existing = await JournalEntry.findOne({
          idempotencyKey: input.idempotencyKey,
        }).session(session || null);
        if (existing) {
          return existing; // Idempotent playback
        }
      }

      const bId = input.businessId ? new mongoose.Types.ObjectId(String(input.businessId)) : undefined;
      const dId = input.dealershipId ? new mongoose.Types.ObjectId(String(input.dealershipId)) : undefined;
      const actId = input.postedBy ? new mongoose.Types.ObjectId(String(input.postedBy)) : undefined;
      const postingDate = input.postingDate || input.date || new Date();

      // 2. Accounting Period Verification & Database-Level Concurrency Coordination
      if (bId) {
        let periodDoc: any = null;
        if (typeof (AccountingPeriod as any).findOneAndUpdate === "function") {
          periodDoc = await (AccountingPeriod as any).findOneAndUpdate(
            {
              businessId: bId,
              startDate: { $lte: postingDate },
              endDate: { $gte: postingDate },
              status: "OPEN",
            },
            {
              $inc: { journalCount: 1 },
            },
            {
              session: session || null,
              new: true,
            }
          );
        }

        if (!periodDoc) {
          const closedOrMissing = await AccountingPeriod.findOne({
            businessId: bId,
            startDate: { $lte: postingDate },
            endDate: { $gte: postingDate },
          }).session(session || null);

          if (closedOrMissing && closedOrMissing.status === "CLOSED") {
            throw new Error(
              `Cannot post journal entry: Accounting period '${closedOrMissing.periodName}' is CLOSED for posting date ${postingDate.toISOString().slice(0, 10)}`
            );
          }
        }
      }

      if (!input.lines || input.lines.length < 2) {
        throw new Error("Journal entry must have at least two balanced lines");
      }

      let debitsTotal = 0;
      let creditsTotal = 0;
      const validatedLines: IJournalLine[] = [];

      // 3. Line validation and Account balance resolution
      for (const line of input.lines) {
        const d = roundMoney(Number(line.debit || 0));
        const c = roundMoney(Number(line.credit || 0));
        assertSafeMoney(d);
        assertSafeMoney(c);
        if (d < 0 || c < 0) {
          throw new Error("Debit and credit amounts cannot be negative");
        }
        if (d === 0 && c === 0) continue;

        debitsTotal = addMoney(debitsTotal, d);
        creditsTotal = addMoney(creditsTotal, c);

        let acc: IAccount | null = null;
        if (line.accountId) {
          acc = await Account.findById(line.accountId).session(session || null);
        } else if (line.accountCode) {
          acc = await this.getAccountByCode(line.accountCode, bId, line.dealershipId || dId);
        }

        if (!acc) {
          throw new Error(`Target account not found for line (Code: ${line.accountCode}, ID: ${line.accountId})`);
        }

        const lineDealershipId = line.dealershipId
          ? new mongoose.Types.ObjectId(String(line.dealershipId))
          : dId || acc.dealershipId;

        validatedLines.push({
          accountId: acc._id as mongoose.Types.ObjectId,
          accountCode: acc.code,
          accountName: acc.name,
          dealershipId: lineDealershipId,
          debit: d,
          credit: c,
          memo: line.memo || line.description || input.narration || input.description,
          description: line.description || line.memo || input.narration || input.description,
        });

        // 4. Update Account Balance according to normal balance
        // Debit increases: ASSET, EXPENSE, CONTRA_REVENUE
        // Credit increases: LIABILITY, EQUITY, REVENUE, CONTRA_ASSET
        const isDebitNormal =
          acc.normalBalance === "DEBIT" ||
          acc.category === "ASSET" ||
          acc.category === "EXPENSE" ||
          acc.category === "CONTRA_REVENUE" ||
          acc.type === "asset" ||
          acc.type === "expense" ||
          acc.type === "contra_revenue";

        const netDelta = isDebitNormal ? subtractMoney(d, c) : subtractMoney(c, d);
        if (typeof (Account as any).findByIdAndUpdate === "function") {
          const updated = await (Account as any).findByIdAndUpdate(
            acc._id,
            { $inc: { balance: netDelta } },
            { session: session || undefined, new: true }
          );
          if (updated) {
            acc.balance = roundMoney(updated.balance);
          } else {
            acc.balance = roundMoney(acc.balance + netDelta);
            await acc.save({ session });
          }
        } else {
          acc.balance = roundMoney(acc.balance + netDelta);
          await acc.save({ session });
        }
      }

      debitsTotal = roundMoney(debitsTotal);
      creditsTotal = roundMoney(creditsTotal);

      // 5. Enforce Double-Entry Balancing Invariant
      const diff = Math.abs(subtractMoney(debitsTotal, creditsTotal));
      if (diff > 0.001) {
        throw new Error(
          `Unbalanced journal entry: Total Debits (৳${debitsTotal.toFixed(2)}) != Total Credits (৳${creditsTotal.toFixed(2)})`
        );
      }

      const journalNumber = await this.generateJournalNumber(bId, session);
      const narrationText = input.narration?.trim() || input.description?.trim() || "Journal Entry";

      const createdEntries = (await JournalEntry.create(
        [
          {
            businessId: bId,
            dealershipId: dId,
            journalNumber,
            entryNumber: journalNumber,
            postingDate,
            date: postingDate,
            sourceType: input.sourceType || input.referenceType || "manual_adjustment",
            sourceId: input.sourceId || input.referenceId,
            referenceType: input.referenceType || input.sourceType || "manual_adjustment",
            referenceId: input.referenceId || input.sourceId,
            narration: narrationText,
            description: narrationText,
            lines: validatedLines,
            debitsTotal,
            creditsTotal,
            status: "POSTED",
            isPosted: true,
            postedBy: actId,
            postedAt: new Date(),
            idempotencyKey: input.idempotencyKey,
          } as any,
        ],
        session ? { session } : {}
      )) as any[];
      const entry = createdEntries[0];

      return entry;
    }, input.session);
  }

  /**
   * Reverse an existing posted journal entry.
   * Generates inverse lines (Debits become Credits; Credits become Debits).
   * Posted entries remain historically immutable: isPosted remains true.
   * Status is updated to REVERSED with bidirectional cross-references.
   * Only POSTED journals can be reversed; DRAFT cancellation is handled separately.
   * Includes failure recovery to prevent entries from remaining stuck in REVERSING.
   */
  static async reverseJournalEntry(params: {
    journalId: string | mongoose.Types.ObjectId;
    reason?: string;
    postedBy?: string | mongoose.Types.ObjectId;
    session?: mongoose.ClientSession;
  }): Promise<IJournalEntry> {
    const jId = new mongoose.Types.ObjectId(String(params.journalId));

    return await this.executeInTransaction(async (session) => {
      // 1. Validate original entry existence and base status
      const check = await JournalEntry.findById(jId).session(session || null);
      if (!check) throw new Error("Original journal entry not found");
      if (check.status === "DRAFT") {
        throw new Error("Only POSTED journals can be reversed; DRAFT entries cannot be reversed");
      }
      if (check.reversedByJournalId || check.status === "REVERSED") {
        throw new Error("Journal entry is already reversed");
      }
      if (check.status === "VOIDED") {
        throw new Error("Journal entry is voided and cannot be reversed");
      }

      // 2. Stale REVERSING lock handling:
      // Check if a committed reversal entry already exists for this journal
      if (check.status === "REVERSING") {
        const existingReversal = await JournalEntry.findOne({
          reversalOfJournalId: jId,
          status: "POSTED",
        }).session(session || null);

        if (existingReversal) {
          check.status = "REVERSED";
          check.isPosted = true;
          check.reversedByJournalId = existingReversal._id as mongoose.Types.ObjectId;
          await check.save({ session });
          return existingReversal;
        }

        const lastUpdated = new Date(check.updatedAt || check.createdAt || Date.now()).getTime();
        const isStuck = Date.now() - lastUpdated > 30000;
        if (!isStuck) {
          throw new Error("Journal reversal is currently in progress");
        }
        // Safe lock recovery within the transaction session
        check.status = "POSTED";
        await check.save({ session });
      }

      // 3. Atomic state lock: POSTED -> REVERSING
      let lockedOriginal: any = null;
      if (typeof (JournalEntry as any).findOneAndUpdate === "function") {
        lockedOriginal = await (JournalEntry as any).findOneAndUpdate(
          {
            _id: jId,
            status: "POSTED",
            reversedByJournalId: { $exists: false },
          },
          {
            $set: { status: "REVERSING" },
          },
          {
            session: session || null,
            new: true,
          }
        );
      }

      if (!lockedOriginal) {
        const refreshed = await JournalEntry.findById(jId).session(session || null);
        if (refreshed?.reversedByJournalId || refreshed?.status === "REVERSED") {
          throw new Error("Journal entry is already reversed");
        }
        if (refreshed?.status === "REVERSING") {
          throw new Error("Journal reversal is currently in progress");
        }
        throw new Error(`Cannot reverse journal entry with status '${refreshed?.status || "UNKNOWN"}'`);
      }

      // 4. Invert lines: debits -> credits, credits -> debits
      const inverseLines = lockedOriginal.lines.map((l: any) => ({
        accountId: l.accountId,
        accountCode: l.accountCode,
        accountName: l.accountName,
        dealershipId: l.dealershipId,
        debit: l.credit,
        credit: l.debit,
        memo: `Reversal of ${lockedOriginal.journalNumber || lockedOriginal.entryNumber}: ${params.reason || "Reversal adjustment"}`,
      }));

      // 5. Post the reversal entry
      let reversalEntry: IJournalEntry;
      try {
        reversalEntry = await this.postJournalEntry({
          businessId: lockedOriginal.businessId,
          dealershipId: lockedOriginal.dealershipId,
          sourceType: "manual_adjustment",
          sourceId: String(lockedOriginal._id),
          referenceType: lockedOriginal.sourceType || "manual_adjustment",
          referenceId: lockedOriginal.sourceId || String(lockedOriginal._id),
          narration: `Reversal of ${lockedOriginal.journalNumber || lockedOriginal.entryNumber} - ${params.reason || "Correction"}`,
          postingDate: new Date(),
          lines: inverseLines,
          postedBy: params.postedBy,
          idempotencyKey: `rev_${String(lockedOriginal._id)}`,
          session,
        });
      } catch (postErr) {
        // Rollback state lock in-session / in-memory before aborting
        lockedOriginal.status = "POSTED";
        await lockedOriginal.save({ session });
        throw postErr;
      }

      // 6. Update original and reversal entries:
      // CRITICAL: isPosted MUST remain true for immutable financial audit trail
      lockedOriginal.status = "REVERSED";
      lockedOriginal.isPosted = true;
      lockedOriginal.reversedByJournalId = reversalEntry._id as mongoose.Types.ObjectId;
      await lockedOriginal.save({ session });

      reversalEntry.reversalOfJournalId = lockedOriginal._id as mongoose.Types.ObjectId;
      await reversalEntry.save({ session });

      return reversalEntry;
    }, params.session);
  }

  // ==========================================
  // OPERATIONAL ACCOUNTING INTEGRATIONS
  // ==========================================

  /**
   * A. Purchase / GRN Confirmation
   * Dr Inventory Asset (1200)
   * Cr Accounts Payable (2010)
   * Must use historical landed-cost snapshot.
   */
  static async recordGrnConfirmation(params: {
    businessId: string | mongoose.Types.ObjectId;
    dealershipId: string | mongoose.Types.ObjectId;
    grnId: string | mongoose.Types.ObjectId;
    grnNumber: string;
    landedCostTotal: number;
    supplierName?: string;
    postedBy?: string | mongoose.Types.ObjectId;
    session?: mongoose.ClientSession;
  }): Promise<IJournalEntry> {
    if (!this.isDbReady()) return {} as any;
    const amount = Math.round(Number(params.landedCostTotal) * 100) / 100;
    if (amount <= 0) {
      throw new Error("Landed cost must be positive to record GRN confirmation journal");
    }

    const inventoryAcc = await this.getAccountByCode("1200", params.businessId, params.dealershipId);
    const payableAcc = await this.getAccountByCode("2010", params.businessId, params.dealershipId);

    return await this.postJournalEntry({
      businessId: params.businessId,
      dealershipId: params.dealershipId,
      sourceType: "purchase_grn",
      sourceId: String(params.grnId),
      narration: `Inventory receipt on verified GRN ${params.grnNumber} from ${params.supplierName || "Supplier"}`,
      idempotencyKey: `grn_conf_${String(params.grnId)}`,
      postedBy: params.postedBy,
      session: params.session,
      lines: [
        {
          accountId: inventoryAcc._id as mongoose.Types.ObjectId,
          accountCode: "1200",
          accountName: inventoryAcc.name,
          debit: amount,
          credit: 0,
          memo: `Inventory landed cost for GRN ${params.grnNumber}`,
        },
        {
          accountId: payableAcc._id as mongoose.Types.ObjectId,
          accountCode: "2010",
          accountName: payableAcc.name,
          debit: 0,
          credit: amount,
          memo: `Supplier payable liability for GRN ${params.grnNumber}`,
        },
      ],
    });
  }

  /**
   * B. Supplier Payment
   * Dr Accounts Payable (2010)
   * Cr Cash (1010) or Bank (1020)
   */
  static async recordSupplierPayment(params: {
    businessId: string | mongoose.Types.ObjectId;
    dealershipId?: string | mongoose.Types.ObjectId;
    paymentId: string | mongoose.Types.ObjectId;
    paymentNumber: string;
    amount: number;
    paymentMethod: "cash" | "bank_transfer" | "bank" | "bkash" | "nagad" | "other" | string;
    vendorName?: string;
    bankAccountCode?: string;
    postedBy?: string | mongoose.Types.ObjectId;
    session?: mongoose.ClientSession;
  }): Promise<IJournalEntry> {
    if (!this.isDbReady()) return {} as any;
    const amount = Math.round(Number(params.amount) * 100) / 100;
    if (amount <= 0) throw new Error("Payment amount must be greater than zero");

    const payableAcc = await this.getAccountByCode("2010", params.businessId, params.dealershipId);

    // Resolve credit account (Bank 1020 or Cash 1010)
    const isBank =
      params.paymentMethod === "bank" ||
      params.paymentMethod === "bank_transfer" ||
      params.paymentMethod === "bkash" ||
      params.paymentMethod === "nagad";
    const paymentAccountCode = params.bankAccountCode || (isBank ? "1020" : "1010");
    const creditAcc = await this.getAccountByCode(paymentAccountCode, params.businessId, params.dealershipId);

    return await this.postJournalEntry({
      businessId: params.businessId,
      dealershipId: params.dealershipId,
      sourceType: "supplier_payment",
      sourceId: String(params.paymentId),
      narration: `Payment ${params.paymentNumber} to supplier ${params.vendorName || "Vendor"}`,
      idempotencyKey: `sup_pay_${String(params.paymentId)}`,
      postedBy: params.postedBy,
      session: params.session,
      lines: [
        {
          accountId: payableAcc._id as mongoose.Types.ObjectId,
          accountCode: "2010",
          debit: amount,
          credit: 0,
          memo: `Reduce payable for payment ${params.paymentNumber}`,
        },
        {
          accountId: creditAcc._id as mongoose.Types.ObjectId,
          accountCode: creditAcc.code,
          debit: 0,
          credit: amount,
          memo: `Disbursement via ${creditAcc.name}`,
        },
      ],
    });
  }

  /**
   * C. Sales Fulfillment (Delivery/Order Completion)
   * 1. Dr Accounts Receivable (1100), Cr Sales Revenue (4010) for invoiced revenue
   * 2. Dr Cost of Goods Sold (5010), Cr Inventory Asset (1200) for historical batch cost
   */
  static async recordSalesFulfillment(params: {
    businessId: string | mongoose.Types.ObjectId;
    dealershipId: string | mongoose.Types.ObjectId;
    orderId: string | mongoose.Types.ObjectId;
    orderNumber: string;
    invoicedAmount?: number;
    revenueAmount?: number;
    batchCostTotal?: number;
    cogsAmount?: number;
    customerName?: string;
    postedBy?: string | mongoose.Types.ObjectId;
    session?: mongoose.ClientSession;
  }): Promise<IJournalEntry> {
    if (!this.isDbReady()) return {} as any;
    const revenue = roundMoney(Number(params.invoicedAmount ?? params.revenueAmount ?? 0));
    const cogs = roundMoney(Number(params.batchCostTotal ?? params.cogsAmount ?? 0));

    const arAcc = await this.getAccountByCode("1100", params.businessId, params.dealershipId);
    const revAcc = await this.getAccountByCode("4010", params.businessId, params.dealershipId);
    const cogsAcc = await this.getAccountByCode("5010", params.businessId, params.dealershipId);
    const invAcc = await this.getAccountByCode("1200", params.businessId, params.dealershipId);

    const lines: Array<{
      accountId: mongoose.Types.ObjectId;
      accountCode: string;
      debit: number;
      credit: number;
      memo: string;
    }> = [
      {
        accountId: arAcc._id as mongoose.Types.ObjectId,
        accountCode: "1100",
        debit: revenue,
        credit: 0,
        memo: `AR receivable for order ${params.orderNumber}`,
      },
      {
        accountId: revAcc._id as mongoose.Types.ObjectId,
        accountCode: "4010",
        debit: 0,
        credit: revenue,
        memo: `Recognized sales revenue for order ${params.orderNumber}`,
      },
    ];

    if (cogs > 0) {
      lines.push(
        {
          accountId: cogsAcc._id as mongoose.Types.ObjectId,
          accountCode: "5010",
          debit: cogs,
          credit: 0,
          memo: `COGS for order ${params.orderNumber}`,
        },
        {
          accountId: invAcc._id as mongoose.Types.ObjectId,
          accountCode: "1200",
          debit: 0,
          credit: cogs,
          memo: `Deduct inventory asset at landed cost for order ${params.orderNumber}`,
        }
      );
    }

    return await this.postJournalEntry({
      businessId: params.businessId,
      dealershipId: params.dealershipId,
      sourceType: "sales_fulfillment",
      sourceId: String(params.orderId),
      narration: `Delivered sales order ${params.orderNumber} to ${params.customerName || "Customer"}`,
      idempotencyKey: `sales_fulfill_${String(params.orderId)}`,
      postedBy: params.postedBy,
      session: params.session,
      lines,
    });
  }

  /**
   * D. Customer Payment
   * Dr Cash (1010) or Bank (1020)
   * Cr Accounts Receivable (1100)
   */
  static async recordCustomerPayment(params: {
    businessId: string | mongoose.Types.ObjectId;
    dealershipId?: string | mongoose.Types.ObjectId;
    paymentId: string | mongoose.Types.ObjectId;
    receiptNumber: string;
    amount: number;
    paymentMethod: "cash" | "bank_transfer" | "bank" | "bkash" | "nagad" | string;
    customerName?: string;
    depositAccountCode?: string;
    postedBy?: string | mongoose.Types.ObjectId;
    session?: mongoose.ClientSession;
  }): Promise<IJournalEntry> {
    if (!this.isDbReady()) return {} as any;
    const amount = Math.round(Number(params.amount) * 100) / 100;
    if (amount <= 0) throw new Error("Payment amount must be greater than zero");

    const isBank =
      params.paymentMethod === "bank" ||
      params.paymentMethod === "bank_transfer" ||
      params.paymentMethod === "bkash" ||
      params.paymentMethod === "nagad";
    const depositCode = params.depositAccountCode || (isBank ? "1020" : "1010");
    const depositAcc = await this.getAccountByCode(depositCode, params.businessId, params.dealershipId);
    const arAcc = await this.getAccountByCode("1100", params.businessId, params.dealershipId);

    return await this.postJournalEntry({
      businessId: params.businessId,
      dealershipId: params.dealershipId,
      sourceType: "customer_payment",
      sourceId: String(params.paymentId),
      narration: `Customer receipt ${params.receiptNumber} from ${params.customerName || "Customer"}`,
      idempotencyKey: `cust_pay_${String(params.paymentId)}`,
      postedBy: params.postedBy,
      session: params.session,
      lines: [
        {
          accountId: depositAcc._id as mongoose.Types.ObjectId,
          accountCode: depositAcc.code,
          debit: amount,
          credit: 0,
          memo: `Cash/Bank received via ${depositAcc.name}`,
        },
        {
          accountId: arAcc._id as mongoose.Types.ObjectId,
          accountCode: "1100",
          debit: 0,
          credit: amount,
          memo: `Clear AR receivable for receipt ${params.receiptNumber}`,
        },
      ],
    });
  }

  /**
   * E. Customer Returns & Refunds
   * Credit Note: Dr Sales Returns (4110), Cr Accounts Receivable (1100)
   * Cash Refund: Dr Sales Returns (4110), Cr Cash in Hand (1010) or Bank (1020)
   * Restock (if good): Dr Inventory Asset (1200), Cr COGS (5010)
   */
  static async recordCustomerReturn(params: {
    businessId: string | mongoose.Types.ObjectId;
    dealershipId: string | mongoose.Types.ObjectId;
    returnId: string | mongoose.Types.ObjectId;
    returnNumber: string;
    refundAmount: number;
    refundMethod: "credit_note" | "cash" | "bank_transfer" | "adjustment";
    restockedCost?: number;
    customerName?: string;
    postedBy?: string | mongoose.Types.ObjectId;
    session?: mongoose.ClientSession;
  }): Promise<IJournalEntry> {
    if (!this.isDbReady()) return {} as any;
    const amount = Math.round(Number(params.refundAmount) * 100) / 100;
    const restockCost = params.restockedCost ? Math.round(Number(params.restockedCost) * 100) / 100 : 0;

    const returnAcc = await this.getAccountByCode("4110", params.businessId, params.dealershipId);
    const isCreditNote = params.refundMethod === "credit_note" || params.refundMethod === "adjustment";

    let creditAccountCode = "1100";
    if (!isCreditNote) {
      creditAccountCode = params.refundMethod === "bank_transfer" ? "1020" : "1010";
    }
    const creditAcc = await this.getAccountByCode(creditAccountCode, params.businessId, params.dealershipId);

    const lines: Array<{
      accountId: mongoose.Types.ObjectId;
      accountCode: string;
      debit: number;
      credit: number;
      memo: string;
    }> = [
      {
        accountId: returnAcc._id as mongoose.Types.ObjectId,
        accountCode: "4110",
        debit: amount,
        credit: 0,
        memo: `Sales return recognized: ${params.returnNumber}`,
      },
      {
        accountId: creditAcc._id as mongoose.Types.ObjectId,
        accountCode: creditAcc.code,
        debit: 0,
        credit: amount,
        memo: isCreditNote
          ? `AR credit note issued: ${params.returnNumber}`
          : `Cash payout for return: ${params.returnNumber}`,
      },
    ];

    if (restockCost > 0) {
      const invAcc = await this.getAccountByCode("1200", params.businessId, params.dealershipId);
      const cogsAcc = await this.getAccountByCode("5010", params.businessId, params.dealershipId);
      lines.push(
        {
          accountId: invAcc._id as mongoose.Types.ObjectId,
          accountCode: "1200",
          debit: restockCost,
          credit: 0,
          memo: `Restock inventory for return ${params.returnNumber}`,
        },
        {
          accountId: cogsAcc._id as mongoose.Types.ObjectId,
          accountCode: "5010",
          debit: 0,
          credit: restockCost,
          memo: `Reverse COGS for restocked return ${params.returnNumber}`,
        }
      );
    }

    return await this.postJournalEntry({
      businessId: params.businessId,
      dealershipId: params.dealershipId,
      sourceType: "sales_return",
      sourceId: String(params.returnId),
      narration: `Customer return ${params.returnNumber} (${params.refundMethod}) from ${params.customerName || "Customer"}`,
      idempotencyKey: `sales_ret_${String(params.returnId)}_${params.refundMethod}`,
      postedBy: params.postedBy,
      session: params.session,
      lines,
    });
  }

  /**
   * F. Supplier Purchase Return
   * Dr Accounts Payable (2010)
   * Cr Inventory Asset (1200)
   */
  static async recordPurchaseReturn(params: {
    businessId: string | mongoose.Types.ObjectId;
    dealershipId: string | mongoose.Types.ObjectId;
    returnId: string | mongoose.Types.ObjectId;
    returnNumber: string;
    debitAmount: number;
    vendorName?: string;
    postedBy?: string | mongoose.Types.ObjectId;
    session?: mongoose.ClientSession;
  }): Promise<IJournalEntry> {
    if (!this.isDbReady()) return {} as any;
    const amount = Math.round(Number(params.debitAmount) * 100) / 100;
    if (amount <= 0) throw new Error("Purchase return debit amount must be greater than zero");

    const payableAcc = await this.getAccountByCode("2010", params.businessId, params.dealershipId);
    const invAcc = await this.getAccountByCode("1200", params.businessId, params.dealershipId);

    return await this.postJournalEntry({
      businessId: params.businessId,
      dealershipId: params.dealershipId,
      sourceType: "purchase_return",
      sourceId: String(params.returnId),
      narration: `Purchase return ${params.returnNumber} to supplier ${params.vendorName || "Vendor"}`,
      idempotencyKey: `pur_ret_${String(params.returnId)}`,
      postedBy: params.postedBy,
      session: params.session,
      lines: [
        {
          accountId: payableAcc._id as mongoose.Types.ObjectId,
          accountCode: "2010",
          debit: amount,
          credit: 0,
          memo: `Debit supplier payable for return ${params.returnNumber}`,
        },
        {
          accountId: invAcc._id as mongoose.Types.ObjectId,
          accountCode: "1200",
          debit: 0,
          credit: amount,
          memo: `Deduct inventory asset on return dispatch: ${params.returnNumber}`,
        },
      ],
    });
  }

  /**
   * G. Expense
   * Dr Expense Account (5020 - 5090)
   * Cr Cash (1010) or Bank (1020)
   */
  static async recordExpense(params: {
    businessId: string | mongoose.Types.ObjectId;
    dealershipId?: string | mongoose.Types.ObjectId;
    expenseId: string | mongoose.Types.ObjectId;
    expenseNumber: string;
    amount: number;
    expenseAccountCode?: string;
    paymentMethod: "cash" | "bank" | "bank_transfer" | "bkash" | "nagad" | string;
    payee?: string;
    description?: string;
    postedBy?: string | mongoose.Types.ObjectId;
    session?: mongoose.ClientSession;
  }): Promise<IJournalEntry> {
    if (!this.isDbReady()) return {} as any;
    const amount = Math.round(Number(params.amount) * 100) / 100;
    if (amount <= 0) throw new Error("Expense amount must be greater than zero");

    const expCode = params.expenseAccountCode || "5090";
    const expAcc = await this.getAccountByCode(expCode, params.businessId, params.dealershipId);

    const isBank =
      params.paymentMethod === "bank" ||
      params.paymentMethod === "bank_transfer" ||
      params.paymentMethod === "bkash" ||
      params.paymentMethod === "nagad";
    const paymentCode = isBank ? "1020" : "1010";
    const payAcc = await this.getAccountByCode(paymentCode, params.businessId, params.dealershipId);

    return await this.postJournalEntry({
      businessId: params.businessId,
      dealershipId: params.dealershipId,
      sourceType: "expense",
      sourceId: String(params.expenseId),
      narration: `Expense ${params.expenseNumber}: ${params.description || expAcc.name} paid to ${params.payee || "Payee"}`,
      idempotencyKey: `exp_${String(params.expenseId)}`,
      postedBy: params.postedBy,
      session: params.session,
      lines: [
        {
          accountId: expAcc._id as mongoose.Types.ObjectId,
          accountCode: expAcc.code,
          debit: amount,
          credit: 0,
          memo: `Expense: ${params.description || expAcc.name}`,
        },
        {
          accountId: payAcc._id as mongoose.Types.ObjectId,
          accountCode: payAcc.code,
          debit: 0,
          credit: amount,
          memo: `Disbursement from ${payAcc.name}`,
        },
      ],
    });
  }

  // ==========================================
  // FINANCIAL REPORTING ENGINE
  // ==========================================

  /**
   * Trial Balance
   * Total Debits === Total Credits
   */
  static async getTrialBalance(params?: {
    businessId?: string | mongoose.Types.ObjectId;
    dealershipId?: string | mongoose.Types.ObjectId;
    asOfDate?: Date;
  }): Promise<{
    accounts: Array<{
      code: string;
      name: string;
      category: string;
      normalBalance: string;
      debit: number;
      credit: number;
      isSharedTreasury?: boolean;
      dealershipId?: string | null;
    }>;
    sharedTreasury: Array<{
      code: string;
      name: string;
      category: string;
      normalBalance: string;
      debit: number;
      credit: number;
      balance: number;
    }>;
    totalDebits: number;
    totalCredits: number;
    isBalanced: boolean;
  }> {
    await this.ensureDefaultAccounts(params?.businessId, params?.dealershipId);

    const query: Record<string, any> = { status: "active" };
    if (params?.businessId) query.businessId = new mongoose.Types.ObjectId(String(params.businessId));
    if (params?.dealershipId) {
      query.$or = [
        { dealershipId: new mongoose.Types.ObjectId(String(params.dealershipId)) },
        { dealershipId: { $exists: false } },
        { dealershipId: null },
      ];
    }

    const accounts = await Account.find(query).sort({ code: 1 }).lean();

    let totalDebits = 0;
    let totalCredits = 0;

    const list = accounts.map((acc) => {
      let debit = 0;
      let credit = 0;

      const isDebitNormal =
        acc.normalBalance === "DEBIT" ||
        acc.category === "ASSET" ||
        acc.category === "EXPENSE" ||
        acc.category === "CONTRA_REVENUE" ||
        acc.type === "asset" ||
        acc.type === "expense" ||
        acc.type === "contra_revenue";

      if (isDebitNormal) {
        if (acc.balance >= 0) debit = acc.balance;
        else credit = Math.abs(acc.balance);
      } else {
        if (acc.balance >= 0) credit = acc.balance;
        else debit = Math.abs(acc.balance);
      }

      totalDebits = addMoney(totalDebits, debit);
      totalCredits = addMoney(totalCredits, credit);

      return {
        code: acc.code,
        name: acc.name,
        category: acc.category || acc.type.toUpperCase(),
        normalBalance: acc.normalBalance || (isDebitNormal ? "DEBIT" : "CREDIT"),
        debit: roundMoney(debit),
        credit: roundMoney(credit),
        isSharedTreasury: Boolean((acc as any).isSharedTreasury || acc.code === "1010" || acc.code === "1020"),
        dealershipId: acc.dealershipId ? String(acc.dealershipId) : null,
      };
    });

    const sharedTreasury = list
      .filter((acc) => acc.isSharedTreasury)
      .map((acc) => ({
        code: acc.code,
        name: acc.name,
        category: acc.category,
        normalBalance: acc.normalBalance,
        debit: acc.debit,
        credit: acc.credit,
        balance:
          acc.normalBalance === "DEBIT"
            ? subtractMoney(acc.debit, acc.credit)
            : subtractMoney(acc.credit, acc.debit),
      }));

    totalDebits = roundMoney(totalDebits);
    totalCredits = roundMoney(totalCredits);
    const isBalanced = Math.abs(subtractMoney(totalDebits, totalCredits)) <= 0.02;

    return {
      accounts: list,
      sharedTreasury,
      totalDebits,
      totalCredits,
      isBalanced,
    };
  }

  /**
   * Profit & Loss (Income Statement)
   * Gross Sales - Returns & Discounts = Net Revenue
   * Net Revenue - COGS = Gross Profit
   * Gross Profit - Expenses = Net Profit
   */
  static async getProfitAndLoss(
    paramsOrStartDate?: Date | {
      businessId?: string | mongoose.Types.ObjectId;
      dealershipId?: string | mongoose.Types.ObjectId;
      startDate?: Date;
      endDate?: Date;
    },
    endDateParam?: Date
  ): Promise<{
    salesRevenue: number;
    otherRevenue: number;
    grossRevenue: number;
    salesReturns: number;
    salesDiscounts: number;
    netRevenue: number;
    costOfGoodsSold: number;
    grossProfit: number;
    grossMarginPercentage: number;
    operatingExpenses: Array<{ code: string; name: string; amount: number }>;
    totalOperatingExpenses: number;
    netProfit: number;
    netProfitPercentage: number;
    revenue?: any;
    cogs?: any;
    expenses?: any;
  }> {
    const params = paramsOrStartDate instanceof Date
      ? { startDate: paramsOrStartDate, endDate: endDateParam }
      : paramsOrStartDate;

    await this.ensureDefaultAccounts(params?.businessId, params?.dealershipId);

    const query: Record<string, any> = { isPosted: true };
    if (params?.businessId) query.businessId = new mongoose.Types.ObjectId(String(params.businessId));
    if (params?.dealershipId) query.dealershipId = new mongoose.Types.ObjectId(String(params.dealershipId));

    if (params?.startDate || params?.endDate) {
      query.postingDate = {};
      if (params.startDate) query.postingDate.$gte = params.startDate;
      if (params.endDate) query.postingDate.$lte = params.endDate;
    }

    const entries = await JournalEntry.find(query).lean();

    let salesRevenue = 0;
    let otherRevenue = 0;
    let salesReturns = 0;
    let salesDiscounts = 0;
    let cogs = 0;
    const expenseMap = new Map<string, { code: string; name: string; amount: number }>();

    for (const entry of entries) {
      for (const line of entry.lines) {
        if (params?.dealershipId && line.dealershipId && String(line.dealershipId) !== String(params.dealershipId)) {
          continue; // Filter line-level dealership attribution
        }

        const code = line.accountCode || "";
        const netCredit = (line.credit || 0) - (line.debit || 0);
        const netDebit = (line.debit || 0) - (line.credit || 0);

        if (code === "4010" || code === "4100") {
          salesRevenue += netCredit;
        } else if (code === "4020") {
          otherRevenue += netCredit;
        } else if (code === "4110") {
          salesReturns += netDebit;
        } else if (code === "4120" || code === "5300") {
          salesDiscounts += netDebit;
        } else if (code === "5010" || code === "5100") {
          cogs += netDebit;
        } else if (code.startsWith("5")) {
          // Operating expenses
          const existing = expenseMap.get(code) || {
            code,
            name: line.accountName || "Operating Expense",
            amount: 0,
          };
          existing.amount += netDebit;
          expenseMap.set(code, existing);
        }
      }
    }

    salesRevenue = roundMoney(salesRevenue);
    otherRevenue = roundMoney(otherRevenue);
    const grossRevenue = addMoney(salesRevenue, otherRevenue);
    salesReturns = roundMoney(salesReturns);
    salesDiscounts = roundMoney(salesDiscounts);

    const netRevenue = subtractMoney(grossRevenue, addMoney(salesReturns, salesDiscounts));
    cogs = roundMoney(cogs);
    const grossProfit = subtractMoney(netRevenue, cogs);
    const grossMarginPercentage = netRevenue > 0 ? Math.round((grossProfit / netRevenue) * 1000) / 10 : 0;

    const operatingExpenses = Array.from(expenseMap.values()).map((e) => ({
      ...e,
      amount: roundMoney(e.amount),
    }));
    const totalOperatingExpenses = roundMoney(
      operatingExpenses.reduce((sum, e) => sum + e.amount, 0)
    );

    const netProfit = subtractMoney(grossProfit, totalOperatingExpenses);
    const netProfitPercentage = netRevenue > 0 ? Math.round((netProfit / netRevenue) * 1000) / 10 : 0;

    return {
      salesRevenue,
      otherRevenue,
      grossRevenue,
      salesReturns,
      salesDiscounts,
      netRevenue,
      costOfGoodsSold: cogs,
      grossProfit,
      grossMarginPercentage,
      operatingExpenses,
      totalOperatingExpenses,
      netProfit,
      netProfitPercentage,
      revenue: {
        salesRevenue,
        otherRevenue,
        grossRevenue,
        salesReturns,
        returnsAndAllowances: salesReturns,
        salesDiscounts,
        netRevenue,
      },
      cogs: {
        costOfGoodsSold: cogs,
        cogsTotal: cogs,
      },
      expenses: {
        expenseLines: operatingExpenses,
        totalExpenses: totalOperatingExpenses,
      },
    };
  }

  /**
   * Balance Sheet
   * Assets = Liabilities + Equity
   */
  static async getBalanceSheet(params?: {
    businessId?: string | mongoose.Types.ObjectId;
    dealershipId?: string | mongoose.Types.ObjectId;
    asOfDate?: Date;
  }): Promise<{
    assets: any;
    totalAssets: number;
    liabilities: any;
    totalLiabilities: number;
    equity: any;
    totalEquity: number;
    totalLiabilitiesAndEquity: number;
    isBalanced: boolean;
    sharedTreasury: {
      accounts: Array<{
        code: string;
        name: string;
        category: string;
        normalBalance: string;
        debit: number;
        credit: number;
        balance: number;
      }>;
      totalTreasury: number;
    };
  }> {
    const tb = await this.getTrialBalance(params);
    const pnl = await this.getProfitAndLoss(params);

    const assets: Array<{ code: string; name: string; amount: number }> = [];
    let totalAssets = 0;

    const liabilities: Array<{ code: string; name: string; amount: number }> = [];
    let totalLiabilities = 0;

    const equity: Array<{ code: string; name: string; amount: number }> = [];
    let totalEquity = 0;

    for (const acc of tb.accounts) {
      if (acc.code.startsWith("1")) {
        const net = subtractMoney(acc.debit, acc.credit);
        assets.push({ code: acc.code, name: acc.name, amount: net });
        totalAssets = addMoney(totalAssets, net);
      } else if (acc.code.startsWith("2")) {
        const net = subtractMoney(acc.credit, acc.debit);
        liabilities.push({ code: acc.code, name: acc.name, amount: net });
        totalLiabilities = addMoney(totalLiabilities, net);
      } else if (acc.code.startsWith("3")) {
        const net = subtractMoney(acc.credit, acc.debit);
        equity.push({ code: acc.code, name: acc.name, amount: net });
        totalEquity = addMoney(totalEquity, net);
      }
    }

    // Add current period Net Profit to Equity (Retained Earnings projection)
    if (pnl.netProfit !== 0) {
      equity.push({
        code: "CURRENT_PNL",
        name: "Current Period Net Income",
        amount: roundMoney(pnl.netProfit),
      });
      totalEquity = addMoney(totalEquity, pnl.netProfit);
    }

    totalAssets = roundMoney(totalAssets);
    totalLiabilities = roundMoney(totalLiabilities);
    totalEquity = roundMoney(totalEquity);
    const totalLiabilitiesAndEquity = addMoney(totalLiabilities, totalEquity);
    const isBalanced = Math.abs(subtractMoney(totalAssets, totalLiabilitiesAndEquity)) <= 0.05;

    const sharedTreasuryItems = tb.sharedTreasury || [];
    const totalSharedTreasury = roundMoney(
      sharedTreasuryItems.reduce((acc, curr) => addMoney(acc, curr.balance), 0)
    );

    return {
      assets: {
        lines: assets,
        totalAssets,
      },
      totalAssets,
      liabilities: {
        lines: liabilities,
        totalLiabilities,
      },
      totalLiabilities,
      equity: {
        lines: equity,
        totalEquity,
        retainedEarnings: pnl.netProfit,
      },
      totalEquity,
      totalLiabilitiesAndEquity,
      isBalanced,
      sharedTreasury: {
        accounts: sharedTreasuryItems,
        totalTreasury: totalSharedTreasury,
      },
    };
  }

  /**
   * General Ledger Statement with running balance per account
   */
  static async getGeneralLedger(params: {
    businessId?: string | mongoose.Types.ObjectId;
    dealershipId?: string | mongoose.Types.ObjectId;
    accountCode?: string;
    accountId?: string | mongoose.Types.ObjectId;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    account: { code: string; name: string; category: string; normalBalance: string };
    openingBalance: number;
    lines: Array<{
      date: Date;
      journalNumber: string;
      sourceType: string;
      sourceId?: string;
      memo: string;
      debit: number;
      credit: number;
      runningBalance: number;
    }>;
    closingBalance: number;
  }> {
    let acc: IAccount | null = null;
    if (params.accountId) {
      acc = (await Account.findById(params.accountId)) as unknown as IAccount;
    } else if (params.accountCode) {
      acc = await this.getAccountByCode(params.accountCode, params.businessId, params.dealershipId);
    }
    if (!acc) throw new Error("Account not found for General Ledger query");
    const isDebitNormal = acc.normalBalance === "DEBIT";

    // Query historical journal entries
    const query: Record<string, any> = {
      isPosted: true,
      "lines.accountId": acc._id,
    };
    if (params.businessId) query.businessId = new mongoose.Types.ObjectId(String(params.businessId));

    const entries = await JournalEntry.find(query).sort({ postingDate: 1, createdAt: 1 }).lean();

    let runningBalance = 0;
    let openingBalance = 0;
    const ledgerLines: any[] = [];

    for (const entry of entries) {
      const line = entry.lines.find((l) => String(l.accountId) === String(acc._id));
      if (!line) continue;

      if (params.dealershipId && line.dealershipId && String(line.dealershipId) !== String(params.dealershipId)) {
        continue;
      }

      const pDate = entry.postingDate || entry.date || entry.createdAt;
      const d = line.debit || 0;
      const c = line.credit || 0;
      const delta = isDebitNormal ? subtractMoney(d, c) : subtractMoney(c, d);

      if (params.startDate && pDate < params.startDate) {
        openingBalance = addMoney(openingBalance, delta);
        runningBalance = addMoney(runningBalance, delta);
        continue;
      }

      if (params.endDate && pDate > params.endDate) {
        continue;
      }

      runningBalance = addMoney(runningBalance, delta);
      ledgerLines.push({
        date: pDate,
        journalNumber: entry.journalNumber || entry.entryNumber,
        sourceType: entry.sourceType || entry.referenceType,
        sourceId: entry.sourceId || entry.referenceId,
        memo: line.memo || line.description || entry.narration,
        debit: d,
        credit: c,
        runningBalance: roundMoney(runningBalance),
      });
    }

    openingBalance = roundMoney(openingBalance);
    const closingBalance = roundMoney(runningBalance);

    return {
      account: {
        code: acc.code,
        name: acc.name,
        category: acc.category || acc.type.toUpperCase(),
        normalBalance: acc.normalBalance || (isDebitNormal ? "DEBIT" : "CREDIT"),
      },
      openingBalance,
      lines: ledgerLines,
      closingBalance,
    };
  }

  // ==========================================
  // ACCOUNTING PERIOD MANAGEMENT
  // ==========================================

  static async createPeriod(params: {
    businessId: string | mongoose.Types.ObjectId;
    dealershipId?: string | mongoose.Types.ObjectId;
    periodName: string;
    startDate: Date;
    endDate: Date;
    createdBy?: string | mongoose.Types.ObjectId;
  }): Promise<IAccountingPeriod> {
    const bId = new mongoose.Types.ObjectId(String(params.businessId));
    const dId = params.dealershipId ? new mongoose.Types.ObjectId(String(params.dealershipId)) : undefined;

    return await AccountingPeriod.create({
      businessId: bId,
      dealershipId: dId,
      periodName: params.periodName.trim(),
      startDate: params.startDate,
      endDate: params.endDate,
      status: "OPEN",
      ...(params.createdBy ? { createdBy: new mongoose.Types.ObjectId(String(params.createdBy)) } : {}),
    });
  }

  static async closePeriod(
    periodIdOrParams: string | mongoose.Types.ObjectId | {
      periodId: string | mongoose.Types.ObjectId;
      actorId?: string | mongoose.Types.ObjectId;
      closingNotes?: string;
    },
    actorId?: string | mongoose.Types.ObjectId,
    closingNotes?: string
  ): Promise<IAccountingPeriod> {
    let pId: mongoose.Types.ObjectId;
    let actId: mongoose.Types.ObjectId | undefined;
    let notes: string | undefined;

    if (typeof periodIdOrParams === "string" || periodIdOrParams instanceof mongoose.Types.ObjectId) {
      pId = new mongoose.Types.ObjectId(String(periodIdOrParams));
      actId = actorId ? new mongoose.Types.ObjectId(String(actorId)) : undefined;
      notes = closingNotes;
    } else {
      pId = new mongoose.Types.ObjectId(String(periodIdOrParams.periodId));
      actId = periodIdOrParams.actorId ? new mongoose.Types.ObjectId(String(periodIdOrParams.actorId)) : undefined;
      notes = periodIdOrParams.closingNotes;
    }

    return await this.executeInTransaction(async (session) => {
      let period: any = null;
      if (typeof (AccountingPeriod as any).findOneAndUpdate === "function") {
        period = await (AccountingPeriod as any).findOneAndUpdate(
          { _id: pId, status: "OPEN" },
          {
            $set: {
              status: "CLOSED",
              closedAt: new Date(),
              ...(actId ? { closedBy: actId } : {}),
              ...(notes ? { closingNotes: notes.trim() } : {}),
            },
          },
          { session: session || null, new: true }
        );
      }

      if (!period) {
        const check = await AccountingPeriod.findById(pId).session(session || null);
        if (!check) throw new Error("Accounting period not found");
        if (check.status === "CLOSED") throw new Error("Accounting period is already closed");
        period = check;
        period.status = "CLOSED";
        period.closedAt = new Date();
        if (actId) period.closedBy = actId;
        if (notes) period.closingNotes = notes.trim();
        await period.save({ session });
      }

      return period;
    });
  }

  static async reopenPeriod(
    periodIdOrParams: string | mongoose.Types.ObjectId | {
      periodId: string | mongoose.Types.ObjectId;
    }
  ): Promise<IAccountingPeriod> {
    const pId = typeof periodIdOrParams === "string" || periodIdOrParams instanceof mongoose.Types.ObjectId
      ? new mongoose.Types.ObjectId(String(periodIdOrParams))
      : new mongoose.Types.ObjectId(String(periodIdOrParams.periodId));

    return await this.executeInTransaction(async (session) => {
      let period: any = null;
      if (typeof (AccountingPeriod as any).findOneAndUpdate === "function") {
        period = await (AccountingPeriod as any).findOneAndUpdate(
          { _id: pId, status: "CLOSED" },
          {
            $set: {
              status: "OPEN",
            },
            $unset: {
              closedAt: 1,
              closedBy: 1,
            },
          },
          { session: session || null, new: true }
        );
      }

      if (!period) {
        const check = await AccountingPeriod.findById(pId).session(session || null);
        if (!check) throw new Error("Accounting period not found");
        period = check;
        period.status = "OPEN";
        period.closedAt = undefined;
        period.closedBy = undefined;
        await period.save({ session });
      }

      return period;
    });
  }

  // ==========================================
  // PHASE 3 STEP 9: ADVANCED FINANCIAL REPORTS
  // ==========================================

  static async getArAgingReport(params: {
    businessId?: string | mongoose.Types.ObjectId;
    dealershipId?: string | mongoose.Types.ObjectId;
    customerId?: string | mongoose.Types.ObjectId;
    asOfDate?: Date;
    minBalance?: number;
  }) {
    const { FinancialReportService } = await import("./FinancialReportService");
    return await FinancialReportService.getArAgingReport(params);
  }

  static async getApAgingReport(params: {
    businessId?: string | mongoose.Types.ObjectId;
    dealershipId?: string | mongoose.Types.ObjectId;
    principalCompanyId?: string | mongoose.Types.ObjectId;
    supplierId?: string | mongoose.Types.ObjectId;
    asOfDate?: Date;
  }) {
    const { FinancialReportService } = await import("./FinancialReportService");
    return await FinancialReportService.getApAgingReport(params);
  }

  static async getCashBankReconciliation(params: {
    businessId?: string | mongoose.Types.ObjectId;
    dealershipId?: string | mongoose.Types.ObjectId;
    accountId?: string | mongoose.Types.ObjectId;
    accountCode?: string;
    startDate?: Date;
    endDate?: Date;
    statementEndingBalance?: number;
  }) {
    const { FinancialReportService } = await import("./FinancialReportService");
    return await FinancialReportService.getCashBankReconciliation(params);
  }

  static async recordBankReconciliation(params: {
    businessId: string | mongoose.Types.ObjectId;
    dealershipId?: string | mongoose.Types.ObjectId | null;
    accountId: string | mongoose.Types.ObjectId;
    statementDate: Date;
    statementEndingBalance: number;
    reconciledBy?: string | mongoose.Types.ObjectId;
    notes?: string;
  }) {
    const { FinancialReportService } = await import("./FinancialReportService");
    return await FinancialReportService.recordBankReconciliation(params);
  }
}
