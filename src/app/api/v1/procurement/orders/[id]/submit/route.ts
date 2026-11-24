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
    const submitted = await PurchaseOrderService.submitPurchaseOrder(id, user.userId);
    return successResponse(submitted, "Purchase Order submitted successfully");
  } catch (err: any) {
    return errorResponse(err.message || "Failed to submit Purchase Order", 400);
  }
}
