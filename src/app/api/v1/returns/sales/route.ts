import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { SalesReturn } from "@/models/SalesReturn";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { SalesReturnService } from "@/services/SalesReturnService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.ORDERS_VIEW
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  await connectDB();
  const searchParams = req.nextUrl.searchParams;
  const customerId = searchParams.get("customerId");
  const orderId = searchParams.get("orderId");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  const query: Record<string, unknown> = {};
  if (customerId) query.customerId = customerId;
  if (orderId) query.orderId = orderId;

  const skip = (page - 1) * limit;
  const [returns, total] = await Promise.all([
    SalesReturn.find(query)
      .populate("customerId", "shopName name phone")
      .populate("warehouseId", "name code")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    SalesReturn.countDocuments(query),
  ]);

  return successResponse(returns, "Sales returns retrieved", {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(req: NextRequest) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.ORDERS_RETURN
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  try {
    await connectDB();
    const body = await req.json();
    const { orderId, items, reason, notes } = body;

    if (!orderId || !items || items.length === 0 || !reason) {
      return errorResponse("Order ID, items, and reason are required", 400);
    }

    const salesReturn = await SalesReturnService.processReturn({
      orderId,
      items,
      reason,
      notes,
      actorId: user.userId,
    });

    return successResponse(
      salesReturn,
      "Sales return processed successfully",
      undefined,
      201
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to process sales return";
    return errorResponse(msg, 500);
  }
}
