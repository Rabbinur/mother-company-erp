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
    PERMISSIONS.ORDERS_CONFIRM
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  const { id } = await params;
  try {
    await connectDB();
    const confirmedOrder = await OrderService.confirmOrder(id, user.userId);
    return successResponse(
      confirmedOrder,
      "Order confirmed and stock reserved successfully"
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to confirm order";
    return errorResponse(msg, 500);
  }
}
