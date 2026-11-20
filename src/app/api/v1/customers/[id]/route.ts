import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Customer } from "@/models/Customer";
import { Order } from "@/models/Order";
import { Payment } from "@/models/Payment";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { customerService } from "@/services/CustomerService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/utils/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, authorized } = await requirePermission(req, PERMISSIONS.CUSTOMERS_VIEW);
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  const { id } = await params;
  await connectDB();

  const customer = await customerService.getById(id);
  if (!customer) return notFoundResponse("Customer not found");

  const [recentOrders, recentPayments] = await Promise.all([
    Order.find({ customerId: id }).sort({ orderDate: -1 }).limit(10).lean(),
    Payment.find({ customerId: id }).sort({ date: -1 }).limit(10).lean(),
  ]);

  return successResponse({
    customer,
    recentOrders,
    recentPayments,
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, authorized } = await requirePermission(req, PERMISSIONS.CUSTOMERS_UPDATE);
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  const { id } = await params;
  try {
    await connectDB();
    const body = await req.json();
    const updated = await customerService.update(id, body, user.userId);
    if (!updated) return notFoundResponse("Customer not found");

    return successResponse(updated, "Customer updated successfully");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update customer";
    return errorResponse(msg, 400);
  }
}
