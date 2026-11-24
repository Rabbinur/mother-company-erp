import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { requireAuth } from "@/lib/auth/session";
import { SalesOrderService } from "@/services/SalesOrderService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const businessId = user.businessId;
  if (!businessId) return errorResponse("Business context required", 400);

  let dealershipId = user.dealershipId || user.activeDealershipId;
  const requestedDealership = req.nextUrl.searchParams.get("dealershipId");

  if (requestedDealership && (user.role === "owner" || user.role === "super_admin" || user.role === "admin")) {
    dealershipId = requestedDealership;
  }

  await connectDB();

  try {
    const kpis = await SalesOrderService.getSalesDashboardKpis(businessId, dealershipId);
    return successResponse(kpis, "Sales dashboard KPIs retrieved successfully");
  } catch (err: any) {
    return errorResponse(err.message || "Failed to retrieve sales KPIs", 500);
  }
}
