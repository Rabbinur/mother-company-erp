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

  const { id } = await params;
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // optional body
  }

  await connectDB();

  try {
    const dispatch = await DispatchService.closeAndReconcileDispatch({
      dispatchId: id,
      cashDeposited: Number(body.cashDeposited || 0),
      notes: body.notes,
      actorId: user.userId,
    });
    return successResponse(dispatch, "Dispatch trip reconciled and closed successfully");
  } catch (err: any) {
    return errorResponse(err.message || "Failed to close and reconcile dispatch", 400);
  }
}
