import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { ExpenseCategory } from "@/models/ExpenseCategory";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { ExpenseService } from "@/services/ExpenseService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api-response";

export async function GET() {
  await connectDB();
  await ExpenseService.ensureDefaultCategories();
  const categories = await ExpenseCategory.find({ status: "active" }).sort({ name: 1 }).lean();
  return successResponse(categories);
}

export async function POST(req: NextRequest) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.EXPENSES_CREATE
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  try {
    await connectDB();
    const body = await req.json();
    const { name, code, description } = body;

    if (!name || !code) {
      return errorResponse("Category name and code are required", 400);
    }

    const cleanCode = String(code).toLowerCase().replace(/\s+/g, "_").trim();
    const category = await ExpenseCategory.create({
      name,
      code: cleanCode,
      description,
      status: "active",
    });

    return successResponse(category, "Expense category created", undefined, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create expense category";
    return errorResponse(msg, 500);
  }
}
