import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { SalesOrderService } from "@/services/SalesOrderService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api-response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, authorized } = await requirePermission(req, PERMISSIONS.ORDERS_CANCEL);
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  const { id } = await params;
  if (!id) return errorResponse("Order ID is required", 400);

  try {
    const body = await req.json().catch(() => ({}));
    await connectDB();

    const order = await SalesOrderService.cancelSalesOrder({
      orderId: id,
      reason: body.reason || "Order cancelled by user",
      actorId: user.userId,
    });

    return successResponse(order, "Sales order cancelled and reservation released successfully");
  } catch (err: any) {
    return errorResponse(err.message || "Failed to cancel sales order", 400);
  }
}
