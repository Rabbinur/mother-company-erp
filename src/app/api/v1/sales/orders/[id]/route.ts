import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { SalesOrderService } from "@/services/SalesOrderService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/utils/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, authorized } = await requirePermission(req, PERMISSIONS.ORDERS_VIEW);
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  const { id } = await params;
  if (!id) return errorResponse("Order ID is required", 400);

  await connectDB();

  try {
    const order = await SalesOrderService.getSalesOrderDetails(id, {
      role: user.role,
      permissions: user.permissions,
      dealershipId: user.dealershipId || user.activeDealershipId,
    });

    if (!order) return notFoundResponse("Sales order not found");

    return successResponse(order, "Sales order details retrieved");
  } catch (err: any) {
    if (err.message?.includes("Cross-dealership")) {
      return forbiddenResponse(err.message);
    }
    return errorResponse(err.message || "Failed to retrieve sales order", 500);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, authorized } = await requirePermission(req, PERMISSIONS.ORDERS_CREATE);
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  const { id } = await params;
  if (!id) return errorResponse("Order ID is required", 400);

  try {
    const body = await req.json();
    await connectDB();

    const order = await SalesOrderService.updateDraftOrder(id, {
      warehouseId: body.warehouseId,
      items: body.items,
      notes: body.notes,
      actorId: user.userId,
    });

    return successResponse(order, "Draft sales order updated successfully");
  } catch (err: any) {
    return errorResponse(err.message || "Failed to update draft order", 400);
  }
}
