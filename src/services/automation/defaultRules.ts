import type { RuleDefinition } from "./types";

export const DEFAULT_AUTOMATION_RULES: RuleDefinition[] = [
  // A. Inventory Intelligence
  {
    ruleKey: "LOW_STOCK", category: "INVENTORY", name: "Low Stock Alert",
    description: "Triggers when available stock reaches or falls below product minimum stock threshold.",
    defaultSeverity: "HIGH", defaultConfig: { fallbackMinStock: 10 }, isConfigured: true,
  },
  {
    ruleKey: "STOCKOUT", category: "INVENTORY", name: "Stockout Alert",
    description: "Triggers immediately when available inventory drops to zero.",
    defaultSeverity: "CRITICAL", defaultConfig: {}, isConfigured: true,
  },
  {
    ruleKey: "NEAR_EXPIRY", category: "INVENTORY", name: "Near-Expiry Stock Warning",
    description: "Identifies active batches expiring within configured warning days.",
    defaultSeverity: "HIGH", defaultConfig: { warningDays: 30 }, isConfigured: true,
  },
  {
    ruleKey: "EXPIRED_STOCK", category: "INVENTORY", name: "Expired Stock Alert",
    description: "Alerts when stock batches have crossed their expiration date.",
    defaultSeverity: "CRITICAL", defaultConfig: {}, isConfigured: true,
  },
  {
    ruleKey: "DAMAGED_QUARANTINED_STOCK", category: "INVENTORY", name: "Quarantined / Damaged Stock Alert",
    description: "Alerts inventory personnel of batches flagged in quarantined status.",
    defaultSeverity: "HIGH", defaultConfig: {}, isConfigured: true,
  },
  {
    ruleKey: "REORDER_RECOMMENDATION", category: "INVENTORY", name: "Reorder Recommendation",
    description: "Uses Demand Intelligence velocity to recommend stock replenishment.",
    defaultSeverity: "MEDIUM", defaultConfig: { maxDaysOfSupply: 7 }, isConfigured: true,
  },

  // B. Customer & Receivable Alerts
  {
    ruleKey: "CUSTOMER_OUTSTANDING_EXCEEDED", category: "CUSTOMER", name: "Customer High Outstanding Alert",
    description: "Triggers when customer outstanding balance exceeds configured monetary ceiling.",
    defaultSeverity: "HIGH", defaultConfig: { thresholdAmount: 200000 }, isConfigured: true,
  },
  {
    ruleKey: "CREDIT_UTILIZATION_WARNING", category: "CUSTOMER", name: "Credit Limit Utilization Warning",
    description: "Warns when customer credit utilization reaches or exceeds threshold percentage.",
    defaultSeverity: "HIGH", defaultConfig: { warningPercentage: 85 }, isConfigured: true,
  },
  {
    ruleKey: "CREDIT_LIMIT_EXCEEDED", category: "CUSTOMER", name: "Credit Limit Exceeded Alert",
    description: "Critical alert when customer balance strictly exceeds authorized credit limit.",
    defaultSeverity: "CRITICAL", defaultConfig: {}, isConfigured: true,
  },
  {
    ruleKey: "CUSTOMER_INACTIVE", category: "CUSTOMER", name: "Inactive Customer Dormancy Alert",
    description: "Detects customer accounts with no confirmed orders beyond dormancy threshold.",
    defaultSeverity: "MEDIUM", defaultConfig: { inactiveDays: 60 }, isConfigured: true,
  },
  {
    ruleKey: "RECEIVABLE_OVERDUE", category: "CUSTOMER", name: "Overdue Receivable Reminder",
    description: "Reminds staff of unpaid receivables strictly based on actual due dates.",
    defaultSeverity: "HIGH", defaultConfig: { gracePeriodDays: 0 }, isConfigured: true,
  },

  // C. Supplier & Procurement Alerts
  {
    ruleKey: "SUPPLIER_PAYMENT_DUE", category: "SUPPLIER", name: "Supplier Payable Due Reminder",
    description: "Alerts when verified supplier payables reach or pass invoice due date.",
    defaultSeverity: "HIGH", defaultConfig: { advanceWarningDays: 2 }, isConfigured: true,
  },
  {
    ruleKey: "PURCHASE_ORDER_PENDING", category: "SUPPLIER", name: "Pending Purchase Order Overdue",
    description: "Triggers when purchase order remains unfulfilled beyond configured duration.",
    defaultSeverity: "MEDIUM", defaultConfig: { pendingDays: 3 }, isConfigured: true,
  },
  {
    ruleKey: "PARTIAL_GRN_SHORTAGE", category: "SUPPLIER", name: "Challan Shortage / Partial GRN Alert",
    description: "Identifies Goods Receipt Notes with documented delivery shortages.",
    defaultSeverity: "HIGH", defaultConfig: {}, isConfigured: true,
  },
  {
    ruleKey: "SUPPLIER_SHORTAGE_RATE_EXCEEDED", category: "SUPPLIER", name: "High Supplier Shortage Rate Warning",
    description: "Warns when vendor historical shortage rate exceeds acceptable threshold.",
    defaultSeverity: "HIGH", defaultConfig: { maxShortageRate: 5 }, isConfigured: true,
  },
  {
    ruleKey: "SUPPLIER_PRICE_VARIATION", category: "SUPPLIER", name: "Purchase Price Variance Alert",
    description: "Detects GRN unit prices deviating significantly from historical procurement.",
    defaultSeverity: "MEDIUM", defaultConfig: { maxPriceVariancePercentage: 10 }, isConfigured: true,
  },

  // D. Sales & Delivery Alerts
  {
    ruleKey: "UNFULFILLED_ORDER_OVERDUE", category: "SALES", name: "Unfulfilled Sales Order Aging",
    description: "Alerts when confirmed sales orders remain unfulfilled beyond expected days.",
    defaultSeverity: "HIGH", defaultConfig: { maxAgingDays: 2 }, isConfigured: true,
  },
  {
    ruleKey: "DISPATCH_UNRESOLVED_STOPS", category: "SALES", name: "Dispatch Unresolved Delivery Stops",
    description: "Alerts when dispatch trips contain pending, failed, or rejected stops.",
    defaultSeverity: "HIGH", defaultConfig: {}, isConfigured: true,
  },
  {
    ruleKey: "DELIVERY_TRIP_UNRECONCILED", category: "SALES", name: "Unreconciled Delivery Trip Warning",
    description: "Warns when completed deliveries have not undergone post-trip reconciliation.",
    defaultSeverity: "MEDIUM", defaultConfig: { maxHoursBeforeWarning: 24 }, isConfigured: true,
  },
  {
    ruleKey: "DAY_END_DELIVERY_RECONCILIATION_PENDING", category: "SALES", name: "Day-End Stock Return Reconciliation Pending",
    description: "Alerts when returned or damaged delivery items have not been restocked/settled.",
    defaultSeverity: "HIGH", defaultConfig: {}, isConfigured: true,
  },
  {
    ruleKey: "SALES_RETURN_PENDING_INSPECTION", category: "SALES", name: "Sales Return Pending Inspection",
    description: "Notifies when customer return requests remain uninspected beyond SLA.",
    defaultSeverity: "HIGH", defaultConfig: { maxPendingHours: 48 }, isConfigured: true,
  },
  {
    ruleKey: "UNRESOLVED_CLAIM_OVERDUE", category: "SALES", name: "Overdue Reverse Logistics Claim",
    description: "Alerts when claims remain under review or unsettled beyond configured days.",
    defaultSeverity: "HIGH", defaultConfig: { maxPendingDays: 7 }, isConfigured: true,
  },

  // E. Financial & Accounting Alerts
  {
    ruleKey: "ACCOUNTING_PERIOD_CLOSING_SOON", category: "FINANCIAL", name: "Accounting Period Approaching Close",
    description: "Reminds finance team when open accounting periods are nearing end date.",
    defaultSeverity: "MEDIUM", defaultConfig: { warningDays: 3 }, isConfigured: true,
  },
  {
    ruleKey: "UNRECONCILED_BANK_DISCREPANCY", category: "FINANCIAL", name: "Bank Reconciliation Discrepancy Alert",
    description: "Critical alert when bank statement and general ledger balances do not match.",
    defaultSeverity: "CRITICAL", defaultConfig: {}, isConfigured: true,
  },
  {
    ruleKey: "OUTSTANDING_PAYABLE_RECEIVABLE_ATTENTION", category: "FINANCIAL", name: "High Value Balance Attention",
    description: "Flags customer or vendor accounts with critical outstanding balances.",
    defaultSeverity: "MEDIUM", defaultConfig: { thresholdAmount: 500000 }, isConfigured: true,
  },
  {
    ruleKey: "TRANSACTION_OUTCOME_FAILURE", category: "FINANCIAL", name: "Transaction Outcome Failure Review",
    description: "Critical alert for aborted or reconciliation-required database operations.",
    defaultSeverity: "CRITICAL", defaultConfig: {}, isConfigured: true,
  },

  // F. Operational Reminders
  {
    ruleKey: "EMPLOYEE_ATTENDANCE_RECONCILIATION", category: "OPERATIONAL", name: "Employee Attendance Reconciliation",
    description: "Reconciles staff daily attendance and timesheets.",
    defaultSeverity: "LOW", defaultConfig: {}, isConfigured: false,
    unconfiguredReason: "No employee attendance or work-log model exists in the database schema.",
  },
  {
    ruleKey: "DELIVERY_EXPENSE_SETTLEMENT_PENDING", category: "OPERATIONAL", name: "Pending Delivery Expense Settlement",
    description: "Alerts when operational delivery expenses are pending claim approval.",
    defaultSeverity: "MEDIUM", defaultConfig: {}, isConfigured: true,
  },
  {
    ruleKey: "UNRESOLVED_SUPPORT_TICKET", category: "OPERATIONAL", name: "Unresolved Support Ticket Alert",
    description: "Notifies management of customer support tickets remaining in pending status.",
    defaultSeverity: "HIGH", defaultConfig: {}, isConfigured: true,
  },
  {
    ruleKey: "MANUAL_BUSINESS_TASK", category: "OPERATIONAL", name: "Manual Business Task Reminder",
    description: "Reminds team members of important business tasks requiring manual action.",
    defaultSeverity: "LOW", defaultConfig: {}, isConfigured: true,
  },
];
