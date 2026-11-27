import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { authenticateFieldSales } from "@/lib/security/field-sales-auth";
import { getSessionUser } from "@/lib/auth/session";
import { FieldSalesService } from "@/services/FieldSalesService";
import { FieldSalesDeliveryService } from "@/services/delivery/FieldSalesDeliveryService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const auth = authenticateFieldSales(req);
  const user = await getSessionUser(req);

  if (!auth.authenticated && !user) {
    return unauthorizedResponse("Unauthorized: Missing Field Sales API key or valid ERP session");
  }

  try {
    await connectDB();
    const url = req.nextUrl;
    const dealershipId = url.searchParams.get("dealershipId") || undefined;
    const deliverymanId = url.searchParams.get("deliverymanId") || undefined;
    const status = url.searchParams.get("status") || undefined;
    const deliveryStatus = url.searchParams.get("deliveryStatus") || undefined;
    const page = Number(url.searchParams.get("page") || "1");
    const limit = Number(url.searchParams.get("limit") || "20");

    const result = await FieldSalesDeliveryService.listFieldSalesOrders({
      dealershipId,
      deliverymanId,
      status,
      deliveryStatus,
      page,
      limit,
    });

    return successResponse(result, "Field Sales orders retrieved successfully");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to list orders";
    return errorResponse(msg, 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = authenticateFieldSales(req);
  const user = await getSessionUser(req);

  if (!auth.authenticated && !user) {
    return unauthorizedResponse("Unauthorized: Missing Field Sales API credentials");
  }

  try {
    await connectDB();
    const body = await req.json();
    const { customerId, externalOrderId, idempotencyKey, items, notes } = body;

    if (!customerId || !idempotencyKey || !Array.isArray(items) || items.length === 0) {
      return errorResponse(
        "customerId, idempotencyKey, and non-empty items array are required",
        400
      );
    }

    const orderResult = await FieldSalesService.reserveOrder({
      customerId,
      externalOrderId: externalOrderId || idempotencyKey,
      idempotencyKey,
      items,
      notes,
    });

    return successResponse(
      orderResult,
      "Order created and stock reserved successfully in Mother Company ERP",
      undefined,
      201
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to process Field Sales order";
    return errorResponse(msg, 400);
  }
}
