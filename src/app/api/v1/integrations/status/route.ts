import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { getSessionUser } from "@/lib/auth/session";
import { IntegrationManagerService } from "@/services/integrations/IntegrationManagerService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorizedResponse();

  const businessId = user.businessId;
  if (!businessId) return errorResponse("Business context required", 400);

  try {
    await connectDB();
    const providers =
      await IntegrationManagerService.getProvidersOverview(businessId);

    const isOwnerOrAdmin =
      user.role === "super_admin" ||
      user.role === "owner" ||
      user.role === "admin" ||
      user.role === "business_owner";

    return successResponse(
      {
        providers,
        canManage: isOwnerOrAdmin,
      },
      "Integration provider statuses retrieved"
    );
  } catch (err: unknown) {
    const msg =
      err instanceof Error
        ? err.message
        : "Failed to load integration provider statuses";
    return errorResponse(msg, 500);
  }
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorizedResponse();

  const isOwnerOrAdmin =
    user.role === "super_admin" ||
    user.role === "owner" ||
    user.role === "admin" ||
    user.role === "business_owner";

  if (!isOwnerOrAdmin) {
    return forbiddenResponse(
      "Only Business Owner or Admin can modify integration settings"
    );
  }

  const businessId = user.businessId;
  if (!businessId) return errorResponse("Business context required", 400);

  try {
    await connectDB();
    const body = await req.json();
    const { providerType, enabled } = body;

    if (!providerType || typeof enabled !== "boolean") {
      return errorResponse(
        "Invalid payload: providerType and enabled (boolean) are required",
        400
      );
    }

    const updated = await IntegrationManagerService.toggleProvider({
      businessId,
      providerType,
      enabled,
      actorId: user.userId,
      actorEmail: user.email,
    });

    return successResponse(
      updated,
      `Integration ${providerType} set to ${enabled ? "ENABLED" : "DISABLED"}`
    );
  } catch (err: unknown) {
    const msg =
      err instanceof Error
        ? err.message
        : "Failed to update integration setting";
    return errorResponse(msg, 500);
  }
}
