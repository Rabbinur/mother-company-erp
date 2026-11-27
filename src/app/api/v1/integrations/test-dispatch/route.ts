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
    const { channel, recipientPhone, message } = body;

    // Strict Recipient Validation: prevent accidental/malformed numbers
    if (channel === "sms" || channel === "whatsapp") {
      if (!recipientPhone || typeof recipientPhone !== "string") {
        return errorResponse("recipientPhone string is required for SMS/WhatsApp test dispatches", 400);
      }
      const digitsOnly = recipientPhone.replace(/[^0-9]/g, "");
      if (digitsOnly.length < 11 || digitsOnly.length > 15) {
        return errorResponse("Invalid recipient phone. Must contain 11 to 15 digits (e.g. 01700000000 or +8801700000000)", 400);
      }
    }

    // Safety: Enforce explicit test prefix to prevent accidental customer misunderstanding
    const explicitTitle = "[SYSTEM TEST] Integration Connectivity Test";
    const explicitMessage = `[TEST DISPATCH - ERP ADMIN] ${
      message ? String(message).slice(0, 80) : "Channel connectivity verified."
    } Please ignore this automated test message.`;

    const result = await ExternalNotificationDispatcher.dispatch({
      businessId: user.businessId ? String(user.businessId) : undefined,
      title: explicitTitle,
      message: explicitMessage,
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
