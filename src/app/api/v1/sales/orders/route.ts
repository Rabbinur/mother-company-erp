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
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const { user, authorized } = await requirePermission(req, PERMISSIONS.ORDERS_VIEW);
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  const businessId = user.businessId;
  if (!businessId) return errorResponse("Business context required", 400);

  // Scoped to user's dealership unless global owner/admin
  let dealershipId = user.dealershipId || user.activeDealershipId;
  const searchParams = req.nextUrl.searchParams;
  const requestedDealership = searchParams.get("dealershipId");

  if (requestedDealership && (user.role === "owner" || user.role === "super_admin" || user.role === "admin")) {
    dealershipId = requestedDealership;
  }

  await connectDB();

  try {
    const result = await SalesOrderService.listSalesOrders({
      businessId,
      dealershipId,
      customerId: searchParams.get("customerId") || undefined,
      status: searchParams.get("status") || undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      search: searchParams.get("search") || undefined,
      page: parseInt(searchParams.get("page") || "1", 10),
      limit: parseInt(searchParams.get("limit") || "20", 10),
    });

    return successResponse(result.orders, "Sales orders retrieved successfully", result.pagination);
  } catch (err: any) {
    return errorResponse(err.message || "Failed to retrieve sales orders", 500);
  }
}

export async function POST(req: NextRequest) {
  const { user, authorized } = await requirePermission(req, PERMISSIONS.ORDERS_CREATE);
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  const businessId = user.businessId;
  if (!businessId) return errorResponse("Business context required", 400);

  let dealershipId = user.dealershipId || user.activeDealershipId;

  try {
    const body = await req.json();
    if (body.dealershipId && (user.role === "owner" || user.role === "super_admin" || user.role === "admin")) {
      dealershipId = body.dealershipId;
    }

    if (!dealershipId) return errorResponse("Dealership context required", 400);
    if (!body.customerId) return errorResponse("Customer is required", 400);
    if (!body.warehouseId) return errorResponse("Warehouse is required", 400);
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return errorResponse("Order must contain at least one line item", 400);
    }

    await connectDB();

    const idempotencyKey = req.headers.get("x-idempotency-key") || body.idempotencyKey;

    const order = await SalesOrderService.createSalesOrder({
      businessId,
      dealershipId,
      customerId: body.customerId,
      warehouseId: body.warehouseId,
      items: body.items,
      notes: body.notes,
      source: body.source || "admin_dashboard",
      salesmanId: body.salesmanId || user.userId,
      externalOrderId: body.externalOrderId,
      idempotencyKey,
      actorId: user.userId,
    });

    return successResponse(order, "Sales order created successfully in DRAFT", undefined, 201);
  } catch (err: any) {
    return errorResponse(err.message || "Failed to create sales order", 400);
  }
}
