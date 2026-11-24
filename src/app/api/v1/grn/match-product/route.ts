import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { ProductMatcherService } from "@/services/ProductMatcherService";
import { requireAuth } from "@/lib/auth/session";
import {
  successResponse,
  unauthorizedResponse,
  errorResponse,
} from "@/lib/utils/api-response";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const body = await req.json();
  if (!body.rawName && !body.sku && !body.barcode) {
    return errorResponse("At least one search parameter (rawName, sku, barcode) is required", 400);
  }

  await connectDB();

  const result = await ProductMatcherService.matchLineItem(user.businessId, {
    rawName: body.rawName || "",
    sku: body.sku,
    barcode: body.barcode,
    uom: body.uom,
  });

  return successResponse(result);
}
