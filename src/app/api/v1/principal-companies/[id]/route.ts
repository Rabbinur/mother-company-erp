import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { assertBusinessAccess, TenancySecurityError } from "@/lib/auth/tenancy-guard";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { PrincipalCompanyService } from "@/services/PrincipalCompanyService";
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
      !hasPermission(tenancy.role, tenancy.user.customPermissions, PERMISSIONS.PRINCIPAL_COMPANIES_VIEW)
    ) {
      return forbiddenResponse();
    }

    const { id } = await params;
    const company = await PrincipalCompanyService.getById(tenancy.business._id, id);
    if (!company) {
      return notFoundResponse("Principal company not found");
    }

    return successResponse(company);
  } catch (err: unknown) {
    if (err instanceof TenancySecurityError) {
      return errorResponse(err.message, err.statusCode, null, err.code);
    }
    const msg = err instanceof Error ? err.message : "Failed to retrieve principal company";
    return errorResponse(msg, 500);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser(req);
    if (!session) return unauthorizedResponse();

    const tenancy = await assertBusinessAccess({
      tokenPayload: session,
      httpMethod: "PUT",
      requestPath: req.nextUrl.pathname,
      headers: Object.fromEntries(req.headers.entries()),
      requestedBusinessId: req.headers.get("x-business-id") || req.nextUrl.searchParams.get("businessId") || undefined,
    });

    if (
      !tenancy.isOwner &&
      tenancy.role !== "super_admin" &&
      !hasPermission(tenancy.role, tenancy.user.customPermissions, PERMISSIONS.PRINCIPAL_COMPANIES_MANAGE)
    ) {
      return forbiddenResponse();
    }

    const { id } = await params;
    const body = await req.json();
    const updated = await PrincipalCompanyService.update(
      tenancy.business._id,
      id,
      body,
      {
        userId: String(tenancy.user._id),
        email: tenancy.user.email,
      }
    );

    return successResponse(updated, "Principal company updated successfully");
  } catch (err: unknown) {
    if (err instanceof TenancySecurityError) {
      return errorResponse(err.message, err.statusCode, null, err.code);
    }
    const msg = err instanceof Error ? err.message : "Failed to update principal company";
    return errorResponse(msg, 400);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser(req);
    if (!session) return unauthorizedResponse();

    const tenancy = await assertBusinessAccess({
      tokenPayload: session,
      httpMethod: "DELETE",
      requestPath: req.nextUrl.pathname,
      headers: Object.fromEntries(req.headers.entries()),
      requestedBusinessId: req.headers.get("x-business-id") || req.nextUrl.searchParams.get("businessId") || undefined,
    });

    if (
      !tenancy.isOwner &&
      tenancy.role !== "super_admin" &&
      !hasPermission(tenancy.role, tenancy.user.customPermissions, PERMISSIONS.PRINCIPAL_COMPANIES_MANAGE)
    ) {
      return forbiddenResponse();
    }

    const { id } = await params;
    await PrincipalCompanyService.delete(tenancy.business._id, id, {
      userId: String(tenancy.user._id),
      email: tenancy.user.email,
    });

    return successResponse(null, "Principal company deleted successfully");
  } catch (err: unknown) {
    if (err instanceof TenancySecurityError) {
      return errorResponse(err.message, err.statusCode, null, err.code);
    }
    const msg = err instanceof Error ? err.message : "Failed to delete principal company";
    return errorResponse(msg, 400);
  }
}
