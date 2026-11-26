import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { requireAuth } from "@/lib/auth/session";
import { ReturnsService } from "@/services/ReturnsService";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
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
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  if (
    !hasPermission(user.role, user.permissions, PERMISSIONS.PURCHASES_RETURN) &&
    !hasPermission(user.role, user.permissions, PERMISSIONS.ACCOUNTS_MANAGE)
  ) {
    return forbiddenResponse("Permission denied: cannot settle purchase returns");
  }

  const { id } = await params;
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // optional body
  }

  await connectDB();

  try {
    const settled = await ReturnsService.settlePurchaseReturn({
      returnId: id,
      settlementType: body.settlementType || "payable_deduction",
      creditNoteNumber: body.creditNoteNumber,
      settledAmount: body.settledAmount,
      actorId: user.userId,
    });

    return successResponse(settled, "Purchase return settled and supplier payable adjusted");
  } catch (err: any) {
    return errorResponse(err.message || "Failed to settle purchase return", 400);
  }
}
