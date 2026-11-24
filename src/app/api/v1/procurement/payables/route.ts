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
    return forbiddenResponse("Unauthorized to view financial payables");
  }

  await connectDB();
  const { searchParams } = new URL(req.url);

  const businessId = user.businessId;
  const dealershipId = user.dealershipId || user.activeDealershipId;
  const supplierId = searchParams.get("supplierId") || undefined;
  const status = searchParams.get("status") || undefined;
  const search = searchParams.get("search") || undefined;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  if (!businessId) {
    return errorResponse("Business context required", 400);
  }

  const result = await SupplierPaymentService.listPayables({
    businessId,
    dealershipId: user.role === "super_admin" || user.role === "owner" ? undefined : dealershipId,
    supplierId,
    status,
    search,
    page,
    limit,
  });

  return successResponse(result);
}
