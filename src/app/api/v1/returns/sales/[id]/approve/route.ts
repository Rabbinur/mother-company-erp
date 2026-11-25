import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { requireAuth } from "@/lib/auth/session";
import { ReturnsService } from "@/services/ReturnsService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from "@/lib/utils/api-response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { id } = await params;
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // optional body
  }

  await connectDB();

  try {
    const approved = await ReturnsService.approveSalesReturn({
      returnId: id,
      decision: body.decision || "approve",
      rejectionReason: body.rejectionReason,
      actorId: user.userId,
    });

    return successResponse(approved, "Sales return approved and restocked");
  } catch (err: any) {
    return errorResponse(err.message || "Failed to approve sales return", 400);
  }
}
