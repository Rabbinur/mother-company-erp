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

  if (!hasPermission(user.role, user.permissions, PERMISSIONS.PURCHASES_RETURN)) {
    return forbiddenResponse("Permission denied: cannot dispatch purchase returns");
  }

  const { id } = await params;
  await connectDB();

  try {
    const dispatched = await ReturnsService.dispatchPurchaseReturn({
      returnId: id,
      actorId: user.userId,
    });

    return successResponse(dispatched, "Purchase return dispatched to supplier and stock removed");
  } catch (err: any) {
    return errorResponse(err.message || "Failed to dispatch purchase return", 400);
  }
}
