import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { InventoryBalance } from "@/models/InventoryBalance";
import { StockMovement } from "@/models/StockMovement";
import { StockBatch } from "@/models/StockBatch";
import { Warehouse } from "@/models/Warehouse";
import { getSessionUser, requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { InventoryService } from "@/services/InventoryService";
import { InventoryCostingService } from "@/services/InventoryCostingService";
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
  const tab = searchParams.get("tab") || "balances"; // "balances" | "movements" | "batches" | "valuation"
  const dealershipId = searchParams.get("dealershipId") || user.dealershipId;
  const warehouseId = searchParams.get("warehouseId");
  const productId = searchParams.get("productId");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "25", 10);
  const skip = (page - 1) * limit;

  try {
    // 1. Stock Valuation Tab
    if (tab === "valuation") {
      if (!dealershipId) {
        return errorResponse("dealershipId is required for valuation", 400);
      }
      const valuation = await InventoryCostingService.calculateDealershipValuation({
        dealershipId,
        warehouseId: warehouseId || undefined,
      });
      return successResponse(valuation, "Dealership valuation retrieved");
    }

    // 2. Stock Batches & Cost Snapshots Tab
    if (tab === "batches") {
      const batchQuery: Record<string, unknown> = { status: "active" };
      if (dealershipId) batchQuery.dealershipId = dealershipId;
      if (warehouseId) batchQuery.warehouseId = warehouseId;
      if (productId) batchQuery.productId = productId;

      const [batches, total] = await Promise.all([
        StockBatch.find(batchQuery)
          .populate("productId", "name sku unit")
          .populate("variantId", "variantName sku")
          .populate("warehouseId", "name code")
          .populate("principalCompanyId", "name code")
          .sort({ receiptDate: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        StockBatch.countDocuments(batchQuery),
      ]);

      return successResponse(batches, "Stock batches retrieved", {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      });
    }

    // 3. Stock Movements Ledger Tab
    if (tab === "movements") {
      const movementQuery: Record<string, unknown> = {};
      if (dealershipId) movementQuery.dealershipId = dealershipId;
      if (warehouseId) movementQuery.warehouseId = warehouseId;
      if (productId) movementQuery.productId = productId;

      const [movements, total] = await Promise.all([
        StockMovement.find(movementQuery)
          .populate("productId", "name sku unit")
          .populate("variantId", "variantName sku")
          .populate("warehouseId", "name code")
          .populate("createdBy", "name email")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        StockMovement.countDocuments(movementQuery),
      ]);

      return successResponse(movements, "Stock movements retrieved", {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      });
    }

    // 4. Default: Inventory Balances Tab
    const balanceQuery: Record<string, unknown> = {};
    if (dealershipId) balanceQuery.dealershipId = dealershipId;
    if (warehouseId) balanceQuery.warehouseId = warehouseId;
    if (productId) balanceQuery.productId = productId;

    const [balances, total] = await Promise.all([
      InventoryBalance.find(balanceQuery)
        .populate("productId", "name sku unit minStock reorderLevel images")
        .populate("variantId", "variantName sku customerPrice retailPrice")
        .populate("warehouseId", "name code")
        .populate("dealershipId", "name code")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      InventoryBalance.countDocuments(balanceQuery),
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
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to retrieve inventory";
    return errorResponse(msg, 500);
  }
}

export async function POST(req: NextRequest) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.PURCHASES_RECEIVE
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  try {
    await connectDB();
    const body = await req.json();
    const {
      dealershipId,
      warehouseId,
      items,
      referenceId,
      purchaseInvoiceRef,
      challanNumber,
      supplierId,
      principalCompanyId,
    } = body;

    const targetDealershipId = dealershipId || user.dealershipId;
    if (!targetDealershipId || !warehouseId || !Array.isArray(items) || items.length === 0) {
      return errorResponse("dealershipId, warehouseId, and non-empty items array are required", 400);
    }

    await InventoryService.receiveStock({
      businessId: body.businessId || user.businessId,
      dealershipId: targetDealershipId,
      warehouseId,
      items,
      referenceId: referenceId || purchaseInvoiceRef || "RECEIPT",
      purchaseInvoiceRef,
      challanNumber,
      supplierId,
      principalCompanyId,
      actorId: user.userId,
    });

    return successResponse(null, "Stock received successfully", undefined, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to receive stock";
    return errorResponse(msg, 400);
  }
}
