import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { PurchaseOrderService } from "@/services/PurchaseOrderService";
import { requireAuth } from "@/lib/auth/session";
import {
  successResponse,
  unauthorizedResponse,
  errorResponse,
} from "@/lib/utils/api-response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { id } = await params;
  await connectDB();

  try {
    const body = await req.json();
    if (!body.reason || !body.reason.trim()) {
      return errorResponse("Cancellation reason is required", 400);
    }

    const cancelled = await PurchaseOrderService.cancelPurchaseOrder({
      poId: id,
      reason: body.reason.trim(),
      actorId: user.userId,
    });

    return successResponse(cancelled, "Purchase Order cancelled successfully");
  } catch (err: any) {
    return errorResponse(err.message || "Failed to cancel Purchase Order", 400);
  }
}
