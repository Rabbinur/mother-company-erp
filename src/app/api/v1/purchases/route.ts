import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Purchase } from "@/models/Purchase";
import { Warehouse } from "@/models/Warehouse";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { PurchaseService } from "@/services/PurchaseService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.PURCHASES_VIEW
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  await connectDB();
  const searchParams = req.nextUrl.searchParams;
  const status = searchParams.get("status") || "";
  const vendorId = searchParams.get("vendorId") || "";
  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  const query: Record<string, unknown> = {};
  if (status) query.status = status;
  if (vendorId) query.vendorId = vendorId;
  if (search) query.purchaseNumber = { $regex: search, $options: "i" };

  const skip = (page - 1) * limit;
  const [purchases, total] = await Promise.all([
    Purchase.find(query)
      .populate("vendorId", "companyName name phone")
      .populate("warehouseId", "name code")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Purchase.countDocuments(query),
  ]);

  return successResponse(purchases, "Purchases retrieved", {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(req: NextRequest) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.PURCHASES_CREATE
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  try {
    await connectDB();
    const body = await req.json();

    let warehouseId = body.warehouseId;
    if (!warehouseId) {
      const central = await Warehouse.findOne({ isCentral: true });
      warehouseId = central?._id;
    }

    if (!warehouseId) {
      return errorResponse("Warehouse ID is required", 400);
    }

    if (!body.vendorId || !body.items || body.items.length === 0) {
      return errorResponse("Vendor and items are required", 400);
    }

    const purchase = await PurchaseService.createPurchase({
      vendorId: body.vendorId,
      warehouseId,
      items: body.items,
      orderDate: body.orderDate ? new Date(body.orderDate) : undefined,
      expectedDate: body.expectedDate ? new Date(body.expectedDate) : undefined,
      notes: body.notes,
      createdBy: user.userId,
    });

    return successResponse(purchase, "Purchase order created successfully", undefined, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create purchase order";
    return errorResponse(msg, 500);
  }
}
