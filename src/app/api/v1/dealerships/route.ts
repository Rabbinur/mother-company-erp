import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { assertBusinessAccess, TenancySecurityError } from "@/lib/auth/tenancy-guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { DealershipService } from "@/services/DealershipService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) return unauthorizedResponse();

    const tenancy = await assertBusinessAccess({
      tokenPayload: session,
      httpMethod: "GET",
      requestPath: req.nextUrl.pathname,
      headers: Object.fromEntries(req.headers.entries()),
      requestedBusinessId: req.headers.get("x-business-id") || req.nextUrl.searchParams.get("businessId") || undefined,
    });

    if (
      !tenancy.isOwner &&
      tenancy.role !== "super_admin" &&
      !hasPermission(tenancy.role, tenancy.user.customPermissions, PERMISSIONS.DEALERSHIPS_VIEW)
    ) {
      return forbiddenResponse();
    }

    const { searchParams } = req.nextUrl;
    const search = searchParams.get("search") || undefined;
    const principalCompanyId = searchParams.get("principalCompanyId") || undefined;
    const status = searchParams.get("status") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const result = await DealershipService.list(tenancy.business._id, {
      search,
      principalCompanyId,
      status,
      page,
      limit,
    });

    return successResponse(result.items, "Dealerships retrieved successfully", {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    });
  } catch (err: unknown) {
    if (err instanceof TenancySecurityError) {
      return errorResponse(err.message, err.statusCode, null, err.code);
    }
    const msg = err instanceof Error ? err.message : "Failed to retrieve dealerships";
    return errorResponse(msg, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) return unauthorizedResponse();

    const tenancy = await assertBusinessAccess({
      tokenPayload: session,
      httpMethod: "POST",
      requestPath: req.nextUrl.pathname,
      headers: Object.fromEntries(req.headers.entries()),
      requestedBusinessId: req.headers.get("x-business-id") || req.nextUrl.searchParams.get("businessId") || undefined,
    });

    if (
      !tenancy.isOwner &&
      tenancy.role !== "super_admin" &&
      !hasPermission(tenancy.role, tenancy.user.customPermissions, PERMISSIONS.DEALERSHIPS_MANAGE)
    ) {
      return forbiddenResponse();
    }

    const body = await req.json();
    const dealership = await DealershipService.create(tenancy.business._id, body, {
      userId: String(tenancy.user._id),
      email: tenancy.user.email,
    });

    return successResponse(dealership, "Dealership created successfully", undefined, 201);
  } catch (err: unknown) {
    if (err instanceof TenancySecurityError) {
      return errorResponse(err.message, err.statusCode, null, err.code);
    }
    const msg = err instanceof Error ? err.message : "Failed to create dealership";
    return errorResponse(msg, 400);
  }
}
