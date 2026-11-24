import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { SupplierService } from "@/services/SupplierService";
import { requireAuth } from "@/lib/auth/session";
import { canUserViewPurchaseCost } from "@/lib/grn/cost-masking";
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  errorResponse,
} from "@/lib/utils/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { id } = await params;
  await connectDB();

  try {
    const data = await SupplierService.getSupplierDetails(id, user.businessId);
    const canViewCost = canUserViewPurchaseCost(user);
    if (!canViewCost) {
      delete (data.supplier as any).openingBalance;
      delete (data.supplier as any).currentPayable;
      delete (data.metrics as any).currentPayable;
      delete (data.metrics as any).openingBalance;
    }

    return successResponse(data);
  } catch (err: any) {
    return notFoundResponse(err.message || "Supplier not found");
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { id } = await params;
  await connectDB();

  try {
    const body = await req.json();
    const updated = await SupplierService.updateSupplier(id, body);
    return successResponse(updated, "Supplier updated successfully");
  } catch (err: any) {
    return errorResponse(err.message || "Failed to update supplier", 400);
  }
}
