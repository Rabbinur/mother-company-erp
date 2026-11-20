import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Vendor } from "@/models/Vendor";
import { Purchase } from "@/models/Purchase";
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
    PERMISSIONS.VENDORS_VIEW
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  const { id } = await params;
  await connectDB();

  const vendor = await Vendor.findById(id).lean();
  if (!vendor) return notFoundResponse("Vendor not found");

  const [recentPurchases, recentPayments] = await Promise.all([
    Purchase.find({ vendorId: id })
      .sort({ orderDate: -1 })
      .limit(10)
      .lean(),
    Payment.find({ vendorId: id })
      .sort({ date: -1 })
      .limit(10)
      .lean(),
  ]);

  return successResponse({
    vendor,
    recentPurchases,
    recentPayments,
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.VENDORS_UPDATE
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  const { id } = await params;
  try {
    await connectDB();
    const vendor = await Vendor.findById(id);
    if (!vendor) return notFoundResponse("Vendor not found");

    const body = await req.json();
    if (body.name) vendor.name = body.name;
    if (body.companyName) vendor.companyName = body.companyName;
    if (body.phone) vendor.phone = body.phone;
    if (body.email !== undefined) vendor.email = body.email;
    if (body.address !== undefined) vendor.address = body.address;
    if (body.contactPerson !== undefined) vendor.contactPerson = body.contactPerson;
    if (body.taxVatNumber !== undefined) vendor.taxVatNumber = body.taxVatNumber;
    if (body.status) vendor.status = body.status;
    if (body.notes !== undefined) vendor.notes = body.notes;

    await vendor.save();

    await AuditService.log({
      actorId: user.userId,
      actorEmail: user.email,
      action: "VENDOR_UPDATED",
      entityType: "vendor",
      entityId: id,
      afterSnapshot: { companyName: vendor.companyName, status: vendor.status },
    });

    return successResponse(vendor, "Vendor updated successfully");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update vendor";
    return errorResponse(msg, 500);
  }
}
