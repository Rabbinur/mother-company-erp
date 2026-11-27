import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { requireAuth } from "@/lib/auth/session";
import { SalesTargetAlertService } from "@/services/analytics/SalesTargetAlertService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from "@/lib/utils/api-response";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const businessId = user.businessId;
  if (!businessId) return errorResponse("Business context required", 400);

  try {
    await connectDB();
    const targetResults = await SalesTargetAlertService.evaluateSalesTargets(businessId);
    const operationalResults = await SalesTargetAlertService.evaluateDailyOperationalAlerts(businessId);

    return successResponse(
      {
        targetEvaluations: targetResults,
        operationalAlerts: operationalResults,
      },
      "Sales targets evaluated and alerts generated successfully"
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Target evaluation failed";
    return errorResponse(msg, 500);
  }
}
