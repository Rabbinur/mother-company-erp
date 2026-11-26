import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
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
    PERMISSIONS.REPORTS_FINANCIAL
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  try {
    await connectDB();
    const searchParams = req.nextUrl.searchParams;
    const accountId = searchParams.get("accountId") || undefined;
    const accountCode = searchParams.get("accountCode") || undefined;
    const businessId = searchParams.get("businessId") || user.businessId;
    const dealershipId = searchParams.get("dealershipId") || undefined;
    const startDateStr = searchParams.get("startDate");
    const endDateStr = searchParams.get("endDate");

    const report = await AccountingService.getGeneralLedger({
      accountId,
      accountCode,
      businessId,
      dealershipId,
      startDate: startDateStr ? new Date(startDateStr) : undefined,
      endDate: endDateStr ? new Date(endDateStr) : undefined,
    });

    return successResponse(report, "General Ledger statement retrieved");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to generate General Ledger statement";
    return errorResponse(msg, 500);
  }
}
