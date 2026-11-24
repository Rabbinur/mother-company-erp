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
      fromWarehouseId,
      toWarehouseId,
      productId,
      variantId,
      quantity,
      notes,
    } = body;

    const targetDealershipId = dealershipId || user.dealershipId;
    if (!targetDealershipId || !fromWarehouseId || !toWarehouseId || !productId || !variantId || !quantity) {
      return errorResponse(
        "dealershipId, fromWarehouseId, toWarehouseId, productId, variantId, and quantity are required",
        400
      );
    }

    const result = await InventoryService.transferStock({
      businessId: body.businessId || user.businessId,
      dealershipId: targetDealershipId,
      fromWarehouseId,
      toWarehouseId,
      productId,
      variantId,
      quantity: Number(quantity),
      notes,
      actorId: user.userId,
    });

    return successResponse(result, "Warehouse transfer completed successfully");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to transfer stock";
    return errorResponse(msg, 400);
  }
}
