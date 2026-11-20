import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Order } from "@/models/Order";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/utils/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.ORDERS_VIEW
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  const { id } = await params;
  await connectDB();

  const order = await Order.findById(id)
    .populate("customerId", "shopName name phone email address district currentReceivable creditLimit")
    .populate("warehouseId", "name code address")
    .populate("salesmanId", "name email phone")
    .populate("reservationId", "reservationNumber status")
    .populate("createdBy", "name email")
    .lean();

  if (!order) return notFoundResponse("Order not found");

  return successResponse(order);
}
