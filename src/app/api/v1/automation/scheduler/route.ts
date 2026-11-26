import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { getSessionUser } from "@/lib/auth/session";
import { AutomationSchedulerService } from "@/services/automation/AutomationSchedulerService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorizedResponse();

  // Never trust client businessId
  const businessId = user.businessId;
  if (!businessId) return errorResponse("Business context required", 400);

  try {
    await connectDB();
    const isOwnerOrAdmin =
      user.role === "super_admin" ||
      user.role === "owner" ||
      user.role === "admin" ||
      user.role === "business_owner";

    const setting = await AutomationSchedulerService.getSchedulerSetting(businessId);

    return successResponse(
      {
        ...setting,
        canToggle: isOwnerOrAdmin,
        vercelCronStatus: "REGISTERED_DAILY", // Vercel cron remains static at 00:00 UTC
      },
      "Scheduler settings retrieved successfully"
    );
  } catch (err: any) {
    return errorResponse(err?.message || "Failed to retrieve scheduler settings", 500);
  }
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorizedResponse();

  const isOwnerOrAdmin =
    user.role === "super_admin" ||
    user.role === "owner" ||
    user.role === "admin" ||
    user.role === "business_owner";

  if (!isOwnerOrAdmin) {
    return forbiddenResponse("Only Business Owner or Admin can modify scheduled automation settings");
  }

  // Strictly enforce session businessId - never trust body
  const businessId = user.businessId;
  if (!businessId) return errorResponse("Business context required", 400);

  try {
    await connectDB();
    const body = await req.json().catch(() => ({}));

    if (typeof body.enabled !== "boolean") {
      return errorResponse("Field 'enabled' (boolean) is required", 400);
    }

    const updated = await AutomationSchedulerService.updateSchedulerSetting({
      businessId,
      enabled: body.enabled,
      userId: user.userId,
      userEmail: user.email,
      reason: body.reason,
    });

    return successResponse(
      updated,
      `Scheduled automation ${body.enabled ? "enabled" : "disabled"} successfully`
    );
  } catch (err: any) {
    return errorResponse(err?.message || "Failed to update scheduler settings", 500);
  }
}
