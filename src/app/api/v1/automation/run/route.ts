import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { getSessionUser } from "@/lib/auth/session";
import { AutomationEngine } from "@/services/automation/AutomationEngine";
import { AutomationExecution } from "@/models/AutomationExecution";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from "@/lib/utils/api-response";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorizedResponse();

  try {
    await connectDB();
    const body = await req.json().catch(() => ({}));
    const businessId = user.businessId || body.businessId;
    if (!businessId) return errorResponse("Business context required", 400);

    const dealershipId = body.dealershipId || undefined;
    const category = body.category || undefined;
    const ruleKeys = body.ruleKeys || undefined;
    const dryRun = Boolean(body.dryRun);

    const result = await AutomationEngine.run({
      businessId,
      dealershipId,
      category,
      ruleKeys,
      dryRun,
      triggeredBy: "MANUAL",
      userId: user.userId,
    });

    return successResponse(result, "Automation engine evaluated successfully");
  } catch (err: any) {
    return errorResponse(err?.message || "Automation engine execution failed", 500);
  }
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorizedResponse();

  try {
    await connectDB();
    const searchParams = req.nextUrl.searchParams;
    const businessId = user.businessId || searchParams.get("businessId");
    if (!businessId) return errorResponse("Business context required", 400);

    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const executions = await AutomationExecution.find({ businessId })
      .sort({ startedAt: -1 })
      .limit(limit)
      .lean();

    return successResponse(executions, "Automation executions retrieved successfully");
  } catch (err: any) {
    return errorResponse(err?.message || "Failed to fetch automation executions", 500);
  }
}
