import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { authenticateFieldSales } from "@/lib/security/field-sales-auth";
import { FieldSalesService } from "@/services/FieldSalesService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from "@/lib/utils/api-response";

export async function POST(req: NextRequest) {
  const auth = authenticateFieldSales(req);
  if (!auth.authenticated) {
    return unauthorizedResponse(auth.error || "Invalid Field Sales API credentials");
  }

  try {
    await connectDB();
    const body = await req.json();
    const { customerId, externalOrderId, idempotencyKey, items, notes } = body;

    if (!customerId || !externalOrderId || !idempotencyKey || !items || items.length === 0) {
      return errorResponse(
        "Missing required fields: customerId, externalOrderId, idempotencyKey, and items",
        400
      );
    }

    const result = await FieldSalesService.reserveOrder({
      customerId,
      externalOrderId,
      idempotencyKey,
      items,
      notes,
    });

    return successResponse(
      result,
      "Order created and stock reserved atomically in Mother Company ERP",
      undefined,
      201
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to reserve order";
    return errorResponse(msg, 400);
  }
}
