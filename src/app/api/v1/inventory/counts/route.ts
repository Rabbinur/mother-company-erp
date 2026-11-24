import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { InventoryService } from "@/services/InventoryService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api-response";

export async function POST(req: NextRequest) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.INVENTORY_ADJUST
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  try {
    await connectDB();
    const body = await req.json();
    const {
      dealershipId,
      warehouseId,
      productId,
      variantId,
      countedQuantity,
      reason,
    } = body;

    const targetDealershipId = dealershipId || user.dealershipId;
    if (
      !targetDealershipId ||
      !warehouseId ||
      !productId ||
      !variantId ||
      countedQuantity === undefined
    ) {
      return errorResponse(
        "dealershipId, warehouseId, productId, variantId, and countedQuantity are required",
        400
      );
    }

    const result = await InventoryService.reconcilePhysicalCount({
      businessId: body.businessId || user.businessId,
      dealershipId: targetDealershipId,
      warehouseId,
      productId,
      variantId,
      countedQuantity: Number(countedQuantity),
      reason: reason || "Periodic physical stock count",
      actorId: user.userId,
    });

    return successResponse(result, "Physical stock count reconciled successfully");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to reconcile physical count";
    return errorResponse(msg, 400);
  }
}
