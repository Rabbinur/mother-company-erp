/**
 * Phase 2B Migration Constants
 * Project: Dealership Management (Mother Company ERP)
 */

export const ERP_SYSTEM_NAME = "Dealership Management" as const;

export const MIGRATION_LOCK_KEY = "SYSTEM_MAINTENANCE_MIGRATION_LOCK" as const;

export const MIGRATION_MODES = ["inspection", "dry-run", "apply"] as const;
export type MigrationMode = (typeof MIGRATION_MODES)[number];

/**
 * All 16 collections in scope for Phase 2 tenancy partitioning
 */
export const TARGET_MIGRATION_COLLECTIONS = [
  "orders",
  "purchases",
  "payments",
  "inventorybalances",
  "stockmovements",
  "stockreservations",
  "customers",
  "customerdealershipaccounts",
  "accounts",
  "journalentries",
  "expenses",
  "salesreturns",
  "purchasereturns",
  "vendors",
  "products",
  "productvariants",
] as const;

export type TargetCollectionName = (typeof TARGET_MIGRATION_COLLECTIONS)[number];

/**
 * All 33 Mongoose models audited in repository
 */
export const ALL_33_MODELS = [
  "Account",
  "AuditLog",
  "Brand",
  "Business",
  "Category",
  "Customer",
  "CustomerDealershipAccount",
  "Dealership",
  "DealershipMembership",
  "Expense",
  "ExpenseCategory",
  "InventoryBalance",
  "JournalEntry",
  "Notification",
  "Order",
  "Payment",
  "PriceHistory",
  "PrincipalCompany",
  "Product",
  "ProductVariant",
  "Purchase",
  "PurchaseReturn",
  "RateLimit",
  "Role",
  "SalesReturn",
  "StockMovement",
  "StockReservation",
  "SupportTicket",
  "SystemSetting",
  "TransactionOutcome",
  "User",
  "Vendor",
  "Warehouse",
] as const;
