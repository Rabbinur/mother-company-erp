import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Warehouse } from "@/models/Warehouse";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { InventoryService } from "@/services/InventoryService";
import { AuditService } from "@/services/AuditService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api-response";

export async function POST(req: NextRequest) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.INVENTORY_DAMAGE
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  try {
    await connectDB();
    const body = await req.json();
    const { productId, variantId, damagedQty, reason } = body;

    if (!productId || !variantId || !damagedQty || !reason) {
      return errorResponse(
        "Product ID, Variant ID, Damaged Quantity, and Reason are required",
        400
      );
    }

    let warehouseId = body.warehouseId;
    if (!warehouseId) {
      const central = await Warehouse.findOne({ isCentral: true });
      warehouseId = central?._id;
    }

    const updated = await InventoryService.recordDamage({
      warehouseId,
      productId,
      variantId,
      damagedQty: Number(damagedQty),
      reason,
      actorId: user.userId,
    });

    await AuditService.log({
      actorId: user.userId,
      actorEmail: user.email,
      action: "STOCK_DAMAGED",
      entityType: "inventory",
      entityId: String(variantId),
      afterSnapshot: {
        damagedQty,
        reason,
        damagedTotal: updated.damagedQuantity,
      },
    });

    return successResponse(updated, "Damaged stock recorded successfully");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to record damaged stock";
    return errorResponse(msg, 500);
  }
}
