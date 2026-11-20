import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { StockReservation } from "@/models/StockReservation";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { InventoryService } from "@/services/InventoryService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.INVENTORY_VIEW
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  await connectDB();
  const searchParams = req.nextUrl.searchParams;
  const status = searchParams.get("status") || "active";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  const query: Record<string, unknown> = {};
  if (status !== "all") query.status = status;

  const skip = (page - 1) * limit;
  const [reservations, total] = await Promise.all([
    StockReservation.find(query)
      .populate("customerId", "shopName name phone")
      .populate("items.productId", "name sku")
      .populate("items.variantId", "variantName sku")
      .populate("warehouseId", "name code")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    StockReservation.countDocuments(query),
  ]);

  return successResponse(reservations, "Reservations retrieved", {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(req: NextRequest) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.ORDERS_CANCEL
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  try {
    await connectDB();
    const body = await req.json();
    const { reservationId, reason } = body;

    if (!reservationId) {
      return errorResponse("Reservation ID is required", 400);
    }

    await InventoryService.releaseReservation(
      reservationId,
      reason || "Manual release by administrator",
      user.userId
    );

    return successResponse(null, "Reservation released successfully");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to release reservation";
    return errorResponse(msg, 500);
  }
}
