import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { PurchaseReturn } from "@/models/PurchaseReturn";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { PurchaseReturnService } from "@/services/PurchaseReturnService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.PURCHASES_VIEW
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  await connectDB();
  const searchParams = req.nextUrl.searchParams;
  const vendorId = searchParams.get("vendorId");
  const purchaseId = searchParams.get("purchaseId");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  const query: Record<string, unknown> = {};
  if (vendorId) query.vendorId = vendorId;
  if (purchaseId) query.purchaseId = purchaseId;

  const skip = (page - 1) * limit;
  const [returns, total] = await Promise.all([
    PurchaseReturn.find(query)
      .populate("vendorId", "companyName name phone")
      .populate("warehouseId", "name code")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    PurchaseReturn.countDocuments(query),
  ]);

  return successResponse(returns, "Purchase returns retrieved", {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(req: NextRequest) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.PURCHASES_RETURN
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  try {
    await connectDB();
    const body = await req.json();
    const { purchaseId, items, reason, notes } = body;

    if (!purchaseId || !items || items.length === 0 || !reason) {
      return errorResponse("Purchase ID, items, and reason are required", 400);
    }

    const purchaseReturn = await PurchaseReturnService.processReturn({
      purchaseId,
      items,
      reason,
      notes,
      actorId: user.userId,
    });

    return successResponse(
      purchaseReturn,
      "Purchase return processed and stock deducted successfully",
      undefined,
      201
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to process purchase return";
    return errorResponse(msg, 500);
  }
}
