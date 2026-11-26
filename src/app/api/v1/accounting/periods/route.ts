import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { AccountingPeriod } from "@/models/AccountingPeriod";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { AccountingService } from "@/services/AccountingService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.ACCOUNTS_VIEW
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  await connectDB();
  const searchParams = req.nextUrl.searchParams;
  const businessId = searchParams.get("businessId") || user.businessId;
  const dealershipId = searchParams.get("dealershipId");

  const query: Record<string, unknown> = {};
  if (businessId) query.businessId = businessId;
  if (dealershipId) query.dealershipId = dealershipId;

  const periods = await AccountingPeriod.find(query)
    .sort({ startDate: -1 })
    .populate("closedBy", "name email")
    .lean();

  return successResponse(periods, "Accounting periods retrieved");
}

export async function POST(req: NextRequest) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.ACCOUNTS_MANAGE
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  try {
    await connectDB();
    const body = await req.json();
    const { periodName, startDate, endDate, businessId, dealershipId } = body;

    if (!periodName || !startDate || !endDate) {
      return errorResponse("Period name, start date, and end date are required", 400);
    }

    const period = await AccountingService.createPeriod({
      businessId: businessId || user.businessId,
      dealershipId,
      periodName,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      createdBy: user.userId,
    });

    return successResponse(period, "Accounting period created successfully", undefined, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create accounting period";
    return errorResponse(msg, 400);
  }
}
