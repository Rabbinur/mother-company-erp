import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { PurchaseService } from "@/services/PurchaseService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api-response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.PURCHASES_RECEIVE
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  const { id } = await params;
  try {
    await connectDB();
    const body = await req.json();
    const { receivedItems } = body;

    if (!receivedItems || !Array.isArray(receivedItems) || receivedItems.length === 0) {
      return errorResponse("Array of received items is required", 400);
    }

    const updatedPurchase = await PurchaseService.receiveGoods({
      purchaseId: id,
      receivedItems,
      actorId: user.userId,
    });

    return successResponse(
      updatedPurchase,
      "Goods received and inventory updated successfully"
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to receive goods";
    return errorResponse(msg, 500);
  }
}
