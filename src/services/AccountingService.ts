import mongoose from "mongoose";
import { Account, IAccount, AccountType, AccountSubType } from "@/models/Account";
import { JournalEntry, IJournalEntry, IJournalLine } from "@/models/JournalEntry";
import { generateReferenceCode } from "@/lib/utils";

export const DEFAULT_ACCOUNTS: Array<{
  code: string;
  name: string;
  type: AccountType;
  subType: AccountSubType;
  description: string;
  isSystem: boolean;
}> = [
  {
    code: "1010",
    name: "Cash on Hand",
    type: "asset",
    subType: "cash",
    description: "Physical cash in office",
    isSystem: true,
  },
  {
    code: "1020",
    name: "Main Bank Account",
    type: "asset",
    subType: "bank",
    description: "Company checking account",
    isSystem: true,
  },
  {
    code: "1031",
    name: "bKash Merchant Account",
    type: "asset",
    subType: "mfs_bkash",
    description: "bKash merchant wallet",
    isSystem: true,
  },
  {
    code: "1032",
    name: "Nagad Merchant Account",
    type: "asset",
    subType: "mfs_nagad",
    description: "Nagad merchant wallet",
    isSystem: true,
  },
  {
    code: "1033",
    name: "Rocket Merchant Account",
    type: "asset",
    subType: "mfs_rocket",
    description: "Rocket merchant wallet",
    isSystem: true,
  },
  {
    code: "1100",
    name: "Accounts Receivable",
    type: "asset",
    subType: "accounts_receivable",
    description: "Amounts owed by customers and retailers",
    isSystem: true,
  },
  {
    code: "1200",
    name: "Inventory Asset",
    type: "asset",
    subType: "inventory_asset",
    description: "Total valuation of stock in central warehouse",
    isSystem: true,
  },
  {
    code: "2100",
    name: "Accounts Payable",
    type: "liability",
    subType: "accounts_payable",
    description: "Amounts owed to suppliers and vendors",
    isSystem: true,
  },
  {
    code: "2200",
    name: "Sales Tax / VAT Payable",
    type: "liability",
    subType: "tax_payable",
    description: "Collected government taxes",
    isSystem: true,
  },
  {
    code: "3100",
    name: "Owner / Company Capital",
    type: "equity",
    subType: "owner_equity",
    description: "Initial invested equity",
    isSystem: true,
  },
  {
    code: "4100",
    name: "Sales Revenue",
    type: "revenue",
    subType: "sales_revenue",
    description: "Gross revenue from customer sales",
    isSystem: true,
  },
  {
    code: "5100",
    name: "Cost of Goods Sold (COGS)",
    type: "expense",
    subType: "cost_of_goods_sold",
    description: "Direct cost of products fulfilled and delivered",
    isSystem: true,
  },
  {
    code: "5200",
    name: "Operating Expenses",
    type: "expense",
    subType: "operating_expense",
    description: "Administrative, warehouse, rent, and utility expenses",
    isSystem: true,
  },
  {
    code: "5300",
    name: "Sales Discounts Given",
    type: "expense",
    subType: "sales_discount",
    description: "Discounts granted on orders",
    isSystem: true,
  },
];

export class AccountingService {
  /**
   * Initialize default chart of accounts if not present
   */
  static async ensureDefaultAccounts(): Promise<void> {
    for (const def of DEFAULT_ACCOUNTS) {
      const exists = await Account.findOne({ code: def.code });
      if (!exists) {
        await Account.create({
          ...def,
          balance: 0,
          currency: "BDT",
          status: "active",
        });
      }
    }
  }

  /**
   * Find an active account by subType
   */
  static async getAccountBySubType(subType: AccountSubType): Promise<IAccount> {
    await this.ensureDefaultAccounts();
    const account = await Account.findOne({ subType, status: "active" });
    if (!account) {
      throw new Error(`System account for subType '${subType}' not found.`);
    }
    return account;
  }

  /**
   * Post a balanced double-entry journal entry
   * Automatically updates account balances.
   * Debits === Credits strictly enforced!
   */
  static async postJournalEntry(params: {
    referenceType:
      | "sales_order"
      | "purchase_receive"
      | "customer_payment"
      | "vendor_payment"
      | "expense"
      | "sales_return"
      | "purchase_return"
      | "manual_adjustment"
      | "opening_balance";
    referenceId?: string;
    narration: string;
    lines: Array<{
      accountId: mongoose.Types.ObjectId;
      debit: number;
      credit: number;
      description?: string;
    }>;
    date?: Date;
    postedBy?: mongoose.Types.ObjectId;
    session?: mongoose.ClientSession;
  }): Promise<IJournalEntry> {
    let debitsTotal = 0;
    let creditsTotal = 0;

    const validatedLines: IJournalLine[] = [];

    for (const line of params.lines) {
      const d = Math.round((line.debit || 0) * 100) / 100;
      const c = Math.round((line.credit || 0) * 100) / 100;
      debitsTotal += d;
      creditsTotal += c;

      const acc = await Account.findById(line.accountId).session(params.session || null);
      if (!acc) {
        throw new Error(`Account ID ${line.accountId} not found for journal entry`);
      }

      validatedLines.push({
        accountId: line.accountId,
        accountCode: acc.code,
        accountName: acc.name,
        debit: d,
        credit: c,
        description: line.description || params.narration,
      });

      // Update account balance based on account type
      // Asset & Expense increase with Debit, decrease with Credit
      // Liability, Equity & Revenue increase with Credit, decrease with Debit
      let netDelta = 0;
      if (acc.type === "asset" || acc.type === "expense") {
        netDelta = d - c;
      } else {
        netDelta = c - d;
      }

      acc.balance = Math.round((acc.balance + netDelta) * 100) / 100;
      await acc.save({ session: params.session });
    }

    const diff = Math.abs(debitsTotal - creditsTotal);
    if (diff > 0.01) {
      throw new Error(
        `Double-entry imbalance: Total Debits (৳${debitsTotal.toFixed(2)}) != Total Credits (৳${creditsTotal.toFixed(2)})`
      );
    }

    const entryNumber = generateReferenceCode(
      "JE",
      Math.floor(Math.random() * 9000 + 1000)
    );

    const created = await JournalEntry.create(
      [
        {
          entryNumber,
          date: params.date || new Date(),
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          narration: params.narration,
          lines: validatedLines,
          debitsTotal,
          creditsTotal,
          isPosted: true,
          postedBy: params.postedBy,
        },
      ],
      params.session ? { session: params.session } : {}
    );

    return created[0];
  }

  /**
   * Profit & Loss Report
   * Revenue - COGS = Gross Profit
   * Gross Profit - Operating Expenses = Net Profit
   */
  static async getProfitAndLoss(
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    salesRevenue: number;
    salesDiscounts: number;
    netSales: number;
    costOfGoodsSold: number;
    grossProfit: number;
    grossMarginPercentage: number;
    operatingExpenses: number;
    netProfit: number;
    netProfitPercentage: number;
  }> {
    await this.ensureDefaultAccounts();

    const query: Record<string, unknown> = { isPosted: true };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) (query.date as Record<string, unknown>).$gte = startDate;
      if (endDate) (query.date as Record<string, unknown>).$lte = endDate;
    }

    const entries = await JournalEntry.find(query).lean();

    const revAcc = await this.getAccountBySubType("sales_revenue");
    const cogsAcc = await this.getAccountBySubType("cost_of_goods_sold");
    const opExpAcc = await this.getAccountBySubType("operating_expense");
    const discAcc = await this.getAccountBySubType("sales_discount");

    let salesRevenue = 0;
    let costOfGoodsSold = 0;
    let operatingExpenses = 0;
    let salesDiscounts = 0;

    for (const entry of entries) {
      for (const line of entry.lines) {
        const lineAccId = String(line.accountId);
        if (lineAccId === String(revAcc._id)) {
          salesRevenue += line.credit - line.debit;
        } else if (lineAccId === String(cogsAcc._id)) {
          costOfGoodsSold += line.debit - line.credit;
        } else if (lineAccId === String(opExpAcc._id)) {
          operatingExpenses += line.debit - line.credit;
        } else if (lineAccId === String(discAcc._id)) {
          salesDiscounts += line.debit - line.credit;
        }
      }
    }

    salesRevenue = Math.max(0, Math.round(salesRevenue * 100) / 100);
    costOfGoodsSold = Math.max(0, Math.round(costOfGoodsSold * 100) / 100);
    operatingExpenses = Math.max(0, Math.round(operatingExpenses * 100) / 100);
    salesDiscounts = Math.max(0, Math.round(salesDiscounts * 100) / 100);

    const netSales = Math.round((salesRevenue - salesDiscounts) * 100) / 100;
    const grossProfit = Math.round((netSales - costOfGoodsSold) * 100) / 100;
    const grossMarginPercentage =
      netSales > 0 ? Math.round((grossProfit / netSales) * 1000) / 10 : 0;
    const netProfit = Math.round((grossProfit - operatingExpenses) * 100) / 100;
    const netProfitPercentage =
      netSales > 0 ? Math.round((netProfit / netSales) * 1000) / 10 : 0;

    return {
      salesRevenue,
      salesDiscounts,
      netSales,
      costOfGoodsSold,
      grossProfit,
      grossMarginPercentage,
      operatingExpenses,
      netProfit,
      netProfitPercentage,
    };
  }

  /**
   * Trial Balance
   */
  static async getTrialBalance(): Promise<
    Array<{
      code: string;
      name: string;
      type: string;
      debit: number;
      credit: number;
    }>
  > {
    await this.ensureDefaultAccounts();
    const accounts = await Account.find({ status: "active" }).sort({ code: 1 }).lean();

    return accounts.map((acc) => {
      let debit = 0;
      let credit = 0;
      if (acc.type === "asset" || acc.type === "expense") {
        if (acc.balance >= 0) debit = acc.balance;
        else credit = Math.abs(acc.balance);
      } else {
        if (acc.balance >= 0) credit = acc.balance;
        else debit = Math.abs(acc.balance);
      }
      return {
        code: acc.code,
        name: acc.name,
        type: acc.type,
        debit,
        credit,
      };
    });
  }
}
