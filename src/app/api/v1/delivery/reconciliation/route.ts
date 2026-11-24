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
  const deliverymanId = url.searchParams.get("deliverymanId") || user.userId;
  const tripDate = url.searchParams.get("date") || undefined;

  await connectDB();

  try {
    const sheet = await DispatchService.getDeliverymanDailyStockSheet({
      deliverymanId,
      tripDate,
      businessId,
    });
    return successResponse(sheet, "Deliveryman daily stock reconciliation sheet retrieved");
  } catch (err: any) {
    return errorResponse(err.message || "Failed to retrieve stock sheet", 500);
  }
}
