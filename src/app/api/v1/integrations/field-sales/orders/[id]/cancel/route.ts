import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { authenticateFieldSales } from "@/lib/security/field-sales-auth";
import { FieldSalesService } from "@/services/FieldSalesService";
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
  if (!auth.authenticated) {
    return unauthorizedResponse(auth.error || "Invalid Field Sales API credentials");
  }

  const { id } = await params;
  try {
    await connectDB();
    const body = await req.json().catch(() => ({}));
    const order = await FieldSalesService.cancelOrder(
      id,
      body.reason || "Cancelled by Field Sales System"
    );

    return successResponse(
      {
        orderId: String(order._id),
        orderNumber: order.orderNumber,
        status: order.orderStatus,
      },
      "Order cancelled and reservations released safely"
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to cancel order";
    return errorResponse(msg, 400);
  }
}
