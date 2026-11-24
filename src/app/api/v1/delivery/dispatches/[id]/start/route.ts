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
  await connectDB();

  try {
    const dispatch = await DispatchService.startDispatch(id, user.userId);
    return successResponse(dispatch, "Dispatch trip started successfully");
  } catch (err: any) {
    return errorResponse(err.message || "Failed to start dispatch trip", 400);
  }
}
