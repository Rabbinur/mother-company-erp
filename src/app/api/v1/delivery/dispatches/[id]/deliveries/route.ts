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
  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON payload", 400);
  }

  if (!body.stops || !Array.isArray(body.stops)) {
    return errorResponse("stops array is required", 400);
  }

  await connectDB();

  try {
    const dispatch = await DispatchService.recordDeliveries({
      dispatchId: id,
      stops: body.stops,
      actorId: user.userId,
    });
    return successResponse(dispatch, "Deliveries recorded and sales fulfilled");
  } catch (err: any) {
    return errorResponse(err.message || "Failed to record deliveries", 400);
  }
}
