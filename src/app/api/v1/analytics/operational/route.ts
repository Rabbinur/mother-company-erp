import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { getSessionUser } from "@/lib/auth/session";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { canUserViewPurchaseCost } from "@/lib/grn/cost-masking";
import { OperationalAnalyticsService } from "@/services/analytics/OperationalAnalyticsService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorizedResponse();

  const isExecutive =
    user.role === "super_admin" ||
    user.role === "owner" ||
    user.role === "admin" ||
    user.role === "business_owner";

  const hasReportPerm =
    isExecutive ||
    hasPermission(user.role, user.permissions, PERMISSIONS.REPORTS_VIEW) ||
    hasPermission(user.role, user.permissions, PERMISSIONS.REPORTS_FINANCIAL);

  if (!hasReportPerm) {
    return forbiddenResponse("Insufficient permissions to view Operational Business Intelligence");
  }

  try {
    await connectDB();
    const searchParams = req.nextUrl.searchParams;

    const businessId = user.businessId || searchParams.get("businessId");
    if (!businessId) {
      return errorResponse("Business context required", 400);
    }

    let dealershipId = searchParams.get("dealershipId") || undefined;
    if (dealershipId === "all" || dealershipId === "") dealershipId = undefined;

    // Restrict non-executive users to their assigned dealership
    if (!isExecutive && user.dealershipId) {
      dealershipId = String(user.dealershipId);
    }

    const principalCompanyId = searchParams.get("principalCompanyId") || undefined;
    const periodPreset = searchParams.get("period") || "last_30_days";
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const domain = (searchParams.get("domain") as any) || "all";

    const canViewCosts = canUserViewPurchaseCost(user);

    const payload = await OperationalAnalyticsService.getOperationalAnalytics({
      businessId,
      dealershipId,
      principalCompanyId: principalCompanyId === "all" ? undefined : principalCompanyId,
      periodPreset,
      startDate,
      endDate,
      canViewCosts,
      domain,
    });

    return successResponse(payload, "Operational analytics retrieved successfully");
  } catch (error: any) {
    console.error("Operational analytics API error:", error);
    return errorResponse(error.message || "Failed to retrieve operational analytics", 500);
  }
}
