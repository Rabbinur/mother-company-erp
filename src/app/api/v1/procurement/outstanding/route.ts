import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { SupplierPaymentService } from "@/services/SupplierPaymentService";
import { requireAuth } from "@/lib/auth/session";
import { canUserViewPurchaseCost } from "@/lib/grn/cost-masking";
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  errorResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const canViewCost = canUserViewPurchaseCost(user);
  if (!canViewCost) {
    return forbiddenResponse("Unauthorized to view outstanding financial balances");
  }

  const businessId = user.businessId;
  if (!businessId) {
    return errorResponse("Business context required", 400);
  }

  await connectDB();

  const report = await SupplierPaymentService.getOutstandingReport(businessId);
  return successResponse(report);
}
