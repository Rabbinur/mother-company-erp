import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { requireAuth } from "@/lib/auth/session";
import { canUserViewPurchaseCost } from "@/lib/grn/cost-masking";
import { ProcurementReportService } from "@/services/ProcurementReportService";
import {
  successResponse,
  unauthorizedResponse,
  errorResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const businessId = user.businessId;
  if (!businessId) {
    return errorResponse("Business context required", 400);
  }

  await connectDB();

  const searchParams = req.nextUrl.searchParams;
  const groupBy = (searchParams.get("groupBy") as any) || "supplier";
  const dealershipId = searchParams.get("dealershipId") || undefined;
  const supplierId = searchParams.get("supplierId") || undefined;
  const principalCompanyId = searchParams.get("principalCompanyId") || undefined;
  const productId = searchParams.get("productId") || undefined;
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;

  const canViewCost = canUserViewPurchaseCost(user);

  try {
    const report = await ProcurementReportService.getHistoryReport(
      {
        businessId,
        dealershipId,
        supplierId,
        principalCompanyId,
        productId,
        startDate,
        endDate,
        groupBy,
      },
      canViewCost
    );

    return successResponse(report);
  } catch (err: any) {
    return errorResponse(err.message || "Failed to generate procurement history report", 500);
  }
}
