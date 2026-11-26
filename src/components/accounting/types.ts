export type AccountingTab = "overview" | "chart" | "journals" | "periods" | "reports";
export type FinancialReportType = "trial-balance" | "profit-loss" | "balance-sheet" | "ledger";

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
