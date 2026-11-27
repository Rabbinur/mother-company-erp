import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { authenticateFieldSales } from "@/lib/security/field-sales-auth";
import { getSessionUser } from "@/lib/auth/session";
import { FieldSalesDeliveryService } from "@/services/delivery/FieldSalesDeliveryService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from "@/lib/utils/api-response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = authenticateFieldSales(req);
  const user = await getSessionUser(req);

  if (!auth.authenticated && !user) {
    return unauthorizedResponse("Unauthorized: Missing Field Sales API key or valid ERP session");
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { status, notes, failureReason } = body;

    const validStatuses = ["pending", "out_for_delivery", "delivered", "failed"];
    if (!status || !validStatuses.includes(status)) {
      return errorResponse(
        `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        400
      );
    }

    await connectDB();
    const result = await FieldSalesDeliveryService.updateDeliveryStatus({
      orderId: id,
      status,
      notes,
      failureReason,
      actorId: user?.userId,
    });

    return successResponse(result, "Delivery status updated successfully");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update delivery status";
    return errorResponse(msg, 400);
  }
}
