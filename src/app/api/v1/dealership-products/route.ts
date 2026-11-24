import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { getSessionUser, requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { DealershipProductService } from "@/services/DealershipProductService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return unauthorizedResponse();

  const searchParams = req.nextUrl.searchParams;
  const dealershipId = searchParams.get("dealershipId");

  if (!dealershipId) {
    return errorResponse("dealershipId query parameter is required", 400);
  }

  try {
    await connectDB();
    const principalCompanyId = searchParams.get("principalCompanyId") || undefined;
    const isAvailableParam = searchParams.get("isAvailable");
    const isAvailable =
      isAvailableParam !== null ? isAvailableParam === "true" : undefined;
    const search = searchParams.get("search") || undefined;

    const items = await DealershipProductService.getDealershipProducts({
      dealershipId,
      principalCompanyId,
      isAvailable,
      search,
      userRole: session.role,
      userPermissions: session.permissions,
    });

    return successResponse(items, "Dealership products retrieved");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to retrieve dealership products";
    return errorResponse(msg, 500);
  }
}

export async function POST(req: NextRequest) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.PRODUCTS_UPDATE
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  try {
    await connectDB();
    const body = await req.json();
    const { dealershipId, productId, productIds, principalCompanyId, isAvailable } = body;

    if (!dealershipId) {
      return errorResponse("dealershipId is required", 400);
    }

    const businessId = body.businessId || user.businessId;

    if (Array.isArray(productIds) && productIds.length > 0) {
      const result = await DealershipProductService.bulkAssign(
        businessId,
        dealershipId,
        productIds,
        user.userId
      );
      return successResponse(result, "Products assigned to dealership in bulk", undefined, 201);
    }

    if (!productId) {
      return errorResponse("productId or productIds array is required", 400);
    }

    const assigned = await DealershipProductService.assignProduct({
      businessId,
      dealershipId,
      productId,
      principalCompanyId,
      isAvailable,
      assignedBy: user.userId,
    });

    return successResponse(assigned, "Product assigned to dealership", undefined, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to assign product";
    return errorResponse(msg, 400);
  }
}

export async function PUT(req: NextRequest) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.PRODUCTS_UPDATE
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  try {
    await connectDB();
    const body = await req.json();
    const { dealershipId, productId, isAvailable } = body;

    if (!dealershipId || !productId || isAvailable === undefined) {
      return errorResponse("dealershipId, productId, and isAvailable are required", 400);
    }

    const updated = await DealershipProductService.setAvailability({
      dealershipId,
      productId,
      isAvailable: Boolean(isAvailable),
      actor: { userId: user.userId, email: user.email },
    });

    return successResponse(updated, "Product availability updated");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update availability";
    return errorResponse(msg, 400);
  }
}
