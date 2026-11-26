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
  notFoundResponse,
} from "@/lib/utils/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  if (!hasPermission(user.role, user.permissions, PERMISSIONS.RETURNS_VIEW)) {
    return forbiddenResponse("Permission denied: cannot view sales return details");
  }

  const { id } = await params;
  await connectDB();

  try {
    const ret = await ReturnsService.getSalesReturnDetails(id, {
      role: user.role,
      dealershipId: user.dealershipId || user.activeDealershipId,
    });

    if (!ret) return notFoundResponse("Sales return record not found");
    return successResponse(ret, "Sales return details retrieved successfully");
  } catch (err: any) {
    return errorResponse(err.message || "Failed to fetch sales return details", 403);
  }
}
