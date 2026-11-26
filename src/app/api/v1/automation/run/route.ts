import crypto from "crypto";
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { getSessionUser } from "@/lib/auth/session";
import { AutomationEngine } from "@/services/automation/AutomationEngine";
import { AutomationExecution } from "@/models/AutomationExecution";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api-response";

function isValidCronSecret(authHeader: string | null): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !authHeader || !authHeader.startsWith("Bearer ")) return false;
  const token = authHeader.substring(7).trim();
  const tokenBuf = Buffer.from(token);
  const secretBuf = Buffer.from(cronSecret);
  if (tokenBuf.length !== secretBuf.length) return false;
  return crypto.timingSafeEqual(tokenBuf, secretBuf);
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const isCronAuth = isValidCronSecret(authHeader);

  let user = null;
  if (!isCronAuth) {
    user = await getSessionUser(req);
    if (!user) return unauthorizedResponse();
  }

  try {
    await connectDB();
    const body = await req.json().catch(() => ({}));
    const businessId = user?.businessId || body.businessId;
    if (!businessId) return errorResponse("Business context required", 400);

    let dealershipId = body.dealershipId || undefined;
    let triggeredBy: "SCHEDULED" | "MANUAL" = isCronAuth ? "SCHEDULED" : "MANUAL";

    if (user) {
      const isExecutive =
        user.role === "super_admin" ||
        user.role === "owner" ||
        user.role === "admin" ||
        user.role === "business_owner";

      const isManager = user.role === "manager" || isExecutive;
      if (!isManager) {
        return forbiddenResponse("Insufficient permissions to trigger automation evaluation");
      }

      // Ordinary users cannot trigger unrestricted business-wide evaluations
      if (!isExecutive) {
        if (!user.dealershipId) {
          return forbiddenResponse("Dealership assignment required for non-executive automation evaluation");
        }
        dealershipId = String(user.dealershipId);
      }
    }

    const category = body.category || undefined;
    const ruleKeys = body.ruleKeys || undefined;
    const dryRun = Boolean(body.dryRun);

    const result = await AutomationEngine.run({
      businessId,
      dealershipId,
      category,
      ruleKeys,
      dryRun,
      triggeredBy,
      userId: user?.userId,
    });

    return successResponse(result, "Automation engine evaluated successfully");
  } catch (err: any) {
    if (err?.message?.includes("Concurrent evaluation rejected")) {
      return errorResponse(err.message, 409);
    }
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
