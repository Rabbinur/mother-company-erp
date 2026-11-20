import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { OrderService } from "@/services/OrderService";
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
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.ORDERS_CANCEL
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  const { id } = await params;
  try {
    await connectDB();
    const body = await req.json().catch(() => ({}));
    const cancelledOrder = await OrderService.cancelOrder(
      id,
      body.reason || "Cancelled by user",
      user.userId
    );

    return successResponse(
      cancelledOrder,
      "Order cancelled and reservations released successfully"
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to cancel order";
    return errorResponse(msg, 500);
  }
}
