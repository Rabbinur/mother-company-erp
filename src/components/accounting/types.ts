export type AccountingTab = "overview" | "chart" | "journals" | "periods" | "reports";
export type FinancialReportType =
  | "trial-balance"
  | "profit-loss"
  | "balance-sheet"
  | "ledger"
  | "ar-aging"
  | "ap-aging"
  | "cash-bank-reconciliation";

export interface AccountRow {
  _id: string;
  code: string;
  name: string;
  category: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE" | "CONTRA_REVENUE" | "CONTRA_ASSET";
  type?: string;
  subType?: string;
  normalBalance: "DEBIT" | "CREDIT";
  dealershipId?: string;
  businessId?: string;
  balance: number;
  currency?: string;
  status: "active" | "archived";
  isSystem?: boolean;
  description?: string;
}

export interface JournalLineRow {
  accountId: string;
  accountCode?: string;
  accountName?: string;
  dealershipId?: string;
  debit: number;
  credit: number;
  memo?: string;
  description?: string;
}

export interface JournalEntryRow {
  _id: string;
  journalNumber: string;
  entryNumber?: string;
  postingDate: string | Date;
  date?: string | Date;
  sourceType: string;
  sourceId?: string;
  referenceType?: string;
  referenceId?: string;
  narration: string;
  description?: string;
  lines: JournalLineRow[];
  debitsTotal: number;
  creditsTotal: number;
  status: "POSTED" | "VOIDED" | "REVERSED" | "REVERSING" | "DRAFT";
  isPosted: boolean;
  postedBy?: {
    name?: string;
    email?: string;
  };
  reversalOfJournalId?: string;
  reversedByJournalId?: string;
  createdAt?: string | Date;
}

export interface AccountingPeriodRow {
  _id: string;
  periodName: string;
  startDate: string | Date;
  endDate: string | Date;
  status: "OPEN" | "CLOSED";
  closedBy?: {
    name?: string;
    email?: string;
  };
  closedAt?: string | Date;
  closingNotes?: string;
  businessId?: string;
  dealershipId?: string;
}

export interface TrialBalanceData {
  accounts: Array<{
    code: string;
    name: string;
    category: string;
    normalBalance: string;
    debit: number;
    credit: number;
  }>;
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  asOfDate?: string | Date;
}

export interface ProfitLossData {
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
  startDate?: string | Date;
  endDate?: string | Date;
}

export interface BalanceSheetData {
  assets: {
    lines: Array<{ code: string; name: string; amount: number }>;
    totalAssets: number;
  };
  totalAssets: number;
  liabilities: {
    lines: Array<{ code: string; name: string; amount: number }>;
    totalLiabilities: number;
  };
  totalLiabilities: number;
  equity: {
    lines: Array<{ code: string; name: string; amount: number }>;
    totalEquity: number;
    retainedEarnings: number;
  };
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
  asOfDate?: string | Date;
}

export interface LedgerStatementData {
  account: {
    code: string;
    name: string;
    category: string;
    normalBalance: string;
  };
  openingBalance: number;
  lines: Array<{
    date: string | Date;
    journalNumber: string;
    sourceType: string;
    memo: string;
    debit: number;
    credit: number;
    runningBalance: number;
  }>;
  closingBalance: number;
}

export interface AccountingKpiMetrics {
  assets: number;
  liabilities: number;
  equity: number;
  revenue: number;
  expense: number;
  netProfit: number;
}

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
  oldestInvoiceDate?: string | Date | null;
  unpaidOrdersCount: number;
}

export interface ArAgingReportResult {
  asOfDate: string | Date;
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
  oldestInvoiceDate?: string | Date | null;
  payablesCount: number;
}

export interface ApAgingReportResult {
  asOfDate: string | Date;
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
  date: string | Date;
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
  startDate?: string | Date;
  endDate?: string | Date;
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
