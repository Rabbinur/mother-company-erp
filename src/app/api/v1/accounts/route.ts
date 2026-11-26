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
  const searchParams = req.nextUrl.searchParams;
  const businessId = searchParams.get("businessId") || user.businessId;
  const dealershipId = searchParams.get("dealershipId");

  await AccountingService.ensureDefaultAccounts(businessId, dealershipId || undefined);

  const query: Record<string, unknown> = { status: "active" };
  if (businessId) {
    query.businessId = businessId;
  }
  if (dealershipId) {
    query.dealershipId = dealershipId;
  }

  const accounts = await Account.find(query).sort({ code: 1 }).lean();
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
    const { code, name, type, subType, description, category, normalBalance, businessId, dealershipId } = body;

    if (!code || !name) {
      return errorResponse("Code and Name are required", 400);
    }

    const cleanCode = String(code).trim();
    const bId = businessId || user.businessId;
    const dId = dealershipId || undefined;

    const existing = await Account.findOne({
      code: cleanCode,
      ...(bId ? { businessId: bId } : {}),
      ...(dId ? { dealershipId: dId } : {}),
    });
    if (existing) {
      return errorResponse(`Account with code '${cleanCode}' already exists for this scope`, 400);
    }

    const account = await Account.create({
      code: cleanCode,
      name,
      type: type || (category ? String(category).toLowerCase() : "asset"),
      category: category || (type ? String(type).toUpperCase() : "ASSET"),
      subType: subType || "current_asset",
      normalBalance: normalBalance || "DEBIT",
      businessId: bId,
      dealershipId: dId,
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
