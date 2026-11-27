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

  // Assignment can be performed by authorized ERP staff (manager/admin) or authorized Field Sales API
  if (!auth.authenticated && (!user || (user.role !== "manager" && user.role !== "admin" && user.role !== "owner"))) {
    return unauthorizedResponse("Forbidden: Only ERP managers, admins, or authorized API can assign deliverymen");
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { deliverymanId, deliverymanName, deliverymanPhone } = body;

    if (!deliverymanId) {
      return errorResponse("deliverymanId is required", 400);
    }

    await connectDB();
    const assignment = await FieldSalesDeliveryService.assignDeliveryman({
      orderId: id,
      deliverymanId,
      deliverymanName,
      deliverymanPhone,
      actorId: user?.userId,
    });

    return successResponse(assignment, "Deliveryman assigned successfully");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to assign deliveryman";
    return errorResponse(msg, 400);
  }
}
