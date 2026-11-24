export const PERMISSIONS = {
  // Products
  PRODUCTS_VIEW: "products.view",
  PRODUCTS_CREATE: "products.create",
  PRODUCTS_UPDATE: "products.update",
  PRODUCTS_DELETE: "products.delete",

  // Pricing
  PRICING_VIEW_PURCHASE_PRICE: "pricing.view_purchase_price",
  PRICING_UPDATE: "pricing.update",

  // Inventory & Warehouse
  INVENTORY_VIEW: "inventory.view",
  INVENTORY_ADJUST: "inventory.adjust",
  INVENTORY_DAMAGE: "inventory.damage",

  // Vendors & Purchases
  VENDORS_VIEW: "vendors.view",
  VENDORS_CREATE: "vendors.create",
  VENDORS_UPDATE: "vendors.update",
  PURCHASES_VIEW: "purchases.view",
  PURCHASES_CREATE: "purchases.create",
  PURCHASES_APPROVE: "purchases.approve",
  PURCHASES_RECEIVE: "purchases.receive",
  PURCHASES_RETURN: "purchases.return",

  // Customers & Sales Orders
  CUSTOMERS_VIEW: "customers.view",
  CUSTOMERS_CREATE: "customers.create",
  CUSTOMERS_UPDATE: "customers.update",
  ORDERS_VIEW: "orders.view",
  ORDERS_CREATE: "orders.create",
  ORDERS_CONFIRM: "orders.confirm",
  ORDERS_FULFILL: "orders.fulfill",
  ORDERS_CANCEL: "orders.cancel",
  ORDERS_RETURN: "orders.return",

  // Delivery & Dispatch
  DISPATCH_VIEW: "dispatch.view",
  DISPATCH_CREATE: "dispatch.create",
  DISPATCH_ASSIGN: "dispatch.assign",
  DISPATCH_LOAD: "dispatch.load",
  DISPATCH_DELIVER: "dispatch.deliver",
  DISPATCH_RETURN: "dispatch.return",
  DISPATCH_CLOSE: "dispatch.close",

  // Financial & Accounting
  PAYMENTS_VIEW: "payments.view",
  PAYMENTS_CREATE: "payments.create",
  PAYMENTS_VERIFY: "payments.verify",
  EXPENSES_VIEW: "expenses.view",
  EXPENSES_CREATE: "expenses.create",
  EXPENSES_APPROVE: "expenses.approve",
  ACCOUNTS_VIEW: "accounts.view",
  ACCOUNTS_MANAGE: "accounts.manage",

  // Analytics & Reports
  REPORTS_VIEW: "reports.view",
  REPORTS_FINANCIAL: "reports.financial",

  // Administration & Security
  USERS_MANAGE: "users.manage",
  ROLES_MANAGE: "roles.manage",
  SETTINGS_MANAGE: "settings.manage",
  INTEGRATIONS_MANAGE: "integrations.manage",
  AUDIT_VIEW: "audit.view",

  // Business Foundation & Organization
  BUSINESS_VIEW: "business.view",
  BUSINESS_MANAGE: "business.manage",
  PRINCIPAL_COMPANIES_VIEW: "principal_companies.view",
  PRINCIPAL_COMPANIES_MANAGE: "principal_companies.manage",
  DEALERSHIPS_VIEW: "dealerships.view",
  DEALERSHIPS_MANAGE: "dealerships.manage",
  WAREHOUSES_VIEW: "warehouses.view",
  WAREHOUSES_MANAGE: "warehouses.manage",
  MEMBERSHIPS_VIEW: "memberships.view",
  MEMBERSHIPS_MANAGE: "memberships.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  super_admin: [...ALL_PERMISSIONS],
  owner: [...ALL_PERMISSIONS],
  admin: [...ALL_PERMISSIONS],
  manager: [
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.PRODUCTS_CREATE,
    PERMISSIONS.PRODUCTS_UPDATE,
    PERMISSIONS.PRICING_VIEW_PURCHASE_PRICE,
    PERMISSIONS.PRICING_UPDATE,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_ADJUST,
    PERMISSIONS.VENDORS_VIEW,
    PERMISSIONS.PURCHASES_VIEW,
    PERMISSIONS.PURCHASES_CREATE,
    PERMISSIONS.PURCHASES_APPROVE,
    PERMISSIONS.PURCHASES_RECEIVE,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_CREATE,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_CREATE,
    PERMISSIONS.ORDERS_CONFIRM,
    PERMISSIONS.ORDERS_FULFILL,
    PERMISSIONS.ORDERS_CANCEL,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.PAYMENTS_CREATE,
    PERMISSIONS.EXPENSES_VIEW,
    PERMISSIONS.EXPENSES_CREATE,
    PERMISSIONS.REPORTS_VIEW,
  ],
  accountant: [
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.PRICING_VIEW_PURCHASE_PRICE,
    PERMISSIONS.PURCHASES_VIEW,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.PAYMENTS_CREATE,
    PERMISSIONS.PAYMENTS_VERIFY,
    PERMISSIONS.EXPENSES_VIEW,
    PERMISSIONS.EXPENSES_CREATE,
    PERMISSIONS.EXPENSES_APPROVE,
    PERMISSIONS.ACCOUNTS_VIEW,
    PERMISSIONS.ACCOUNTS_MANAGE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_FINANCIAL,
  ],
  purchase_manager: [
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.PRICING_VIEW_PURCHASE_PRICE,
    PERMISSIONS.PRICING_UPDATE,
    PERMISSIONS.VENDORS_VIEW,
    PERMISSIONS.VENDORS_CREATE,
    PERMISSIONS.VENDORS_UPDATE,
    PERMISSIONS.PURCHASES_VIEW,
    PERMISSIONS.PURCHASES_CREATE,
    PERMISSIONS.PURCHASES_APPROVE,
    PERMISSIONS.PURCHASES_RECEIVE,
    PERMISSIONS.PURCHASES_RETURN,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.REPORTS_VIEW,
  ],
  inventory_manager: [
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_ADJUST,
    PERMISSIONS.INVENTORY_DAMAGE,
    PERMISSIONS.PURCHASES_VIEW,
    PERMISSIONS.PURCHASES_RECEIVE,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_FULFILL,
    PERMISSIONS.REPORTS_VIEW,
  ],
  sales_manager: [
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_CREATE,
    PERMISSIONS.CUSTOMERS_UPDATE,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_CREATE,
    PERMISSIONS.ORDERS_CONFIRM,
    PERMISSIONS.ORDERS_FULFILL,
    PERMISSIONS.ORDERS_CANCEL,
    PERMISSIONS.ORDERS_RETURN,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.REPORTS_VIEW,
  ],
  sales_staff: [
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_CREATE,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_CREATE,
  ],
  delivery_staff: [
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.DISPATCH_VIEW,
    PERMISSIONS.DISPATCH_DELIVER,
    PERMISSIONS.DISPATCH_RETURN,
  ],
};

export function hasPermission(
  userRole: string,
  userPermissions: string[] | undefined,
  requiredPermission: Permission
): boolean {
  if (userRole === "super_admin") return true;

  // Custom assigned permissions take priority
  if (userPermissions && userPermissions.includes(requiredPermission)) {
    return true;
  }

  // Fallback to role template default
  const defaultRolePerms = DEFAULT_ROLE_PERMISSIONS[userRole] || [];
  return defaultRolePerms.includes(requiredPermission);
}
