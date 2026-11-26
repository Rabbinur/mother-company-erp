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
    const businessId = searchParams.get("businessId") || user.businessId;
    const dealershipId = searchParams.get("dealershipId") || undefined;
    const asOfDateStr = searchParams.get("asOfDate");

    const report = await AccountingService.getBalanceSheet({
      businessId,
      dealershipId,
      asOfDate: asOfDateStr ? new Date(asOfDateStr) : undefined,
    });

    return successResponse(report, "Balance Sheet retrieved");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to generate Balance Sheet";
    return errorResponse(msg, 500);
  }
}
