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

  if (!hasPermission(user.role, user.permissions, PERMISSIONS.CLAIMS_APPROVE)) {
    return forbiddenResponse("Permission denied: cannot approve claims");
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
    const claim = await ReturnsService.approveClaim({
      claimId: id,
      approvedAmount: body.approvedAmount !== undefined ? Number(body.approvedAmount) : undefined,
      notes: body.notes,
      actorId: user.userId,
    });

    return successResponse(claim, "Claim approved successfully");
  } catch (err: any) {
    return errorResponse(err.message || "Failed to approve claim", 400);
  }
}
