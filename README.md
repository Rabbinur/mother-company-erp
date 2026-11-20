# Mother Company ERP & Business Management System

A production-grade, enterprise-ready **Mother Company ERP & Business Management System** engineered with **Next.js 16 (App Router)**, **React 19**, **TypeScript**, **Tailwind CSS v4**, and **MongoDB Atlas** with **Mongoose**.

Designed as a **Modular Monolith** to power high-concurrency manufacturing and distribution operations. It incorporates a Central Warehouse with multi-warehouse scalability, strict multi-tier Role-Based Access Control (RBAC), 3-level pricing architecture with confidential purchase price protection, atomic inventory reservations, double-entry financial accounting, and zero-trust REST APIs for external Field Sales synchronization.

---

## 📑 Table of Contents
1. [Core Architectural Highlights](#-core-architectural-highlights)
2. [Technology Stack](#-technology-stack)
3. [System Architecture & Module Layout](#-system-architecture--module-layout)
4. [Role-Based Access Control (RBAC)](#-role-based-access-control-rbac)
5. [3-Level Pricing Architecture](#-3-level-pricing-architecture)
6. [Central Warehouse & Inventory Accounting](#-central-warehouse--inventory-accounting)
7. [Sales Order & Fulfillment Engine](#-sales-order--fulfillment-engine)
8. [Double-Entry Accounting & Financial Reports](#-double-entry-accounting--financial-reports)
9. [Field Sales Integration API Specification](#-field-sales-integration-api-specification)
10. [Setup & Installation Guide](#-setup--installation-guide)
11. [Database Seeding](#-database-seeding)
12. [Automated Test Suite](#-automated-test-suite)

---

## 🚀 Core Architectural Highlights

- **Atomic Stock Reservations**: Concurrency-safe stock reservation using atomic MongoDB conditional operators (`$expr: { $gte: [{ $subtract: ["$onHand", "$reserved"] }, qty] }`). Zero overselling and zero race conditions under concurrent peak order traffic.
- **Strict 3-Level Pricing with Data Confidentiality**: Every sellable product variant maintains **Purchase Price (Acquisition Cost)**, **Customer Price (Default Wholesale to Retailers)**, and **Retail Price (Suggested End-Consumer MSRP)**. Purchase Price is strictly redacted across all APIs and UI views unless the authenticated user possesses the `pricing.view_purchase_price` permission.
- **Physical Goods Receipt Integrity**: Creating a Purchase Order draft never inflates inventory. Stock increases only when physical receiving is verified by the warehouse manager, simultaneously booking accounts payable and inventory assets.
- **Double-Entry General Ledger**: Enforces strict mathematical balance (`Total Debits === Total Credits`) for every posted financial transaction across Sales, Purchases, Customer Receipts, Vendor Disbursements, Returns, and Operating Expenses.
- **Field Sales Integration Shield**: Dedicated server-to-server API endpoints (`/api/v1/integrations/field-sales/*`) authenticated via HMAC SHA-256 API Key & Secret with Idempotency Key validation. Seamlessly invokes the same core `OrderService` and `InventoryService` while guaranteeing zero leakage of company acquisition costs.

---

## 🛠 Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Next.js 16 App Router, Tailwind CSS v4, Lucide React, Recharts |
| **Backend** | Next.js Route Handlers (Node.js runtime), Mongoose 9, Zod validation |
| **Database** | MongoDB Atlas / Local MongoDB (Replica Set compatible) |
| **Security** | Argon2id / bcryptjs, JWT in HttpOnly Cookie, HMAC API Key/Secret, RBAC Matrix |
| **Data Flow** | TanStack Table, Recharts, Server-Side Pagination & Filtering, CSV/Excel Export |
| **Testing** | Node.js Test Runner (`node:test`, `node:assert/strict`) |

---

## 🏛 System Architecture & Module Layout

The codebase strictly adheres to the **Modular Monolith** pattern:

```
mother-company-erp/
├── src/
│   ├── app/                                 # Next.js 16 App Router
│   │   ├── (dashboard)/                     # Protected ERP UI Routes
│   │   │   ├── dashboard/page.tsx           # Real-time Executive KPIs & Analytics
│   │   │   ├── products/page.tsx            # Product catalog & variant matrix
│   │   │   ├── inventory/page.tsx           # Warehouse stock ledger & adjustments
│   │   │   ├── purchases/page.tsx           # Vendor purchase orders & stock receiving
│   │   │   ├── orders/page.tsx              # Sales orders, fulfillment, tax invoices
│   │   │   ├── customers/page.tsx           # Retailers & customer receivable ledgers
│   │   │   ├── vendors/page.tsx             # Supplier directory & payable balances
│   │   │   ├── returns/page.tsx             # Sales & purchase return inspections
│   │   │   ├── payments/page.tsx            # Inbound/outbound payment vouchers
│   │   │   ├── expenses/page.tsx            # Operating expense management
│   │   │   ├── accounts/page.tsx            # Chart of accounts & journal entries
│   │   │   ├── reports/page.tsx             # P&L statement, Trial Balance, margins
│   │   │   ├── users/page.tsx               # User management & RBAC matrix
│   │   │   ├── pricing/page.tsx             # 3-level price governance & audits
│   │   │   ├── categories/page.tsx          # Categories & brands
│   │   │   └── audit-logs/page.tsx          # Immutable activity audit trail
│   │   ├── login/page.tsx                   # Enterprise authentication
│   │   └── api/v1/                          # 45+ Production REST API Endpoints
│   ├── components/                          # Reusable UI & Layout Components
│   │   ├── layout/                          # AppShell, Sidebar, Header
│   │   └── ui/                              # Enterprise tables, badges, modals
│   ├── models/                              # 25 Normalized Mongoose Schemas
│   │   ├── User.ts, Role.ts                 # RBAC & authentication
│   │   ├── Product.ts, ProductVariant.ts    # 3-level pricing & variant matrix
│   │   ├── Warehouse.ts, InventoryBalance.ts# Multi-warehouse inventory
│   │   ├── StockMovement.ts, Reservation.ts # Concurrency & immutable audit ledger
│   │   ├── Purchase.ts, Vendor.ts           # Procurement & payables
│   │   ├── Order.ts, Customer.ts            # Sales, receivables, fulfillment
│   │   ├── Account.ts, JournalEntry.ts      # Double-entry general ledger
│   │   ├── Payment.ts, Expense.ts           # Cash flow & operating expenses
│   │   ├── SalesReturn.ts, PurchaseReturn.ts# Returns with quality inspection
│   │   └── AuditLog.ts, SystemSetting.ts    # Compliance & audit
│   ├── services/                            # Pure Business Logic Engine
│   │   ├── InventoryService.ts              # Atomic reservation & stock movements
│   │   ├── PricingService.ts                # 3-level price calculation & sanitization
│   │   ├── AccountingService.ts             # Balanced journal entry posting & P&L
│   │   ├── OrderService.ts                  # Order creation, reservation, fulfillment
│   │   ├── PurchaseService.ts               # Purchase lifecycle & physical receiving
│   │   ├── SalesReturnService.ts            # Return inspection & restocking
│   │   ├── PurchaseReturnService.ts         # Vendor return stock deduction
│   │   ├── PaymentService.ts                # Allocation to invoices & vouchers
│   │   ├── ExpenseService.ts                # Operating expense ledger
│   │   ├── ReportService.ts                 # Real-time aggregated financial KPIs
│   │   ├── AuditService.ts                  # Central audit logger
│   │   └── FieldSalesService.ts             # Field Sales synchronization engine
│   └── lib/                                 # Shared Infrastructure
│       ├── db/connect.ts                    # Cached Mongoose connection pool
│       ├── auth/session.ts, jwt.ts          # Session resolution & JWT
│       ├── auth/permissions.ts              # RBAC definitions & hierarchy
│       ├── security/field-sales-auth.ts     # HMAC API Key/Secret authenticator
│       └── utils/api-response.ts            # Standardized API response wrappers
├── scripts/
│   └── seed.mjs                             # Comprehensive DB seeder
└── tests/
    └── erp-core.test.mjs                    # Unit tests for core financial & inventory logic
```

---

## 🔐 Role-Based Access Control (RBAC)

The system ships with 8 default pre-configured roles and allows Super Admins to define unlimited Custom Roles:

1. **Super Admin**: Complete unrestricted system authority.
2. **Admin**: Operational management across all modules except system-level administrative overrides.
3. **Manager**: Broad operational visibility, order approvals, and management reporting.
4. **Accountant**: Financial ledger, Chart of Accounts, payments, expenses, P&L, and Trial Balance.
5. **Purchase Manager**: Procurement, vendor management, purchase orders, and receiving.
6. **Inventory Manager**: Warehouse operations, physical stock receiving, stock counts, and adjustments.
7. **Sales Manager**: Sales orders, retailer relationships, credit limits, and returns approval.
8. **Sales Staff**: Order creation, catalog lookup, customer registration. Strictly blocked from viewing Purchase Prices or modifying inventory ledgers.

### Granular Permission Keys:
- `products.view`, `products.create`, `products.update`, `products.delete`
- `pricing.view_purchase_price` *(Strictly protects confidential acquisition cost)*
- `pricing.update`
- `inventory.view`, `inventory.adjust`, `inventory.transfer`
- `purchases.view`, `purchases.create`, `purchases.receive`, `purchases.approve`
- `orders.view`, `orders.create`, `orders.confirm`, `orders.fulfill`, `orders.cancel`
- `customers.view`, `customers.manage`
- `vendors.view`, `vendors.manage`
- `payments.view`, `payments.create`
- `accounts.view`, `accounts.manage`
- `reports.view`, `reports.financial`
- `users.manage`, `roles.manage`, `settings.manage`, `integrations.manage`

---

## 🏷 3-Level Pricing Architecture

Every product variant enforces three distinct price tiers:

$$\text{Purchase Price} \le \text{Customer Price} < \text{Retail Price}$$

1. **Purchase Price (৳)**: Company's direct cost of acquisition. Highly confidential.
2. **Customer Price (৳)**: Default wholesale price charged to retailers/distributors.
3. **Retail Price (৳)**: Suggested Retail Price (MSRP) for the end consumer.

### Retailer Profitability Formulas:
$$\text{Retailer Profit} = \text{Retail Price} - \text{Customer Price}$$
$$\text{Retailer Margin (\%)} = \frac{\text{Retail Price} - \text{Customer Price}}{\text{Retail Price}} \times 100$$

### Company Gross Margin Formula:
$$\text{Company Gross Profit} = \text{Customer Price} - \text{Purchase Price}$$
$$\text{Company Gross Margin (\%)} = \frac{\text{Customer Price} - \text{Purchase Price}}{\text{Customer Price}} \times 100$$

> **Security Guarantee**: Non-authorized roles calling `/api/v1/products` or `/api/v1/pricing` receive an object where `purchasePrice` is completely stripped (`undefined`). Historical orders capture an immutable snapshot of prices at the moment of confirmation; price catalog updates never alter existing invoices.

---

## 🏭 Central Warehouse & Inventory Accounting

The system initializes with a **Central Warehouse** (`code: WH-CENTRAL-01`) while structuring all inventory records with a `warehouseId` foreign key to support seamless multi-warehouse expansion.

### Stock Invariants:
$$\text{Available Stock} = \text{On-Hand Stock} - \text{Reserved Stock}$$
$$\text{On-Hand Stock} \ge \text{Reserved Stock} \ge 0$$

- **Physical Receiving Workflow**: Creating a Purchase Order sets status to `draft` or `ordered`. Stock on-hand **only increments** when warehouse staff submits `/api/v1/purchases/:id/receive`. Supports partial or full receiving.
- **Atomic Reservation Engine**: When an order is confirmed, the system executes an atomic MongoDB findOneAndUpdate with `$expr` to guarantee available stock exists before bumping `reserved`:
  ```typescript
  // Concurrency-safe atomic reservation
  InventoryBalance.findOneAndUpdate(
    {
      productId,
      variantId,
      warehouseId,
      $expr: { $gte: [{ $subtract: ["$onHand", "$reserved"] }, quantity] }
    },
    { $inc: { reserved: quantity } }
  );
  ```
- **Fulfillment**: When orders are marked as fulfilled (`status: fulfilled`), stock is permanently deducted from both `onHand` and `reserved`:
  ```typescript
  { $inc: { onHand: -quantity, reserved: -quantity } }
  ```
- **Stock Movement Ledger**: Every stock change produces an immutable `StockMovement` entry capturing movement type (`purchase_receipt`, `order_reserve`, `order_fulfill`, `order_cancel`, `adjustment_add`, `adjustment_deduct`, `damage_writeoff`, `sales_return`, `purchase_return`), before/after quantities, batch numbers, and user ID.

---

## 🛒 Sales Order & Fulfillment Engine

```
[Quotation/Pending] ──(Confirm)──> [Confirmed: Stock Reserved Atomically]
         │                                       │
         │                                  (Fulfill)
     (Cancel)                                    │
         │                                       ▼
         ▼                          [Fulfilled: Stock Deducted]
  [No Stock Impact]                 ├── Updates Customer Receivable
                                    └── Double-Entry: Dr AR, Cr Revenue
                                                      Dr COGS, Cr Inventory
```

1. **Draft / Pending**: Quotation stage. Does not hold stock.
2. **Confirmed**: Triggers atomic stock reservation. Available stock decreases immediately.
3. **Fulfilled**: Warehouse dispatches physical items. Stock on-hand and reserved are decremented. Generates customer accounts receivable ledger entry and double-entry general ledger voucher.
4. **Cancelled**: If previously confirmed, all reserved stock is atomically restored to available inventory.

---

## 📊 Double-Entry Accounting & Financial Reports

Automated double-entry bookkeeping follows the standard accounting equation:

$$\text{Assets} = \text{Liabilities} + \text{Equity}$$

For every financial journal entry:
$$\sum \text{Debits} \equiv \sum \text{Credits}$$

### Automatic Journal Postings:
- **Goods Receipt from Vendor**:
  - `Debit`: Inventory Asset (Account #1200)
  - `Credit`: Accounts Payable (Account #2000)
- **Order Fulfillment to Retailer**:
  - `Debit`: Accounts Receivable (Account #1100)
  - `Credit`: Sales Revenue (Account #4000)
  - *Cost Entry*:
  - `Debit`: Cost of Goods Sold (Account #5000)
  - `Credit`: Inventory Asset (Account #1200)
- **Customer Payment Received**:
  - `Debit`: Cash / Bank Account (Account #1000)
  - `Credit`: Accounts Receivable (Account #1100)
- **Operating Expense Incurred**:
  - `Debit`: Operating Expense Category (Account #6000+)
  - `Credit`: Cash / Bank Account (Account #1000)

### Financial Reports Available:
- **Profit and Loss Statement (P&L)**:
  - $\text{Gross Profit} = \text{Revenue} - \text{COGS}$
  - $\text{Operating Profit} = \text{Gross Profit} - \text{Operating Expenses}$
  - $\text{Net Profit} = \text{Operating Profit} - \text{Taxes}$
- **Trial Balance**: Validates debits match credits across all chart of account classifications.
- **Customer & Vendor Statements**: Complete transactional breakdown with running balances.

---

## 🔌 Field Sales Integration API Specification

External applications (such as mobile Field Sales / DSR tablets) communicate via dedicated server-to-server endpoints under `/api/v1/integrations/field-sales/*`.

### Authentication Headers:
- `X-API-Key`: Pre-shared integration access key.
- `X-API-Secret`: Pre-shared integration secret.
- `X-Idempotency-Key`: Unique UUID per mobile order attempt to prevent duplicate orders during poor network conditions.

### Available Integration Endpoints:

#### 1. Catalog Sync
`GET /api/v1/integrations/field-sales/products?page=1&limit=50`
- Returns active products, categories, variants, customer wholesale price, and suggested retail price.
- **Strictly guarantees that `purchasePrice` is never transmitted.**

#### 2. Real-Time Stock Availability
`GET /api/v1/integrations/field-sales/inventory`
- Returns available inventory (`onHand - reserved`) per product variant for the Central Warehouse.

#### 3. Submit Mobile Sales Order
`POST /api/v1/integrations/field-sales/orders`

**Request Payload:**
```json
{
  "customerId": "673f8a9e0123456789abcdef",
  "items": [
    {
      "productId": "673f8a9e0123456789abc001",
      "variantId": "673f8a9e0123456789abc002",
      "quantity": 10
    }
  ],
  "shippingAddress": "Gulshan-2, Dhaka",
  "notes": "Field Sales sync order"
}
```

**Response Payload (`201 Created`):**
```json
{
  "success": true,
  "data": {
    "_id": "673f8a9e0123456789abc099",
    "orderNumber": "ORD-2026-00042",
    "status": "confirmed",
    "subtotal": 800.00,
    "total": 800.00,
    "paidAmount": 0.00,
    "dueAmount": 800.00,
    "items": [
      {
        "productName": "Super Detergent Powder",
        "variantSku": "SDP-1KG",
        "quantity": 10,
        "unitPrice": 80.00,
        "retailPrice": 100.00,
        "total": 800.00
      }
    ]
  },
  "message": "Order created and stock reserved successfully via Field Sales sync"
}
```

---

## 📦 Setup & Installation Guide

### Prerequisites
- Node.js 18.x or newer (Tested on Node.js 22.x & 26.x)
- MongoDB Atlas connection string or local MongoDB instance

### 1. Clone & Configure Environment
Create `.env` in the root directory:
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/mother_company_erp
JWT_SECRET=super-secret-jwt-token-key-2026-production
JWT_EXPIRES_IN=7d
FIELD_SALES_API_KEY=field_sales_secure_key_2026
FIELD_SALES_API_SECRET=field_sales_secure_secret_2026
NEXT_PUBLIC_APP_NAME="Mother Company ERP"
NEXT_PUBLIC_DEFAULT_CURRENCY="BDT"
NEXT_PUBLIC_CURRENCY_SYMBOL="৳"
```

### 2. Install Dependencies & Build
```bash
# Run production webpack build
npm run build
```

### 3. Database Seeding
Execute the automated seeder to initialize the Central Warehouse, standard Chart of Accounts, system roles, sample categories, brands, products with 3-level pricing, and demo transactions:
```bash
node scripts/seed.mjs
```

### Default Credentials:
- **Email**: `admin@mothercompany.com`
- **Password**: `Admin@123456`
- **Role**: Super Admin

### 4. Start Production Server
```bash
npm start
```
The application will be live at `http://localhost:3000`.

---

## 🧪 Automated Test Suite

A comprehensive test suite verifies core business logic, including 3-level price margins, confidential data redaction, available inventory calculations, double-entry mathematical balance, and profit computations:

```bash
npm test
```

### Test Suite Coverage:
```
✔ Pricing calculation - correct retailer margin and company gross profit (0.3ms)
✔ Confidentiality - purchasePrice sanitization for unauthorized roles (0.2ms)
✔ Available stock calculation (onHand - reserved) (0.1ms)
✔ Negative stock prevention - rejection of over-reservation (0.2ms)
✔ Order cancellation restores available stock (0.2ms)
✔ Order fulfillment permanently deducts onHand and reserved stock (0.1ms)
✔ Accounting balance invariant - debits must equal credits (0.2ms)
✔ Profit and Loss formula - Gross Profit and Net Profit (0.1ms)
✔ Idempotency protection simulation for field sales orders (0.2ms)

ℹ tests 9
ℹ suites 0
ℹ pass 9
ℹ fail 0
```
