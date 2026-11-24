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
    return forbiddenResponse("Unauthorized to view supplier payments");
  }

  await connectDB();
  const { searchParams } = new URL(req.url);

  const supplierId = searchParams.get("supplierId") || undefined;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  const result = await SupplierPaymentService.listPayments({
    supplierId,
    page,
    limit,
  });

  return successResponse(result);
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const canViewCost = canUserViewPurchaseCost(user);
  if (!canViewCost) {
    return forbiddenResponse("Unauthorized to disburse supplier payments");
  }

  try {
    const body = await req.json();
    const businessId = user.businessId || body.businessId;
    const dealershipId = user.dealershipId || user.activeDealershipId || body.dealershipId;

    if (!businessId) return errorResponse("Business context required", 400);
    if (!dealershipId) return errorResponse("Dealership context required", 400);
    if (!body.supplierId) return errorResponse("Supplier is required", 400);
    if (body.amount === undefined || body.amount < 0) {
      return errorResponse("Valid payment amount is required", 400);
    }

    await connectDB();

    let idempotencyKey: string | undefined = req.headers.get("x-idempotency-key") || undefined;
    if (body.idempotencyKey) idempotencyKey = body.idempotencyKey;

    const payment = await SupplierPaymentService.recordPayment({
      businessId,
      dealershipId,
      supplierId: body.supplierId,
      payableId: body.payableId,
      amount: body.amount,
      paymentMethod: body.paymentMethod || "bank_transfer",
      paymentDate: body.paymentDate,
      transactionReference: body.transactionReference,
      cashDiscountEarned: body.cashDiscountEarned,
      idempotencyKey,
      notes: body.notes,
      actorId: user.userId,
    });

    return successResponse(payment, "Payment recorded successfully", undefined, 201);
  } catch (err: any) {
    return errorResponse(err.message || "Failed to record payment", 400);
  }
}
