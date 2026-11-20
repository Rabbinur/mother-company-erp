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
    PERMISSIONS.ORDERS_FULFILL
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  const { id } = await params;
  try {
    await connectDB();
    const fulfilledOrder = await OrderService.fulfillOrder(id, user.userId);
    return successResponse(
      fulfilledOrder,
      "Order fulfilled, stock deducted, and accounts updated successfully"
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fulfill order";
    return errorResponse(msg, 500);
  }
}
