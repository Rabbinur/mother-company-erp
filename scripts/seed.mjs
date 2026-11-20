/**
 * Mother Company ERP - Production Seed Script
 * Pre-populates default roles, admin, warehouse, chart of accounts, categories,
 * brands, sample products with 3-level prices, vendors, and retailers.
 */

import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// Read MongoDB URI from environment or fallback
const uri =
  process.env.MONGODB_URI ||
  process.env.MONGODB_URL ||
  "mongodb://127.0.0.1:27017/mother_company_erp";

async function main() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });
  console.log("Connected successfully!");

  const db = mongoose.connection.db;

  // 1. Roles
  console.log("Seeding default roles...");
  const rolesCollection = db.collection("roles");
  const defaultRoles = [
    {
      name: "Super Admin",
      code: "super_admin",
      description: "Full system control",
      isSystem: true,
      permissions: ["*"],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      name: "Purchase Manager",
      code: "purchase_manager",
      description: "Purchases and vendor management",
      isSystem: true,
      permissions: [
        "products.view",
        "pricing.view_purchase_price",
        "pricing.update",
        "vendors.view",
        "vendors.create",
        "vendors.update",
        "purchases.view",
        "purchases.create",
        "purchases.approve",
        "purchases.receive",
        "purchases.return",
        "inventory.view",
        "reports.view",
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      name: "Sales Manager",
      code: "sales_manager",
      description: "Sales and customer distribution",
      isSystem: true,
      permissions: [
        "products.view",
        "customers.view",
        "customers.create",
        "customers.update",
        "orders.view",
        "orders.create",
        "orders.confirm",
        "orders.fulfill",
        "orders.cancel",
        "orders.return",
        "payments.view",
        "reports.view",
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      name: "Accountant",
      code: "accountant",
      description: "Financials, ledger and payments",
      isSystem: true,
      permissions: [
        "products.view",
        "pricing.view_purchase_price",
        "purchases.view",
        "orders.view",
        "payments.view",
        "payments.create",
        "payments.verify",
        "expenses.view",
        "expenses.create",
        "expenses.approve",
        "accounts.view",
        "accounts.manage",
        "reports.view",
        "reports.financial",
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      name: "Sales Staff",
      code: "sales_staff",
      description: "Field and order creation staff (no purchase price access)",
      isSystem: true,
      permissions: [
        "products.view",
        "customers.view",
        "customers.create",
        "orders.view",
        "orders.create",
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  for (const r of defaultRoles) {
    await rolesCollection.updateOne(
      { code: r.code },
      { $set: r },
      { upsert: true }
    );
  }

  // 2. Central Warehouse
  console.log("Seeding Central Warehouse...");
  const whCollection = db.collection("warehouses");
  const whResult = await whCollection.findOneAndUpdate(
    { code: "WH-CENTRAL-01" },
    {
      $set: {
        name: "Central Warehouse Dhaka",
        code: "WH-CENTRAL-01",
        address: "Plot 42, Tejgaon I/A, Dhaka 1208, Bangladesh",
        isCentral: true,
        status: "active",
        contactPerson: "Warehouse Supervisor",
        phone: "+8801711223344",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
    { upsert: true, returnDocument: "after" }
  );
  const warehouseId = whResult?._id || (await whCollection.findOne({ code: "WH-CENTRAL-01" }))._id;

  // 3. Super Admin & Staff Users
  console.log("Seeding Users...");
  const usersCollection = db.collection("users");
  const passwordHash = await bcrypt.hash("Admin@123456", 10);
  const staffHash = await bcrypt.hash("Staff@123456", 10);

  await usersCollection.updateOne(
    { email: "admin@mothercompany.com" },
    {
      $set: {
        name: "Super Administrator",
        email: "admin@mothercompany.com",
        passwordHash,
        role: "super_admin",
        customPermissions: [],
        status: "active",
        phone: "+8801700000001",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );

  await usersCollection.updateOne(
    { email: "sales@mothercompany.com" },
    {
      $set: {
        name: "Rahim Sales Rep",
        email: "sales@mothercompany.com",
        passwordHash: staffHash,
        role: "sales_staff",
        customPermissions: [],
        status: "active",
        phone: "+8801700000002",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );

  // 4. Chart of Accounts
  console.log("Seeding Chart of Accounts...");
  const accountsCollection = db.collection("accounts");
  const defaultAccounts = [
    { code: "1010", name: "Cash on Hand", type: "asset", subType: "cash", balance: 50000, currency: "BDT", isSystem: true, status: "active" },
    { code: "1020", name: "Main Bank Account", type: "asset", subType: "bank", balance: 250000, currency: "BDT", isSystem: true, status: "active" },
    { code: "1031", name: "bKash Merchant Account", type: "asset", subType: "mfs_bkash", balance: 75000, currency: "BDT", isSystem: true, status: "active" },
    { code: "1100", name: "Accounts Receivable", type: "asset", subType: "accounts_receivable", balance: 0, currency: "BDT", isSystem: true, status: "active" },
    { code: "1200", name: "Inventory Asset", type: "asset", subType: "inventory_asset", balance: 0, currency: "BDT", isSystem: true, status: "active" },
    { code: "2100", name: "Accounts Payable", type: "liability", subType: "accounts_payable", balance: 0, currency: "BDT", isSystem: true, status: "active" },
    { code: "3100", name: "Owner / Company Capital", type: "equity", subType: "owner_equity", balance: 375000, currency: "BDT", isSystem: true, status: "active" },
    { code: "4100", name: "Sales Revenue", type: "revenue", subType: "sales_revenue", balance: 0, currency: "BDT", isSystem: true, status: "active" },
    { code: "5100", name: "Cost of Goods Sold (COGS)", type: "expense", subType: "cost_of_goods_sold", balance: 0, currency: "BDT", isSystem: true, status: "active" },
    { code: "5200", name: "Operating Expenses", type: "expense", subType: "operating_expense", balance: 0, currency: "BDT", isSystem: true, status: "active" },
  ];

  for (const acc of defaultAccounts) {
    await accountsCollection.updateOne(
      { code: acc.code },
      { $set: { ...acc, updatedAt: new Date() } },
      { upsert: true }
    );
  }

  // 5. Categories & Brands
  console.log("Seeding Categories & Brands...");
  const catCollection = db.collection("categories");
  const brandCollection = db.collection("brands");

  const cat1 = await catCollection.findOneAndUpdate(
    { slug: "electronics" },
    { $set: { name: "Consumer Electronics", slug: "electronics", status: "active", updatedAt: new Date() } },
    { upsert: true, returnDocument: "after" }
  );
  const cat2 = await catCollection.findOneAndUpdate(
    { slug: "fmcg-packaged-goods" },
    { $set: { name: "FMCG & Packaged Foods", slug: "fmcg-packaged-goods", status: "active", updatedAt: new Date() } },
    { upsert: true, returnDocument: "after" }
  );

  const brand1 = await brandCollection.findOneAndUpdate(
    { slug: "walton" },
    { $set: { name: "Walton", slug: "walton", status: "active", updatedAt: new Date() } },
    { upsert: true, returnDocument: "after" }
  );

  // 6. Vendors
  console.log("Seeding Vendors...");
  const vendorCollection = db.collection("vendors");
  await vendorCollection.updateOne(
    { phone: "+8801811223344" },
    {
      $set: {
        name: "Kazi Suppliers Ltd",
        companyName: "Kazi National Distribution",
        phone: "+8801811223344",
        email: "supply@kazinational.com",
        address: "Chittagong Port Commercial Zone",
        contactPerson: "Kazi Tariqul",
        openingBalance: 0,
        currentPayable: 0,
        status: "active",
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );

  // 7. Customers / Retailers
  console.log("Seeding Retailers...");
  const customerCollection = db.collection("customers");
  await customerCollection.updateOne(
    { customerCode: "CUST-DHK-001" },
    {
      $set: {
        customerCode: "CUST-DHK-001",
        name: "Abdur Rashid",
        shopName: "Rashid General Store & Electronics",
        ownerName: "Abdur Rashid",
        phone: "+8801911223344",
        address: "Shop 14, Mirpur 10 Super Market",
        district: "Dhaka",
        area: "Mirpur",
        customerType: "retailer",
        creditLimit: 50000,
        openingBalance: 0,
        currentReceivable: 0,
        status: "active",
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );

  console.log("Seed completed successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
