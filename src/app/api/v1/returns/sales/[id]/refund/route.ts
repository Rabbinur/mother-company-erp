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

  if (!hasPermission(user.role, user.permissions, PERMISSIONS.RETURNS_REFUND)) {
    return forbiddenResponse("Permission denied: cannot process customer refunds");
  }

  const { id } = await params;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON payload", 400);
  }

  await connectDB();

  try {
    const refunded = await ReturnsService.processCustomerRefund({
      returnId: id,
      refundMethod: body.refundMethod || "credit_note",
      refundAmount: body.refundAmount !== undefined ? Number(body.refundAmount) : undefined,
      reference: body.reference,
      actorId: user.userId,
    });

    return successResponse(refunded, "Customer refund / credit note processed successfully");
  } catch (err: any) {
    return errorResponse(err.message || "Failed to process customer refund", 400);
  }
}
