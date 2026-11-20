import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Order } from "@/models/Order";
import { Warehouse } from "@/models/Warehouse";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { OrderService } from "@/services/OrderService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.ORDERS_VIEW
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  await connectDB();
  const searchParams = req.nextUrl.searchParams;
  const status = searchParams.get("status") || "";
  const customerId = searchParams.get("customerId") || "";
  const source = searchParams.get("source") || "";
  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  const query: Record<string, unknown> = {};
  if (status) query.orderStatus = status;
  if (customerId) query.customerId = customerId;
  if (source) query.source = source;
  if (search) {
    query.$or = [
      { orderNumber: { $regex: search, $options: "i" } },
      { externalOrderId: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;
  const [orders, total] = await Promise.all([
    Order.find(query)
      .populate("customerId", "shopName name phone district currentReceivable")
      .populate("warehouseId", "name code")
      .populate("salesmanId", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Order.countDocuments(query),
  ]);

  return successResponse(orders, "Orders retrieved", {
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

    let warehouseId = body.warehouseId;
    if (!warehouseId) {
      const central = await Warehouse.findOne({ isCentral: true });
      warehouseId = central?._id;
    }

    if (!warehouseId) {
      return errorResponse("Warehouse is required", 400);
    }

    if (!body.customerId || !body.items || body.items.length === 0) {
      return errorResponse("Customer and items are required", 400);
    }

    const order = await OrderService.createOrder({
      customerId: body.customerId,
      warehouseId,
      source: body.source || "admin_dashboard",
      externalOrderId: body.externalOrderId,
      idempotencyKey: body.idempotencyKey,
      items: body.items,
      salesmanId: body.salesmanId || user.userId,
      notes: body.notes,
      autoConfirmAndReserve: body.autoConfirmAndReserve ?? true,
      actorId: user.userId,
    });

    return successResponse(order, "Order created successfully", undefined, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create order";
    return errorResponse(msg, 500);
  }
}
