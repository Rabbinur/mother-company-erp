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
    // Dealership-level authorization enforcement
    if (user.dealershipId && user.role !== "super_admin" && user.role !== "business_owner") {
      dealershipId = String(user.dealershipId);
    }

    const customerId = searchParams.get("customerId") || undefined;
    const asOfDateStr = searchParams.get("asOfDate");
    const asOfDate = asOfDateStr ? new Date(asOfDateStr) : undefined;
    const minBalanceStr = searchParams.get("minBalance");
    const minBalance = minBalanceStr ? Number(minBalanceStr) : undefined;

    const report = await FinancialReportService.getArAgingReport({
      businessId,
      dealershipId,
      customerId,
      asOfDate,
      minBalance,
    });

    return successResponse(report, "AR Aging Report retrieved successfully");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to generate AR Aging Report";
    return errorResponse(msg, 500);
  }
}
