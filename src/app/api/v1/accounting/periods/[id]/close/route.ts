import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { AccountingService } from "@/services/AccountingService";
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
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.ACCOUNTS_MANAGE
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  try {
    await connectDB();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { notes } = body;

    const period = await AccountingService.closePeriod(id, user.userId, notes);
    return successResponse(period, "Accounting period closed successfully");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to close accounting period";
    return errorResponse(msg, 400);
  }
}
