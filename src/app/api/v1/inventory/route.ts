import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { InventoryBalance } from "@/models/InventoryBalance";
import { StockMovement } from "@/models/StockMovement";
import { Warehouse } from "@/models/Warehouse";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  successResponse,
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
  const tab = searchParams.get("tab") || "balances"; // "balances" or "movements" or "low_stock"
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "25", 10);

  let warehouse = await Warehouse.findOne({ isCentral: true });
  if (!warehouse) {
    warehouse = await Warehouse.findOne({ status: "active" });
  }

  const wId = warehouse?._id;

  if (tab === "movements") {
    const skip = (page - 1) * limit;
    const [movements, total] = await Promise.all([
      StockMovement.find()
        .populate("productId", "name sku")
        .populate("variantId", "variantName sku")
        .populate("warehouseId", "name code")
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      StockMovement.countDocuments(),
    ]);

    return successResponse(movements, "Stock movements retrieved", {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  }

  // Otherwise return inventory balances
  const query: Record<string, unknown> = {};
  if (wId) query.warehouseId = wId;

  const skip = (page - 1) * limit;
  const [balances, total] = await Promise.all([
    InventoryBalance.find(query)
      .populate("productId", "name sku unit minStock reorderLevel images")
      .populate("variantId", "variantName sku customerPrice retailPrice")
      .populate("warehouseId", "name code")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    InventoryBalance.countDocuments(query),
  ]);

  // Re-verify Available = OnHand - Reserved
  const enriched = balances.map((b) => ({
    ...b,
    availableQuantity: Math.max(0, b.onHandQuantity - b.reservedQuantity),
  }));

  return successResponse(enriched, "Inventory balances retrieved", {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    warehouse,
  });
}
