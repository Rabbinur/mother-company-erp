import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { FinancialReportService } from "@/services/FinancialReportService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.REPORTS_FINANCIAL
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  try {
    await connectDB();
    const searchParams = req.nextUrl.searchParams;
    const businessId = searchParams.get("businessId") || user.businessId;

    let dealershipId = searchParams.get("dealershipId") || undefined;
    if (user.dealershipId && user.role !== "super_admin" && user.role !== "business_owner") {
      dealershipId = String(user.dealershipId);
    }

    const accountId = searchParams.get("accountId") || undefined;
    const accountCode = searchParams.get("accountCode") || undefined;
    const startDateStr = searchParams.get("startDate");
    const endDateStr = searchParams.get("endDate");
    const statementEndingBalanceStr = searchParams.get("statementEndingBalance");

    const report = await FinancialReportService.getCashBankReconciliation({
      businessId,
      dealershipId,
      accountId,
      accountCode,
      startDate: startDateStr ? new Date(startDateStr) : undefined,
      endDate: endDateStr ? new Date(endDateStr) : undefined,
      statementEndingBalance: statementEndingBalanceStr !== null && statementEndingBalanceStr !== undefined
        ? Number(statementEndingBalanceStr)
        : undefined,
    });

    return successResponse(report, "Cash & Bank Reconciliation statement retrieved successfully");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to retrieve reconciliation data";
    return errorResponse(msg, 500);
  }
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

    const businessId = body.businessId || user.businessId;
    let dealershipId = body.dealershipId || undefined;
    if (user.dealershipId && user.role !== "super_admin" && user.role !== "business_owner") {
      dealershipId = String(user.dealershipId);
    }

    if (!body.accountId) {
      return errorResponse("accountId is required to record bank reconciliation", 400);
    }
    if (body.statementEndingBalance === undefined || isNaN(Number(body.statementEndingBalance))) {
      return errorResponse("Valid statementEndingBalance is required", 400);
    }

    const record = await FinancialReportService.recordBankReconciliation({
      businessId,
      dealershipId,
      accountId: body.accountId,
      statementDate: body.statementDate ? new Date(body.statementDate) : new Date(),
      statementEndingBalance: Number(body.statementEndingBalance),
      reconciledBy: user.userId,
      notes: body.notes,
    });

    return successResponse(record, "Bank reconciliation recorded successfully", undefined, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to record bank reconciliation";
    return errorResponse(msg, 500);
  }
}
