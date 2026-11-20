import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Payment } from "@/models/Payment";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { PaymentService } from "@/services/PaymentService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.PAYMENTS_VIEW
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  await connectDB();
  const searchParams = req.nextUrl.searchParams;
  const customerId = searchParams.get("customerId");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  const query: Record<string, unknown> = { paymentType: "customer_receipt" };
  if (customerId) query.customerId = customerId;

  const skip = (page - 1) * limit;
  const [payments, total] = await Promise.all([
    Payment.find(query)
      .populate("customerId", "shopName name phone")
      .populate("accountId", "name code")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Payment.countDocuments(query),
  ]);

  return successResponse(payments, "Customer payments retrieved", {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(req: NextRequest) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.PAYMENTS_CREATE
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  try {
    await connectDB();
    const body = await req.json();
    const {
      customerId,
      accountId,
      amount,
      paymentMethod,
      transactionReference,
      date,
      notes,
      idempotencyKey,
      allocations,
    } = body;

    if (!customerId || !accountId || !amount) {
      return errorResponse("Customer ID, Account ID, and Amount are required", 400);
    }

    const payment = await PaymentService.recordCustomerPayment({
      customerId,
      accountId,
      amount: Number(amount),
      paymentMethod: paymentMethod || "cash",
      transactionReference,
      date: date ? new Date(date) : undefined,
      notes,
      idempotencyKey,
      allocations,
      actorId: user.userId,
    });

    return successResponse(payment, "Customer payment recorded successfully", undefined, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to record customer payment";
    return errorResponse(msg, 500);
  }
}
