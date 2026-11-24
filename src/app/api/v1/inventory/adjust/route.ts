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
      adjustmentQty,
      damagedQty,
      isDamage,
      reason,
    } = body;

    const targetDealershipId = dealershipId || user.dealershipId;
    if (!targetDealershipId || !warehouseId || !productId || !variantId) {
      return errorResponse("dealershipId, warehouseId, productId, and variantId are required", 400);
    }

    if (!reason || !reason.trim()) {
      return errorResponse("Adjustment reason is required for audit trail", 400);
    }

    if (isDamage || damagedQty !== undefined) {
      const qty = Number(damagedQty || adjustmentQty);
      if (qty <= 0) {
        return errorResponse("Damaged quantity must be greater than zero", 400);
      }

      const balance = await InventoryService.recordDamage({
        businessId: body.businessId || user.businessId,
        dealershipId: targetDealershipId,
        warehouseId,
        productId,
        variantId,
        damagedQty: qty,
        reason,
        actorId: user.userId,
      });

      return successResponse(balance, "Damage recorded successfully");
    }

    if (adjustmentQty === undefined || Number(adjustmentQty) === 0) {
      return errorResponse("Non-zero adjustmentQty is required", 400);
    }

    const balance = await InventoryService.adjustStock({
      businessId: body.businessId || user.businessId,
      dealershipId: targetDealershipId,
      warehouseId,
      productId,
      variantId,
      adjustmentQty: Number(adjustmentQty),
      reason,
      actorId: user.userId,
    });

    return successResponse(balance, "Stock adjusted successfully");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to adjust stock";
    return errorResponse(msg, 400);
  }
}
