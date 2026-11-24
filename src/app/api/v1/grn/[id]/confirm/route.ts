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
    let idempotencyKey: string | undefined = req.headers.get("x-idempotency-key") || undefined;
    try {
      const body = await req.json();
      if (body && body.idempotencyKey) {
        idempotencyKey = body.idempotencyKey;
      }
    } catch {
      // Body may be empty
    }

    const verified = await GoodsReceiptNoteService.confirmGrn({
      grnId: id,
      idempotencyKey,
      actorId: user.userId,
    });

    const canViewCost = canUserViewPurchaseCost(user);
    return successResponse({
      message: `GRN ${verified.grnNumber} confirmed and verified successfully. Physical stock and batch cost layers updated.`,
      grn: maskGrnCosts(verified.toObject(), canViewCost),
    });
  } catch (err: any) {
    return errorResponse(err.message || "Failed to confirm GRN", 400);
  }
}
