import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { vendorService } from "@/services/VendorService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api-response";

/**
 * Single Responsibility: API Route Controller for Vendor collection
 */
export async function GET(req: NextRequest) {
  const { user, authorized } = await requirePermission(req, PERMISSIONS.VENDORS_VIEW);
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  try {
    await connectDB();
    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const result = await vendorService.list({
      search,
      status,
      page,
      limit,
    });

    return successResponse(result.items, "Vendors retrieved", result.meta);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to retrieve vendors";
    return errorResponse(msg, 500);
  }
}

export async function POST(req: NextRequest) {
  const { user, authorized } = await requirePermission(req, PERMISSIONS.VENDORS_CREATE);
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  try {
    await connectDB();
    const body = await req.json();
    const { name, companyName, phone } = body;

    if (!name || !companyName || !phone) {
      return errorResponse("Vendor Name, Company Name, and Phone are required", 400);
    }

    const vendor = await vendorService.create(body, user.userId);
    return successResponse(vendor, "Vendor created successfully", undefined, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create vendor";
    return errorResponse(msg, 400);
  }
}
