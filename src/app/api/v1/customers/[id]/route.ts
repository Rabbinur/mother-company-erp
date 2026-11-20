import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Customer } from "@/models/Customer";
import { Order } from "@/models/Order";
import { Payment } from "@/models/Payment";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { AuditService } from "@/services/AuditService";
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
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.CUSTOMERS_VIEW
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  const { id } = await params;
  await connectDB();

  const customer = await Customer.findById(id).lean();
  if (!customer) return notFoundResponse("Customer not found");

  const [recentOrders, recentPayments] = await Promise.all([
    Order.find({ customerId: id })
      .sort({ orderDate: -1 })
      .limit(10)
      .lean(),
    Payment.find({ customerId: id })
      .sort({ date: -1 })
      .limit(10)
      .lean(),
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
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.CUSTOMERS_UPDATE
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  const { id } = await params;
  try {
    await connectDB();
    const customer = await Customer.findById(id);
    if (!customer) return notFoundResponse("Customer not found");

    const body = await req.json();
    if (body.name) customer.name = body.name;
    if (body.shopName) customer.shopName = body.shopName;
    if (body.ownerName !== undefined) customer.ownerName = body.ownerName;
    if (body.phone) customer.phone = body.phone;
    if (body.email !== undefined) customer.email = body.email;
    if (body.address !== undefined) customer.address = body.address;
    if (body.district !== undefined) customer.district = body.district;
    if (body.area !== undefined) customer.area = body.area;
    if (body.customerType) customer.customerType = body.customerType;
    if (body.creditLimit !== undefined) customer.creditLimit = Number(body.creditLimit);
    if (body.status) customer.status = body.status;
    if (body.notes !== undefined) customer.notes = body.notes;

    await customer.save();

    await AuditService.log({
      actorId: user.userId,
      actorEmail: user.email,
      action: "CUSTOMER_UPDATED",
      entityType: "customer",
      entityId: id,
      afterSnapshot: { shopName: customer.shopName, creditLimit: customer.creditLimit },
    });

    return successResponse(customer, "Customer updated successfully");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update customer";
    return errorResponse(msg, 500);
  }
}
