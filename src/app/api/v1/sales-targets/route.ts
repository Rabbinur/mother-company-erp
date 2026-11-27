import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { requireAuth } from "@/lib/auth/session";
import { SalesTarget } from "@/models/SalesTarget";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const businessId = user.businessId;
  if (!businessId) return errorResponse("Business context required", 400);

  const scope = req.nextUrl.searchParams.get("scope");
  const period = req.nextUrl.searchParams.get("period");

  try {
    await connectDB();
    const filter: any = { businessId };
    if (scope) filter.scope = scope;
    if (period) filter.period = period;
    if (user.role === "salesman") filter.salesmanId = user.userId;

    const targets = await SalesTarget.find(filter).sort({ startDate: -1 });
    return successResponse(targets, "Sales targets retrieved successfully");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load targets";
    return errorResponse(msg, 500);
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const isManager =
    user.role === "super_admin" ||
    user.role === "owner" ||
    user.role === "admin" ||
    user.role === "manager";

  if (!isManager) {
    return forbiddenResponse("Only managers/admins can configure sales targets");
  }

  const businessId = user.businessId;
  if (!businessId) return errorResponse("Business context required", 400);

  try {
    await connectDB();
    const body = await req.json();
    const { title, scope, period, startDate, endDate, targetAmount, dealershipId, salesmanId } = body;

    if (!title || !scope || !period || !startDate || !endDate || !targetAmount) {
      return errorResponse("Missing required sales target parameters", 400);
    }

    const target = await SalesTarget.create({
      businessId,
      dealershipId,
      salesmanId,
      title,
      scope,
      period,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      targetAmount: Number(targetAmount),
      createdBy: user.userId,
    });

    return successResponse(target, "Sales target created successfully", undefined, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create sales target";
    return errorResponse(msg, 400);
  }
}
