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
  const dealershipId = searchParams.get("dealershipId") || user.dealershipId;
  const warehouseId = searchParams.get("warehouseId");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  const query: Record<string, unknown> = {};
  if (status !== "all") query.status = status;
  if (dealershipId) query.dealershipId = dealershipId;
  if (warehouseId) query.warehouseId = warehouseId;

  const skip = (page - 1) * limit;
  const [reservations, total] = await Promise.all([
    StockReservation.find(query)
      .populate("customerId", "shopName name phone")
      .populate("items.productId", "name sku")
      .populate("items.variantId", "variantName sku")
      .populate("warehouseId", "name code")
      .populate("dealershipId", "name code")
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
    PERMISSIONS.ORDERS_CREATE
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  try {
    await connectDB();
    const body = await req.json();
    const {
      action,
      reservationId,
      reason,
      dealershipId,
      warehouseId,
      items,
      orderNumber,
      customerId,
      idempotencyKey,
      expiresInMinutes,
    } = body;

    // Cancellation / release action
    if (action === "release" || reservationId) {
      if (!reservationId) {
        return errorResponse("Reservation ID is required for release", 400);
      }
      await InventoryService.releaseReservation(
        reservationId,
        reason || "Manual release by administrator",
        user.userId
      );
      return successResponse(null, "Reservation released successfully");
    }

    // Create reservation action
    const targetDealershipId = dealershipId || user.dealershipId;
    if (!targetDealershipId || !warehouseId || !Array.isArray(items) || items.length === 0) {
      return errorResponse(
        "dealershipId, warehouseId, and items array are required to create a reservation",
        400
      );
    }

    const reservation = await InventoryService.reserveStock({
      businessId: body.businessId || user.businessId,
      dealershipId: targetDealershipId,
      warehouseId,
      items,
      orderNumber,
      customerId,
      idempotencyKey,
      expiresInMinutes,
      actorId: user.userId,
    });

    return successResponse(reservation, "Stock reserved successfully", undefined, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Reservation operation failed";
    return errorResponse(msg, 400);
  }
}
