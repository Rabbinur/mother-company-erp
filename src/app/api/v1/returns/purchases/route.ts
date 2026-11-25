import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { requireAuth } from "@/lib/auth/session";
import { ReturnsService } from "@/services/ReturnsService";
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
  const dealershipId = url.searchParams.get("dealershipId") || user.dealershipId || undefined;
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = parseInt(url.searchParams.get("limit") || "20", 10);

  await connectDB();

  try {
    const result = await ReturnsService.listPurchaseReturns({
      businessId,
      dealershipId,
      status,
      page,
      limit,
    });
    return successResponse(result, "Purchase returns retrieved successfully");
  } catch (err: any) {
    return errorResponse(err.message || "Failed to list purchase returns", 500);
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

  const dealershipId = body.dealershipId || user.dealershipId || user.activeDealershipId;
  if (!dealershipId || !body.grnId || !body.items || !Array.isArray(body.items)) {
    return errorResponse("dealershipId, grnId, and items array are required", 400);
  }

  await connectDB();

  try {
    const pr = await ReturnsService.createPurchaseReturn({
      businessId,
      dealershipId,
      grnId: body.grnId,
      items: body.items,
      reason: body.reason || "Supplier return",
      supplierAuthorizationRef: body.supplierAuthorizationRef,
      notes: body.notes,
      actorId: user.userId,
    });

    return successResponse(pr, "Purchase return created successfully", undefined, 201);
  } catch (err: any) {
    return errorResponse(err.message || "Failed to create purchase return", 400);
  }
}
