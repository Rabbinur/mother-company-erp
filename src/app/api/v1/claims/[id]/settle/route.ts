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

  if (!hasPermission(user.role, user.permissions, PERMISSIONS.CLAIMS_SETTLE)) {
    return forbiddenResponse("Permission denied: cannot settle claims");
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
    const claim = await ReturnsService.settleClaim({
      claimId: id,
      settlementRef: body.settlementRef,
      settledAmount: body.settledAmount !== undefined ? Number(body.settledAmount) : undefined,
      notes: body.notes,
      actorId: user.userId,
    });

    return successResponse(claim, "Claim settled and reconciled successfully");
  } catch (err: any) {
    return errorResponse(err.message || "Failed to settle claim", 400);
  }
}
