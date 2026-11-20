import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { authenticateFieldSales } from "@/lib/security/field-sales-auth";
import { Warehouse } from "@/models/Warehouse";
import { InventoryBalance } from "@/models/InventoryBalance";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const auth = authenticateFieldSales(req);
  if (!auth.authenticated) {
    return unauthorizedResponse(auth.error || "Invalid Field Sales API credentials");
  }

  try {
    await connectDB();
    const warehouse =
      (await Warehouse.findOne({ isCentral: true })) ||
      (await Warehouse.findOne({ status: "active" }));

    if (!warehouse) {
      return errorResponse("Central warehouse not configured", 404);
    }

    const balances = await InventoryBalance.find({ warehouseId: warehouse._id })
      .populate("productId", "name sku")
      .populate("variantId", "variantName sku")
      .lean();

    const result = balances.map((b) => ({
      warehouseId: String(warehouse._id),
      warehouseCode: warehouse.code,
      productId: String(b.productId?._id),
      variantId: String(b.variantId?._id),
      onHand: b.onHandQuantity,
      reserved: b.reservedQuantity,
      available: Math.max(0, b.onHandQuantity - b.reservedQuantity),
    }));

    return successResponse(result, "Inventory balances retrieved");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load inventory";
    return errorResponse(msg, 500);
  }
}
