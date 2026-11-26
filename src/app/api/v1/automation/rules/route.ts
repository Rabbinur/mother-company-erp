import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { getSessionUser } from "@/lib/auth/session";
import { AutomationRuleService } from "@/services/automation/AutomationRuleService";
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
    const category = (searchParams.get("category") as any) || undefined;

    const rules = await AutomationRuleService.getRules({
      businessId,
      dealershipId: dealershipId === "all" ? undefined : dealershipId,
      category,
    });

    return successResponse(rules, "Automation rules retrieved successfully");
  } catch (err: any) {
    return errorResponse(err?.message || "Failed to fetch automation rules", 500);
  }
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorizedResponse();

  try {
    await connectDB();
    const body = await req.json().catch(() => ({}));
    const { ruleKey, enabled, severity, configuration, dealershipId } = body;

    if (!ruleKey) return errorResponse("ruleKey is required", 400);
    const businessId = user.businessId || body.businessId;
    if (!businessId) return errorResponse("Business context required", 400);

    const updated = await AutomationRuleService.updateRule({
      businessId,
      ruleKey,
      dealershipId,
      enabled,
      severity,
      configuration,
      userId: user.userId,
    });

    if (!updated) return errorResponse("Rule not found or could not be updated", 404);

    return successResponse(updated, "Automation rule updated successfully");
  } catch (err: any) {
    return errorResponse(err?.message || "Failed to update automation rule", 500);
  }
}
