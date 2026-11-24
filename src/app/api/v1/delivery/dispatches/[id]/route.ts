import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { requireAuth } from "@/lib/auth/session";
import { DispatchService } from "@/services/DispatchService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/utils/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { id } = await params;
  await connectDB();

  try {
    const dispatch = await DispatchService.getDispatchDetails(id, {
      role: user.role,
      permissions: user.permissions,
      dealershipId: user.dealershipId || user.activeDealershipId,
      userId: user.userId,
    });

    if (!dispatch) return notFoundResponse("Dispatch not found");

    return successResponse(dispatch, "Dispatch details retrieved successfully");
  } catch (err: any) {
    return errorResponse(err.message || "Failed to fetch dispatch details", 403);
  }
}
