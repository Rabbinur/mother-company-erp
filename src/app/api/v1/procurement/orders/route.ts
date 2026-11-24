import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { PurchaseOrderService } from "@/services/PurchaseOrderService";
import { requireAuth } from "@/lib/auth/session";
import { canUserViewPurchaseCost } from "@/lib/grn/cost-masking";
import {
  successResponse,
  unauthorizedResponse,
  errorResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  await connectDB();
  const { searchParams } = new URL(req.url);

  const businessId = user.businessId;
  const dealershipId = user.dealershipId || user.activeDealershipId;
  const status = searchParams.get("status") || undefined;
  const supplierId = searchParams.get("supplierId") || undefined;
  const warehouseId = searchParams.get("warehouseId") || undefined;
  const search = searchParams.get("search") || undefined;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  if (!businessId) {
    return errorResponse("Business context required", 400);
  }

  const result = await PurchaseOrderService.listPurchaseOrders({
    businessId,
    dealershipId: user.role === "super_admin" || user.role === "owner" ? undefined : dealershipId,
    status,
    supplierId,
    warehouseId,
    search,
    page,
    limit,
  });

  const canViewCost = canUserViewPurchaseCost(user);
  if (!canViewCost) {
    result.orders = result.orders.map((o: any) => {
      const copy = { ...o };
      delete copy.subtotal;
      delete copy.discountTotal;
      delete copy.grandTotal;
      delete copy.paidAmount;
      delete copy.balanceDue;
      if (copy.items) {
        copy.items = copy.items.map((it: any) => {
          const itCopy = { ...it };
          delete itCopy.unitCost;
          delete itCopy.discount;
          delete itCopy.subtotal;
          return itCopy;
        });
      }
      return copy;
    });
  }

  return successResponse(result);
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  try {
    const body = await req.json();
    const businessId = user.businessId || body.businessId;
    const dealershipId = user.dealershipId || user.activeDealershipId || body.dealershipId;

    if (!businessId) return errorResponse("Business context required", 400);
    if (!dealershipId) return errorResponse("Dealership context required", 400);
    if (!body.supplierId) return errorResponse("Supplier is required", 400);
    if (!body.warehouseId) return errorResponse("Warehouse is required", 400);
    if (!body.items || body.items.length === 0) {
      return errorResponse("Purchase Order must contain at least one line item", 400);
    }

    await connectDB();

    const po = await PurchaseOrderService.createPurchaseOrder({
      businessId,
      dealershipId,
      principalCompanyId: body.principalCompanyId,
      supplierId: body.supplierId,
      warehouseId: body.warehouseId,
      orderDate: body.orderDate,
      expectedDeliveryDate: body.expectedDeliveryDate,
      items: body.items,
      status: body.status,
      notes: body.notes,
      actorId: user.userId,
    });

    return successResponse(po, "Purchase Order created successfully", undefined, 201);
  } catch (err: any) {
    return errorResponse(err.message || "Failed to create Purchase Order", 400);
  }
}
