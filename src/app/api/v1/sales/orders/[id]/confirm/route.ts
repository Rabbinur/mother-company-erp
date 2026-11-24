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
  const { user, authorized } = await requirePermission(req, PERMISSIONS.ORDERS_CONFIRM);
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  const { id } = await params;
  if (!id) return errorResponse("Order ID is required", 400);

  await connectDB();

  try {
    const order = await SalesOrderService.confirmSalesOrder({
      orderId: id,
      actorId: user.userId,
    });

    return successResponse(order, "Sales order confirmed and stock reserved successfully");
  } catch (err: any) {
    return errorResponse(err.message || "Failed to confirm sales order", 400);
  }
}
