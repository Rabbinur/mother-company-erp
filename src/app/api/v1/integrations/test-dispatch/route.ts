import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { getSessionUser } from "@/lib/auth/session";
import { ExternalNotificationDispatcher } from "@/services/integrations/ExternalNotificationDispatcher";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api-response";

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorizedResponse();

  const isOwnerOrAdmin =
    user.role === "super_admin" ||
    user.role === "owner" ||
    user.role === "admin" ||
    user.role === "business_owner";

  if (!isOwnerOrAdmin) {
    return forbiddenResponse(
      "Only Business Owner or Admin can execute test dispatches"
    );
  }

  try {
    await connectDB();
    const body = await req.json();
    const { channel, recipientPhone, title, message } = body;

    if (!recipientPhone && channel !== "in_app") {
      return errorResponse("recipientPhone is required for SMS/WhatsApp", 400);
    }

    const result = await ExternalNotificationDispatcher.dispatch({
      businessId: user.businessId ? String(user.businessId) : undefined,
      title: title || "ERP Test Integration Alert",
      message:
        message ||
        "This is an automated test notification sent from Dealership Management ERP.",
      type: "system",
      targetUserId: user.userId,
      recipientPhone,
      channels: [channel || "in_app"],
    });

    return successResponse(result, "Test dispatch executed successfully");
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Test dispatch failed";
    return errorResponse(msg, 500);
  }
}
