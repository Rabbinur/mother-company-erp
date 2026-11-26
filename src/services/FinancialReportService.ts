import mongoose from "mongoose";
import { Account, type IAccount } from "@/models/Account";
import { JournalEntry } from "@/models/JournalEntry";
import { CustomerDealershipAccount } from "@/models/CustomerDealershipAccount";
import { Customer } from "@/models/Customer";
import { SupplierPayable } from "@/models/SupplierPayable";
import { Vendor } from "@/models/Vendor";
import { PrincipalCompany } from "@/models/PrincipalCompany";
import { Order } from "@/models/Order";
import { BankReconciliation, type IBankReconciliation } from "@/models/BankReconciliation";
import {
  roundMoney,
  addMoney,
  subtractMoney,
  assertSafeMoney,
} from "./AccountingService";

export interface ArAgingCustomerItem {
  customerId: string;
  customerName: string;
  phone?: string;
  shopName?: string;
  dealershipId: string;
  dealershipName?: string;
  creditLimit: number;
  currentBalance: number;
  current: number;
  days1_30: number;
  days31_60: number;
  days61_90: number;
  days90Plus: number;
  oldestInvoiceDate?: Date | null;
  unpaidOrdersCount: number;
}

export interface ArAgingReportResult {
  asOfDate: Date;
  businessId?: string;
  dealershipId?: string;
  summary: {
    totalReceivables: number;
    totalCurrent: number;
    totalDays1_30: number;
    totalDays31_60: number;
    totalDays61_90: number;
    totalDays90Plus: number;
    customerCount: number;
  };
  reconciliation: {
    glAccountCode: string;
    glAccountName: string;
    glBalance: number;
    subledgerTotal: number;
    discrepancy: number;
    isReconciled: boolean;
  };
  customers: ArAgingCustomerItem[];
}

export interface ApAgingSupplierItem {
  vendorId: string;
  vendorName: string;
  vendorCode?: string;
  principalCompanyId?: string | null;
  principalCompanyName?: string | null;
  dealershipId: string;
  dealershipName?: string;
  outstandingBalance: number;
  current: number;
  days1_30: number;
  days31_60: number;
  days61_90: number;
  days90Plus: number;
  oldestInvoiceDate?: Date | null;
  payablesCount: number;
}

export interface ApAgingReportResult {
  asOfDate: Date;
  businessId?: string;
  dealershipId?: string;
  principalCompanyId?: string;
  summary: {
    totalPayables: number;
    totalCurrent: number;
    totalDays1_30: number;
    totalDays31_60: number;
    totalDays61_90: number;
    totalDays90Plus: number;
    vendorCount: number;
    payablesCount: number;
  };
  reconciliation: {
    glAccountCode: string;
    glAccountName: string;
    glBalance: number;
    subledgerTotal: number;
    discrepancy: number;
    isReconciled: boolean;
  };
  suppliers: ApAgingSupplierItem[];
}

export interface CashBankTransactionLine {
  date: Date;
  journalNumber: string;
  sourceType: string;
  sourceId?: string;
  memo: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface CashBankAccountReconciliationItem {
  accountId: string;
  accountCode: string;
  accountName: string;
  category: string;
  subType: string;
  isSharedTreasury: boolean;
  dealershipId?: string | null;
  dealershipName?: string;
  currency: string;
  openingBalance: number;
  periodDebits: number;
  periodCredits: number;
  closingBalance: number;
  statementEndingBalance?: number;
  discrepancy?: number;
  reconciliationStatus?: "RECONCILED" | "DISCREPANCY" | "UNRECONCILED";
  transactionsCount: number;
  transactions?: CashBankTransactionLine[];
}

export interface CashBankReconciliationResult {
  businessId?: string;
  dealershipId?: string;
  startDate?: Date;
  endDate?: Date;
  sharedTreasury: {
    accounts: CashBankAccountReconciliationItem[];
    totalOpening: number;
    totalDebits: number;
    totalCredits: number;
    totalClosing: number;
  };
  dealershipTreasury: {
    accounts: CashBankAccountReconciliationItem[];
    totalOpening: number;
    totalDebits: number;
    totalCredits: number;
    totalClosing: number;
  };
  summary: {
    totalCashOnHand: number;
    totalBankBalances: number;
    totalMfsBalances: number;
    totalTreasury: number;
    sharedTreasuryClosing: number;
    dealershipTreasuryClosing: number;
  };
}

export class FinancialReportService {
  /**
   * Safe DB readiness check
   */
  private static isDbReady(): boolean {
    return mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2;
  }

  // =========================================================================
  // 1. AR AGING REPORT
  // =========================================================================

  /**
   * Generates Customer-wise Accounts Receivable Aging Report.
   * Buckets: Current, 1–30, 31–60, 61–90, 90+ days past invoice date.
   * Dealership-wise filtering and business consolidated view.
   * Reconciles against General Ledger Account 1100 (Accounts Receivable).
   */
  static async getArAgingReport(params: {
    businessId?: string | mongoose.Types.ObjectId;
    dealershipId?: string | mongoose.Types.ObjectId;
    customerId?: string | mongoose.Types.ObjectId;
    asOfDate?: Date;
    minBalance?: number;
  }): Promise<ArAgingReportResult> {
    const asOfDate = params.asOfDate ? new Date(params.asOfDate) : new Date();
    const asOfTime = asOfDate.getTime();

    const query: Record<string, any> = {
      isDeleted: false,
    };
    if (params.businessId) {
      query.businessId = new mongoose.Types.ObjectId(String(params.businessId));
    }
    if (params.dealershipId) {
      query.dealershipId = new mongoose.Types.ObjectId(String(params.dealershipId));
    }
    if (params.customerId) {
      query.customerId = new mongoose.Types.ObjectId(String(params.customerId));
    }

    const minBal = params.minBalance !== undefined ? params.minBalance : 0.01;
    query.currentBalance = { $gte: minBal };

    // Fetch customer dealership accounts
    const accounts = await CustomerDealershipAccount.find(query)
      .populate("customerId", "name phone shopName code")
      .populate("dealershipId", "name code")
      .lean();

    const customerItems: ArAgingCustomerItem[] = [];

    let totalReceivables = 0;
    let totalCurrent = 0;
    let totalDays1_30 = 0;
    let totalDays31_60 = 0;
    let totalDays61_90 = 0;
    let totalDays90Plus = 0;

    for (const acc of accounts) {
      const balance = roundMoney(acc.currentBalance);
      if (balance <= 0) continue;

      const cust = acc.customerId as any;
      const dship = acc.dealershipId as any;

      // Query unpaid/partially paid orders for this customer & dealership to calculate invoice-level aging
      const orderQuery: Record<string, any> = {
        customerId: acc.customerId?._id || acc.customerId,
        dealershipId: acc.dealershipId?._id || acc.dealershipId,
        paymentStatus: { $in: ["unpaid", "partially_paid"] },
        orderStatus: { $nin: ["draft", "cancelled", "DRAFT", "CANCELLED"] },
      };

      const unpaidOrders = await Order.find(orderQuery)
        .sort({ orderDate: 1, createdAt: 1 })
        .lean();

      let current = 0;
      let days1_30 = 0;
      let days31_60 = 0;
      let days61_90 = 0;
      let days90Plus = 0;
      let oldestDate: Date | null = null;

      let remainingBalanceToBucket = balance;

      if (unpaidOrders.length > 0) {
        // Distribute according to actual unpaid invoice age
        for (const ord of unpaidOrders) {
          if (remainingBalanceToBucket <= 0) break;

          const invDate = new Date(ord.orderDate || ord.createdAt);
          if (!oldestDate || invDate < oldestDate) oldestDate = invDate;

          const unpaidOnOrder = roundMoney(
            ord.receivableAmount !== undefined
              ? ord.receivableAmount
              : Math.max(0, (ord.grandTotal || ord.totalAmount || 0) - (ord.paidAmount || 0))
          );
          if (unpaidOnOrder <= 0) continue;

          const allocAmount = Math.min(remainingBalanceToBucket, unpaidOnOrder);
          remainingBalanceToBucket = subtractMoney(remainingBalanceToBucket, allocAmount);

          const diffDays = Math.floor((asOfTime - invDate.getTime()) / (1000 * 60 * 60 * 24));

          if (diffDays <= 0) {
            current = addMoney(current, allocAmount);
          } else if (diffDays <= 30) {
            days1_30 = addMoney(days1_30, allocAmount);
          } else if (diffDays <= 60) {
            days31_60 = addMoney(days31_60, allocAmount);
          } else if (diffDays <= 90) {
            days61_90 = addMoney(days61_90, allocAmount);
          } else {
            days90Plus = addMoney(days90Plus, allocAmount);
          }
        }
      }

      // If opening balance or remaining ledger balance exceeds individual invoices
      if (remainingBalanceToBucket > 0) {
        const accCreated = new Date(acc.createdAt || asOfDate);
        if (!oldestDate) oldestDate = accCreated;
        const diffDays = Math.floor((asOfTime - accCreated.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) {
          current = addMoney(current, remainingBalanceToBucket);
        } else if (diffDays <= 30) {
          days1_30 = addMoney(days1_30, remainingBalanceToBucket);
        } else if (diffDays <= 60) {
          days31_60 = addMoney(days31_60, remainingBalanceToBucket);
        } else if (diffDays <= 90) {
          days61_90 = addMoney(days61_90, remainingBalanceToBucket);
        } else {
          days90Plus = addMoney(days90Plus, remainingBalanceToBucket);
        }
      }

      assertSafeMoney(balance);
      totalReceivables = addMoney(totalReceivables, balance);
      totalCurrent = addMoney(totalCurrent, current);
      totalDays1_30 = addMoney(totalDays1_30, days1_30);
      totalDays31_60 = addMoney(totalDays31_60, days31_60);
      totalDays61_90 = addMoney(totalDays61_90, days61_90);
      totalDays90Plus = addMoney(totalDays90Plus, days90Plus);

      customerItems.push({
        customerId: String(cust?._id || acc.customerId),
        customerName: cust?.name || "Unknown Customer",
        phone: cust?.phone || "",
        shopName: cust?.shopName || "",
        dealershipId: String(dship?._id || acc.dealershipId),
        dealershipName: dship?.name || "",
        creditLimit: roundMoney(acc.creditLimit || 0),
        currentBalance: balance,
        current: roundMoney(current),
        days1_30: roundMoney(days1_30),
        days31_60: roundMoney(days31_60),
        days61_90: roundMoney(days61_90),
        days90Plus: roundMoney(days90Plus),
        oldestInvoiceDate: oldestDate,
        unpaidOrdersCount: unpaidOrders.length,
      });
    }

    // Sort by largest outstanding balance first
    customerItems.sort((a, b) => b.currentBalance - a.currentBalance);

    // Reconcile against GL Account 1100 (Accounts Receivable)
    let glArBalance = 0;
    const arAccountQuery: Record<string, any> = { code: "1100", status: "active" };
    if (params.businessId) {
      arAccountQuery.businessId = new mongoose.Types.ObjectId(String(params.businessId));
    }
    if (params.dealershipId) {
      arAccountQuery.dealershipId = new mongoose.Types.ObjectId(String(params.dealershipId));
    }

    const arAccounts = await Account.find(arAccountQuery).lean();
    for (const ar of arAccounts) {
      glArBalance = addMoney(glArBalance, ar.balance || 0);
    }
    glArBalance = roundMoney(glArBalance);

    const discrepancy = subtractMoney(glArBalance, totalReceivables);
    const isReconciled = Math.abs(discrepancy) <= 0.05;

    return {
      asOfDate,
      businessId: params.businessId ? String(params.businessId) : undefined,
      dealershipId: params.dealershipId ? String(params.dealershipId) : undefined,
      summary: {
        totalReceivables: roundMoney(totalReceivables),
        totalCurrent: roundMoney(totalCurrent),
        totalDays1_30: roundMoney(totalDays1_30),
        totalDays31_60: roundMoney(totalDays31_60),
        totalDays61_90: roundMoney(totalDays61_90),
        totalDays90Plus: roundMoney(totalDays90Plus),
        customerCount: customerItems.length,
      },
      reconciliation: {
        glAccountCode: "1100",
        glAccountName: "Accounts Receivable",
        glBalance: glArBalance,
        subledgerTotal: roundMoney(totalReceivables),
        discrepancy: roundMoney(discrepancy),
        isReconciled,
      },
      customers: customerItems,
    };
  }

  // =========================================================================
  // 2. AP AGING REPORT
  // =========================================================================

  /**
   * Generates Supplier-wise Accounts Payable Aging Report.
   * Buckets: Current, 1–30, 31–60, 61–90, 90+ days past invoice/due date.
   * Dealership-wise and Principal-Company-wise filtering.
   * Reconciles against General Ledger Account 2010 (Accounts Payable).
   */
  static async getApAgingReport(params: {
    businessId?: string | mongoose.Types.ObjectId;
    dealershipId?: string | mongoose.Types.ObjectId;
    principalCompanyId?: string | mongoose.Types.ObjectId;
    supplierId?: string | mongoose.Types.ObjectId;
    asOfDate?: Date;
  }): Promise<ApAgingReportResult> {
    const asOfDate = params.asOfDate ? new Date(params.asOfDate) : new Date();
    const asOfTime = asOfDate.getTime();

    const query: Record<string, any> = {
      isCancelled: { $ne: true },
      status: { $in: ["UNPAID", "PARTIALLY_PAID"] },
      outstandingBalance: { $gt: 0 },
    };

    if (params.businessId) {
      query.businessId = new mongoose.Types.ObjectId(String(params.businessId));
    }
    if (params.dealershipId) {
      query.dealershipId = new mongoose.Types.ObjectId(String(params.dealershipId));
    }
    if (params.principalCompanyId) {
      query.principalCompanyId = new mongoose.Types.ObjectId(String(params.principalCompanyId));
    }
    if (params.supplierId) {
      query.supplierId = new mongoose.Types.ObjectId(String(params.supplierId));
    }

    const payables = await SupplierPayable.find(query)
      .populate("supplierId", "name code currentPayable")
      .populate("principalCompanyId", "name code")
      .populate("dealershipId", "name code")
      .sort({ invoiceDate: 1 })
      .lean();

    // Group payables by vendor
    const supplierMap = new Map<string, {
      vendor: any;
      principalCompany?: any;
      dealership?: any;
      payables: any[];
      totalOutstanding: number;
      current: number;
      days1_30: number;
      days31_60: number;
      days61_90: number;
      days90Plus: number;
      oldestDate: Date | null;
    }>();

    let totalPayables = 0;
    let totalCurrent = 0;
    let totalDays1_30 = 0;
    let totalDays31_60 = 0;
    let totalDays61_90 = 0;
    let totalDays90Plus = 0;

    for (const p of payables) {
      const balance = roundMoney(p.outstandingBalance || 0);
      if (balance <= 0) continue;

      const vId = String(p.supplierId?._id || p.supplierId);
      const groupKey = `${vId}_${String(p.dealershipId?._id || p.dealershipId)}`;

      let group = supplierMap.get(groupKey);
      if (!group) {
        group = {
          vendor: p.supplierId,
          principalCompany: p.principalCompanyId,
          dealership: p.dealershipId,
          payables: [],
          totalOutstanding: 0,
          current: 0,
          days1_30: 0,
          days31_60: 0,
          days61_90: 0,
          days90Plus: 0,
          oldestDate: null,
        };
        supplierMap.set(groupKey, group);
      }

      group.payables.push(p);
      group.totalOutstanding = addMoney(group.totalOutstanding, balance);

      const invDate = new Date(p.dueDate || p.invoiceDate || p.createdAt);
      if (!group.oldestDate || invDate < group.oldestDate) {
        group.oldestDate = invDate;
      }

      const diffDays = Math.floor((asOfTime - invDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) {
        group.current = addMoney(group.current, balance);
        totalCurrent = addMoney(totalCurrent, balance);
      } else if (diffDays <= 30) {
        group.days1_30 = addMoney(group.days1_30, balance);
        totalDays1_30 = addMoney(totalDays1_30, balance);
      } else if (diffDays <= 60) {
        group.days31_60 = addMoney(group.days31_60, balance);
        totalDays31_60 = addMoney(totalDays31_60, balance);
      } else if (diffDays <= 90) {
        group.days61_90 = addMoney(group.days61_90, balance);
        totalDays61_90 = addMoney(totalDays61_90, balance);
      } else {
        group.days90Plus = addMoney(group.days90Plus, balance);
        totalDays90Plus = addMoney(totalDays90Plus, balance);
      }

      totalPayables = addMoney(totalPayables, balance);
    }

    const supplierItems: ApAgingSupplierItem[] = Array.from(supplierMap.values()).map((g) => ({
      vendorId: String(g.vendor?._id || ""),
      vendorName: g.vendor?.name || "Unknown Supplier",
      vendorCode: g.vendor?.code || "",
      principalCompanyId: g.principalCompany?._id ? String(g.principalCompany._id) : null,
      principalCompanyName: g.principalCompany?.name || null,
      dealershipId: String(g.dealership?._id || ""),
      dealershipName: g.dealership?.name || "",
      outstandingBalance: roundMoney(g.totalOutstanding),
      current: roundMoney(g.current),
      days1_30: roundMoney(g.days1_30),
      days31_60: roundMoney(g.days31_60),
      days61_90: roundMoney(g.days61_90),
      days90Plus: roundMoney(g.days90Plus),
      oldestInvoiceDate: g.oldestDate,
      payablesCount: g.payables.length,
    }));

    supplierItems.sort((a, b) => b.outstandingBalance - a.outstandingBalance);

    // Reconcile against GL Account 2010 (Accounts Payable)
    let glApBalance = 0;
    const apAccountQuery: Record<string, any> = { code: "2010", status: "active" };
    if (params.businessId) {
      apAccountQuery.businessId = new mongoose.Types.ObjectId(String(params.businessId));
    }
    if (params.dealershipId) {
      apAccountQuery.dealershipId = new mongoose.Types.ObjectId(String(params.dealershipId));
    }

    const apAccounts = await Account.find(apAccountQuery).lean();
    for (const ap of apAccounts) {
      glApBalance = addMoney(glApBalance, ap.balance || 0);
    }
    glApBalance = roundMoney(glApBalance);

    const discrepancy = subtractMoney(glApBalance, totalPayables);
    const isReconciled = Math.abs(discrepancy) <= 0.05;

    return {
      asOfDate,
      businessId: params.businessId ? String(params.businessId) : undefined,
      dealershipId: params.dealershipId ? String(params.dealershipId) : undefined,
      principalCompanyId: params.principalCompanyId ? String(params.principalCompanyId) : undefined,
      summary: {
        totalPayables: roundMoney(totalPayables),
        totalCurrent: roundMoney(totalCurrent),
        totalDays1_30: roundMoney(totalDays1_30),
        totalDays31_60: roundMoney(totalDays31_60),
        totalDays61_90: roundMoney(totalDays61_90),
        totalDays90Plus: roundMoney(totalDays90Plus),
        vendorCount: supplierItems.length,
        payablesCount: payables.length,
      },
      reconciliation: {
        glAccountCode: "2010",
        glAccountName: "Accounts Payable",
        glBalance: glApBalance,
        subledgerTotal: roundMoney(totalPayables),
        discrepancy: roundMoney(discrepancy),
        isReconciled,
      },
      suppliers: supplierItems,
    };
  }

  // =========================================================================
  // 3. CASH & BANK RECONCILIATION
  // =========================================================================

  /**
   * Cash & Bank Reconciliation Engine.
   * Reports account-wise opening balance, total debits, total credits, closing balance,
   * transaction history, and discrepancy analysis against statement ending balances.
   * Business-level shared treasury accounts (1010, 1020) are reported in a separate
   * dedicated section, preventing balance duplication across dealerships.
   */
  static async getCashBankReconciliation(params: {
    businessId?: string | mongoose.Types.ObjectId;
    dealershipId?: string | mongoose.Types.ObjectId;
    accountId?: string | mongoose.Types.ObjectId;
    accountCode?: string;
    startDate?: Date;
    endDate?: Date;
    statementEndingBalance?: number;
  }): Promise<CashBankReconciliationResult> {
    const query: Record<string, any> = {
      status: "active",
      type: "asset",
      subType: { $in: ["cash", "bank", "mfs_bkash", "mfs_nagad", "mfs_rocket"] },
    };

    if (params.businessId) {
      query.businessId = new mongoose.Types.ObjectId(String(params.businessId));
    }

    if (params.accountId) {
      query._id = new mongoose.Types.ObjectId(String(params.accountId));
    } else if (params.accountCode) {
      query.code = params.accountCode;
    }

    if (params.dealershipId) {
      // If dealership specified, include dealership accounts OR shared treasury
      query.$or = [
        { dealershipId: new mongoose.Types.ObjectId(String(params.dealershipId)) },
        { isSharedTreasury: true },
        { code: { $in: ["1010", "1020"] } },
        { dealershipId: null },
        { dealershipId: { $exists: false } },
      ];
    }

    const accounts = await Account.find(query)
      .populate("dealershipId", "name code")
      .sort({ code: 1 })
      .lean();

    const sharedTreasuryItems: CashBankAccountReconciliationItem[] = [];
    const dealershipItems: CashBankAccountReconciliationItem[] = [];

    let totalCash = 0;
    let totalBank = 0;
    let totalMfs = 0;

    let sharedOpening = 0;
    let sharedDebits = 0;
    let sharedCredits = 0;
    let sharedClosing = 0;

    let dshipOpening = 0;
    let dshipDebits = 0;
    let dshipCredits = 0;
    let dshipClosing = 0;

    for (const acc of accounts) {
      const isShared = Boolean(
        (acc as any).isSharedTreasury ||
        acc.code === "1010" ||
        acc.code === "1020" ||
        !acc.dealershipId
      );

      // Query posted journal entries affecting this account
      const journalQuery: Record<string, any> = {
        isPosted: true,
        "lines.accountId": acc._id,
      };
      if (params.businessId) {
        journalQuery.businessId = new mongoose.Types.ObjectId(String(params.businessId));
      }

      const entries = await JournalEntry.find(journalQuery)
        .sort({ postingDate: 1, createdAt: 1 })
        .lean();

      let openingBalance = 0;
      let periodDebits = 0;
      let periodCredits = 0;
      let runningBalance = 0;

      const transactionLines: CashBankTransactionLine[] = [];

      for (const entry of entries) {
        const line = entry.lines.find((l) => String(l.accountId) === String(acc._id));
        if (!line) continue;

        // If dealership specified on line, filter non-shared line attribution
        if (
          params.dealershipId &&
          !isShared &&
          line.dealershipId &&
          String(line.dealershipId) !== String(params.dealershipId)
        ) {
          continue;
        }

        const pDate = new Date(entry.postingDate || entry.date || entry.createdAt);
        const d = roundMoney(line.debit || 0);
        const c = roundMoney(line.credit || 0);
        const delta = subtractMoney(d, c); // Cash/Bank are debit-normal asset accounts

        if (params.startDate && pDate < params.startDate) {
          openingBalance = addMoney(openingBalance, delta);
          runningBalance = addMoney(runningBalance, delta);
          continue;
        }

        if (params.endDate && pDate > params.endDate) {
          continue;
        }

        periodDebits = addMoney(periodDebits, d);
        periodCredits = addMoney(periodCredits, c);
        runningBalance = addMoney(runningBalance, delta);

        transactionLines.push({
          date: pDate,
          journalNumber: entry.journalNumber || entry.entryNumber || "JE",
          sourceType: entry.sourceType,
          sourceId: entry.sourceId,
          memo: line.memo || line.description || entry.narration || "",
          debit: d,
          credit: c,
          runningBalance: roundMoney(runningBalance),
        });
      }

      openingBalance = roundMoney(openingBalance);
      periodDebits = roundMoney(periodDebits);
      periodCredits = roundMoney(periodCredits);

      // If no start date filter, opening is 0 and closing equals account balance
      const closingBalance = params.startDate
        ? roundMoney(addMoney(openingBalance, subtractMoney(periodDebits, periodCredits)))
        : roundMoney(acc.balance || 0);

      // Discrepancy calculation if statementEndingBalance provided
      let discrepancy: number | undefined;
      let reconciliationStatus: "RECONCILED" | "DISCREPANCY" | "UNRECONCILED" = "UNRECONCILED";

      if (params.statementEndingBalance !== undefined && String(acc._id) === String(params.accountId)) {
        discrepancy = roundMoney(subtractMoney(params.statementEndingBalance, closingBalance));
        reconciliationStatus = Math.abs(discrepancy) < 0.01 ? "RECONCILED" : "DISCREPANCY";
      }

      // Categorize totals by subType
      if (acc.subType === "cash") {
        totalCash = addMoney(totalCash, closingBalance);
      } else if (acc.subType === "bank") {
        totalBank = addMoney(totalBank, closingBalance);
      } else if (acc.subType.startsWith("mfs")) {
        totalMfs = addMoney(totalMfs, closingBalance);
      }

      const item: CashBankAccountReconciliationItem = {
        accountId: String(acc._id),
        accountCode: acc.code,
        accountName: acc.name,
        category: acc.category || "ASSET",
        subType: acc.subType,
        isSharedTreasury: isShared,
        dealershipId: acc.dealershipId ? String((acc.dealershipId as any)._id || acc.dealershipId) : null,
        dealershipName: (acc.dealershipId as any)?.name,
        currency: acc.currency || "BDT",
        openingBalance,
        periodDebits,
        periodCredits,
        closingBalance,
        statementEndingBalance: params.statementEndingBalance,
        discrepancy,
        reconciliationStatus,
        transactionsCount: transactionLines.length,
        transactions: transactionLines,
      };

      if (isShared) {
        sharedOpening = addMoney(sharedOpening, openingBalance);
        sharedDebits = addMoney(sharedDebits, periodDebits);
        sharedCredits = addMoney(sharedCredits, periodCredits);
        sharedClosing = addMoney(sharedClosing, closingBalance);
        sharedTreasuryItems.push(item);
      } else {
        dshipOpening = addMoney(dshipOpening, openingBalance);
        dshipDebits = addMoney(dshipDebits, periodDebits);
        dshipCredits = addMoney(dshipCredits, periodCredits);
        dshipClosing = addMoney(dshipClosing, closingBalance);
        dealershipItems.push(item);
      }
    }

    const totalTreasury = addMoney(sharedClosing, dshipClosing);

    return {
      businessId: params.businessId ? String(params.businessId) : undefined,
      dealershipId: params.dealershipId ? String(params.dealershipId) : undefined,
      startDate: params.startDate,
      endDate: params.endDate,
      sharedTreasury: {
        accounts: sharedTreasuryItems,
        totalOpening: roundMoney(sharedOpening),
        totalDebits: roundMoney(sharedDebits),
        totalCredits: roundMoney(sharedCredits),
        totalClosing: roundMoney(sharedClosing),
      },
      dealershipTreasury: {
        accounts: dealershipItems,
        totalOpening: roundMoney(dshipOpening),
        totalDebits: roundMoney(dshipDebits),
        totalCredits: roundMoney(dshipCredits),
        totalClosing: roundMoney(dshipClosing),
      },
      summary: {
        totalCashOnHand: roundMoney(totalCash),
        totalBankBalances: roundMoney(totalBank),
        totalMfsBalances: roundMoney(totalMfs),
        totalTreasury: roundMoney(totalTreasury),
        sharedTreasuryClosing: roundMoney(sharedClosing),
        dealershipTreasuryClosing: roundMoney(dshipClosing),
      },
    };
  }

  /**
   * Persists an official Bank / Cash Reconciliation statement record.
   */
  static async recordBankReconciliation(params: {
    businessId: string | mongoose.Types.ObjectId;
    dealershipId?: string | mongoose.Types.ObjectId | null;
    accountId: string | mongoose.Types.ObjectId;
    statementDate: Date;
    statementEndingBalance: number;
    reconciledBy?: string | mongoose.Types.ObjectId;
    notes?: string;
  }): Promise<IBankReconciliation> {
    const acc = await Account.findById(params.accountId);
    if (!acc) throw new Error("Account not found for reconciliation");

    const stDate = new Date(params.statementDate);
    const statementEndingBalance = roundMoney(Number(params.statementEndingBalance));
    assertSafeMoney(statementEndingBalance);

    // Compute ledger closing balance as of statement date
    const recReport = await this.getCashBankReconciliation({
      businessId: params.businessId,
      dealershipId: params.dealershipId || undefined,
      accountId: params.accountId,
      endDate: stDate,
      statementEndingBalance,
    });

    const targetItem =
      recReport.sharedTreasury.accounts.find((a) => a.accountId === String(params.accountId)) ||
      recReport.dealershipTreasury.accounts.find((a) => a.accountId === String(params.accountId));

    const ledgerClosingBalance = targetItem ? targetItem.closingBalance : roundMoney(acc.balance || 0);
    const discrepancy = roundMoney(subtractMoney(statementEndingBalance, ledgerClosingBalance));
    const status = Math.abs(discrepancy) < 0.01 ? "RECONCILED" : "DISCREPANCY";

    const isShared = Boolean(
      (acc as any).isSharedTreasury || acc.code === "1010" || acc.code === "1020" || !acc.dealershipId
    );

    const doc = await BankReconciliation.create({
      businessId: params.businessId,
      dealershipId: isShared ? null : params.dealershipId || acc.dealershipId,
      accountId: acc._id,
      accountCode: acc.code,
      accountName: acc.name,
      isSharedTreasury: isShared,
      statementDate: stDate,
      statementEndingBalance,
      ledgerClosingBalance,
      discrepancy,
      status,
      reconciledBy: params.reconciledBy,
      notes: params.notes,
    });

    return doc;
  }
}
