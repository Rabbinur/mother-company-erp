import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { getSessionUser } from "@/lib/auth/session";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { canUserViewPurchaseCost } from "@/lib/grn/cost-masking";
import { ExecutiveDashboardService } from "@/services/ExecutiveDashboardService";
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
    return forbiddenResponse("Insufficient permissions to view Executive Dashboard analytics");
  }

  try {
    await connectDB();
    const searchParams = req.nextUrl.searchParams;

    // Tenancy isolation enforcement: never trust client businessId
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

    const canViewCosts = canUserViewPurchaseCost(user);

    const dashboardData = await ExecutiveDashboardService.getExecutiveDashboard({
      businessId,
      dealershipId,
      principalCompanyId: principalCompanyId === "all" ? undefined : principalCompanyId,
      periodPreset,
      startDate,
      endDate,
      canViewCosts,
    });

    // Mask confidential purchase costs and margins if unauthorized
    if (!canViewCosts) {
      dashboardData.overview.grossProfit = 0;
      dashboardData.overview.netProfit = null;
      dashboardData.overview.netProfitMargin = null;
      dashboardData.overview.inventoryValuation = 0;
      dashboardData.financials.costOfGoodsSold = 0;
      dashboardData.financials.grossProfit = 0;
      dashboardData.financials.grossMarginPercentage = 0;
      dashboardData.financials.netOperatingProfit = null;
      dashboardData.financials.dealershipProfitability = [];
      dashboardData.inventory.inventoryValuation = 0;
      dashboardData.inventory.dealershipComparison.forEach((d) => (d.valuation = 0));
      dashboardData.sales.topProducts.forEach((p) => (p.grossProfit = 0));
    }

    return successResponse(dashboardData, "Executive Dashboard data retrieved successfully");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load Executive Dashboard";
    return errorResponse(msg, 500);
  }
}
