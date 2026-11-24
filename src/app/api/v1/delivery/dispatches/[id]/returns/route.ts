import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { requireAuth } from "@/lib/auth/session";
import { DispatchService } from "@/services/DispatchService";
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

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON payload", 400);
  }

  if (!body.returnId || !body.decision) {
    return errorResponse("returnId and decision ('approve' | 'reject') are required", 400);
  }

  await connectDB();

  try {
    const inspected = await DispatchService.approveSalesReturnInspection({
      returnId: body.returnId,
      decision: body.decision,
      condition: body.condition,
      notes: body.notes,
      actorId: user.userId,
    });
    return successResponse(inspected, "Sales return inspection processed successfully");
  } catch (err: any) {
    return errorResponse(err.message || "Failed to inspect sales return", 400);
  }
}
