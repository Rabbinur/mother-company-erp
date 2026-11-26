import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { getSessionUser } from "@/lib/auth/session";
import { AutomationActionService } from "@/services/automation/AutomationActionService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorizedResponse();

  try {
    await connectDB();
    const searchParams = req.nextUrl.searchParams;
    const businessId = user.businessId || searchParams.get("businessId");
    if (!businessId) return errorResponse("Business context required", 400);

    const dealershipId = searchParams.get("dealershipId") || undefined;
    const status = (searchParams.get("status") as any) || undefined;
    const category = searchParams.get("category") || undefined;
    const severity = searchParams.get("severity") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const skip = parseInt(searchParams.get("skip") || "0", 10);

    const result = await AutomationActionService.getEvents({
      businessId,
      dealershipId,
      status,
      category,
      severity,
      limit,
      skip,
    });

    return successResponse(result, "Automation events retrieved successfully");
  } catch (err: any) {
    return errorResponse(err?.message || "Failed to fetch automation events", 500);
  }
}
