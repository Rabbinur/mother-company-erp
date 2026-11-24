import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { requireAuth } from "@/lib/auth/session";
import { DispatchService } from "@/services/DispatchService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const businessId = user.businessId;
  if (!businessId) return errorResponse("Business context required", 400);

  const url = req.nextUrl;
  const status = url.searchParams.get("status") || undefined;
  const deliverymanId = url.searchParams.get("deliverymanId") || undefined;
  const vehicleId = url.searchParams.get("vehicleId") || undefined;
  const dealershipId = url.searchParams.get("dealershipId") || user.dealershipId || undefined;
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = parseInt(url.searchParams.get("limit") || "20", 10);

  await connectDB();

  try {
    const result = await DispatchService.listDispatches({
      businessId,
      dealershipId,
      status,
      deliverymanId,
      vehicleId,
      page,
      limit,
    });
    return successResponse(result, "Dispatches retrieved successfully");
  } catch (err: any) {
    return errorResponse(err.message || "Failed to list dispatches", 500);
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const businessId = user.businessId;
  if (!businessId) return errorResponse("Business context required", 400);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON payload", 400);
  }

  if (!body.warehouseId || !body.orderIds || !Array.isArray(body.orderIds) || body.orderIds.length === 0) {
    return errorResponse("warehouseId and non-empty orderIds array are required", 400);
  }

  await connectDB();

  try {
    const dispatch = await DispatchService.createDispatch({
      businessId,
      warehouseId: body.warehouseId,
      orderIds: body.orderIds,
      vehicleId: body.vehicleId,
      deliverymanId: body.deliverymanId,
      tripDate: body.tripDate ? new Date(body.tripDate) : undefined,
      actorId: user.userId,
    });

    return successResponse(dispatch, "Dispatch trip created successfully", undefined, 201);
  } catch (err: any) {
    return errorResponse(err.message || "Failed to create dispatch", 400);
  }
}
