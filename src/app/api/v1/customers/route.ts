import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { customerService } from "@/services/CustomerService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api-response";

/**
 * Single Responsibility: API Route Controller for Customer collection
 */
export async function GET(req: NextRequest) {
  const { user, authorized } = await requirePermission(req, PERMISSIONS.CUSTOMERS_VIEW);
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  try {
    await connectDB();
    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const district = searchParams.get("district") || "";
    const status = searchParams.get("status") || "";
    const customerType = searchParams.get("customerType") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const result = await customerService.list({
      search,
      district,
      status,
      customerType,
      page,
      limit,
    });

    return successResponse(result.items, "Customers retrieved", result.meta);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to retrieve customers";
    return errorResponse(msg, 500);
  }
}

export async function POST(req: NextRequest) {
  const { user, authorized } = await requirePermission(req, PERMISSIONS.CUSTOMERS_CREATE);
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  try {
    await connectDB();
    const body = await req.json();
    const { name, shopName, phone } = body;

    if (!name || !shopName || !phone) {
      return errorResponse("Customer Name, Shop Name, and Phone are required", 400);
    }

    const customer = await customerService.create(body, user.userId);
    return successResponse(customer, "Customer created successfully", undefined, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create customer";
    return errorResponse(msg, 400);
  }
}
