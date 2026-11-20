import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/models/User";
import { Role } from "@/models/Role";
import { Warehouse } from "@/models/Warehouse";
import { hashPassword } from "@/lib/auth/password";
import { DEFAULT_ROLE_PERMISSIONS } from "@/lib/auth/permissions";
import { AccountingService } from "@/services/AccountingService";
import { ExpenseService } from "@/services/ExpenseService";
import { successResponse, errorResponse } from "@/lib/utils/api-response";

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const existingAdmin = await User.findOne({ role: "super_admin" });
    if (existingAdmin) {
      return errorResponse(
        "Super Admin already exists. Setup has already been completed.",
        400,
        null,
        "SETUP_ALREADY_INITIALIZED"
      );
    }

    const body = await req.json().catch(() => ({}));
    const name = body.name || "Super Admin";
    const email = (body.email || "admin@mothercompany.com").toLowerCase().trim();
    const password = body.password || "Admin@123456";

    // 1. Seed Roles
    for (const [code, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      const existing = await Role.findOne({ code });
      if (!existing) {
        await Role.create({
          name: code
            .split("_")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" "),
          code,
          permissions,
          isSystem: true,
        });
      }
    }

    // 2. Seed Central Warehouse
    let warehouse = await Warehouse.findOne({ isCentral: true });
    if (!warehouse) {
      warehouse = await Warehouse.create({
        name: "Central Warehouse Dhaka",
        code: "WH-CENTRAL-01",
        address: "Tejgaon Industrial Area, Dhaka, Bangladesh",
        isCentral: true,
        status: "active",
        contactPerson: "Operations Manager",
        phone: "+8801700000000",
      });
    }

    // 3. Seed Chart of Accounts & Expense Categories
    await AccountingService.ensureDefaultAccounts();
    await ExpenseService.ensureDefaultCategories();

    // 4. Create First Super Admin
    const passwordHash = await hashPassword(password);
    const superAdmin = await User.create({
      name,
      email,
      passwordHash,
      role: "super_admin",
      status: "active",
      customPermissions: [],
    });

    return successResponse(
      {
        user: {
          id: superAdmin._id,
          name: superAdmin.name,
          email: superAdmin.email,
          role: superAdmin.role,
        },
        warehouse: {
          id: warehouse._id,
          name: warehouse.name,
          code: warehouse.code,
        },
      },
      "Initial setup completed successfully"
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Setup initialization failed";
    return errorResponse(msg, 500);
  }
}
