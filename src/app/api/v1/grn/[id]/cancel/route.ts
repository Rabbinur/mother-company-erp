import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { GoodsReceiptNoteService } from "@/services/GoodsReceiptNoteService";
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

    const cancelled = await GoodsReceiptNoteService.cancelGrn({
      grnId: id,
      reason: body.reason.trim(),
      actorId: user.userId,
    });

    return successResponse({
      message: `GRN ${cancelled.grnNumber} has been cancelled`,
      grn: cancelled,
    });
  } catch (err: any) {
    return errorResponse(err.message || "Failed to cancel GRN", 400);
  }
}
