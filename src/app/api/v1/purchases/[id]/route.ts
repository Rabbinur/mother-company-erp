import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Purchase } from "@/models/Purchase";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  successResponse,
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
    PERMISSIONS.PURCHASES_VIEW
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  const { id } = await params;
  await connectDB();

  const purchase = await Purchase.findById(id)
    .populate("vendorId", "companyName name phone email address taxVatNumber currentPayable")
    .populate("warehouseId", "name code address")
    .populate("createdBy", "name email")
    .lean();

  if (!purchase) return notFoundResponse("Purchase order not found");

  return successResponse(purchase);
}
