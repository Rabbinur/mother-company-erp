import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Account } from "@/models/Account";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { AccountingService } from "@/services/AccountingService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.ACCOUNTS_VIEW
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  await connectDB();
  await AccountingService.ensureDefaultAccounts();

  const accounts = await Account.find({ status: "active" }).sort({ code: 1 }).lean();
  return successResponse(accounts);
}

export async function POST(req: NextRequest) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.ACCOUNTS_MANAGE
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  try {
    await connectDB();
    const body = await req.json();
    const { code, name, type, subType, description } = body;

    if (!code || !name || !type || !subType) {
      return errorResponse("Code, Name, Type, and SubType are required", 400);
    }

    const cleanCode = String(code).trim();
    const existing = await Account.findOne({ code: cleanCode });
    if (existing) {
      return errorResponse(`Account with code '${cleanCode}' already exists`, 400);
    }

    const account = await Account.create({
      code: cleanCode,
      name,
      type,
      subType,
      balance: 0,
      currency: "BDT",
      isSystem: false,
      status: "active",
      description,
    });

    return successResponse(account, "Account created successfully", undefined, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create account";
    return errorResponse(msg, 500);
  }
}
