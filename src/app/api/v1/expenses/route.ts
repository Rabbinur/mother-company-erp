import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Expense } from "@/models/Expense";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { ExpenseService } from "@/services/ExpenseService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.EXPENSES_VIEW
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  await connectDB();
  const searchParams = req.nextUrl.searchParams;
  const categoryId = searchParams.get("categoryId");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  const query: Record<string, unknown> = {};
  if (categoryId) query.categoryId = categoryId;

  const skip = (page - 1) * limit;
  const [expenses, total] = await Promise.all([
    Expense.find(query)
      .populate("categoryId", "name code")
      .populate("accountId", "name code")
      .populate("createdBy", "name email")
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Expense.countDocuments(query),
  ]);

  return successResponse(expenses, "Expenses retrieved", {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
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
    const { categoryId, accountId, amount, payee, description, date, receiptAttachment } = body;

    if (!categoryId || !accountId || !amount || !payee || !description) {
      return errorResponse(
        "Category, Account, Amount, Payee, and Description are required",
        400
      );
    }

    const expense = await ExpenseService.createExpense({
      categoryId,
      accountId,
      amount: Number(amount),
      payee,
      description,
      date: date ? new Date(date) : undefined,
      receiptAttachment,
      autoApprove: true,
      createdBy: user.userId,
    });

    return successResponse(expense, "Expense recorded successfully", undefined, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to record expense";
    return errorResponse(msg, 500);
  }
}
