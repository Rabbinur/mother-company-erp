import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Purchase } from "@/models/Purchase";
import { Payment } from "@/models/Payment";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { vendorService } from "@/services/VendorService";
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
  const { user, authorized } = await requirePermission(req, PERMISSIONS.VENDORS_VIEW);
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  const { id } = await params;
  await connectDB();

  const vendor = await vendorService.getById(id);
  if (!vendor) return notFoundResponse("Vendor not found");

  const [recentPurchases, recentPayments] = await Promise.all([
    Purchase.find({ vendorId: id }).sort({ orderDate: -1 }).limit(10).lean(),
    Payment.find({ vendorId: id }).sort({ date: -1 }).limit(10).lean(),
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
  const { user, authorized } = await requirePermission(req, PERMISSIONS.VENDORS_UPDATE);
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  const { id } = await params;
  try {
    await connectDB();
    const body = await req.json();
    const updated = await vendorService.update(id, body, user.userId);
    if (!updated) return notFoundResponse("Vendor not found");

    return successResponse(updated, "Vendor updated successfully");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update vendor";
    return errorResponse(msg, 400);
  }
}
