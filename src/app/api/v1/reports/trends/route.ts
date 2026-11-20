import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { ReportService } from "@/services/ReportService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.REPORTS_VIEW
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  try {
    await connectDB();
    const [monthlyTrends, topProducts] = await Promise.all([
      ReportService.getMonthlyTrends(),
      ReportService.getTopProducts(5),
    ]);

    return successResponse({
      monthlyTrends,
      topProducts,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load trends";
    return errorResponse(msg, 500);
  }
}
