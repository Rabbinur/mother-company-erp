import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { getSessionUser } from "@/lib/auth/session";
import { AutomationActionService } from "@/services/automation/AutomationActionService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from "@/lib/utils/api-response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(req);
  if (!user) return unauthorizedResponse();

  try {
    await connectDB();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    const businessId = user.businessId || body.businessId;
    if (!businessId) return errorResponse("Business context required", 400);

    const isExecutive =
      user.role === "super_admin" ||
      user.role === "owner" ||
      user.role === "admin" ||
      user.role === "business_owner";

    const dealershipId = !isExecutive && user.dealershipId ? String(user.dealershipId) : undefined;

    let updatedEvent = null;
    if (action === "ACKNOWLEDGE") {
      updatedEvent = await AutomationActionService.acknowledgeEvent({
        eventId: id,
        businessId,
        dealershipId,
        userId: user.userId,
      });
    } else if (action === "RESOLVE") {
      updatedEvent = await AutomationActionService.resolveEvent({
        eventId: id,
        businessId,
        dealershipId,
        userId: user.userId,
      });
    } else if (action === "DISMISS") {
      updatedEvent = await AutomationActionService.dismissEvent({
        eventId: id,
        businessId,
        dealershipId,
        userId: user.userId,
      });
    } else {
      return errorResponse("Invalid action. Must be ACKNOWLEDGE, RESOLVE, or DISMISS", 400);
    }

    if (!updatedEvent) {
      return errorResponse("Event not found or cannot be transitioned from current state", 404);
    }

    return successResponse(updatedEvent, `Event marked as ${action} successfully`);
  } catch (err: any) {
    return errorResponse(err?.message || "Failed to update event state", 500);
  }
}
