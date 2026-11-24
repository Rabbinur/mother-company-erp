import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { GoodsReceiptNoteService } from "@/services/GoodsReceiptNoteService";
import { requireAuth } from "@/lib/auth/session";
import { canUserViewPurchaseCost, maskGrnCosts } from "@/lib/grn/cost-masking";
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
    const updated = await GoodsReceiptNoteService.triggerOcr(id, user.userId);
    const canViewCost = canUserViewPurchaseCost(user);
    return successResponse(maskGrnCosts(updated.toObject(), canViewCost));
  } catch (err: any) {
    return errorResponse(err.message || "Failed to execute OCR on document", 400);
  }
}
