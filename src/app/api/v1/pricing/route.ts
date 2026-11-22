import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { PriceHistory } from "@/models/PriceHistory";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { PricingService } from "@/services/PricingService";
import { AuditService } from "@/services/AuditService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.PRICING_UPDATE
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  await connectDB();
  const searchParams = req.nextUrl.searchParams;
  const variantId = searchParams.get("variantId");
  const productId = searchParams.get("productId");

  const query: Record<string, unknown> = {};
  if (variantId) query.variantId = variantId;
  if (productId) query.productId = productId;

  const history = await PriceHistory.find(query)
    .populate("productId", "name sku")
    .populate("variantId", "variantName sku")
    .populate("changedBy", "name email")
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return successResponse(history);
}

export async function PUT(req: NextRequest) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.PRICING_UPDATE
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  try {
    await connectDB();
    const body = await req.json();
    const {
      productId,
      variantId,
      newPurchasePrice,
      newCustomerPrice,
      newRetailPrice,
      reason,
      effectiveDate,
    } = body;

    if (!productId || !variantId) {
      return errorResponse("Product ID and Variant ID are required", 400);
    }

    if (
      newPurchasePrice === undefined ||
      newCustomerPrice === undefined ||
      newRetailPrice === undefined
    ) {
      return errorResponse(
        "All three prices (Purchase Price, Customer Price, and Retail Price) are required",
        400
      );
    }

    if (newCustomerPrice <= 0) {
      return errorResponse("Customer price must be greater than zero", 400);
    }

    const updatedVariant = await PricingService.updatePrices({
      productId,
      variantId,
      newPurchasePrice: Number(newPurchasePrice),
      newCustomerPrice: Number(newCustomerPrice),
      newRetailPrice: Number(newRetailPrice),
      changedBy: user.userId,
      reason: reason || "Manual price adjustment",
      effectiveDate: effectiveDate ? new Date(effectiveDate) : undefined,
    });

    await AuditService.log({
      actorId: user.userId,
      actorEmail: user.email,
      action: "PRICE_UPDATED",
      entityType: "price",
      entityId: String(variantId),
      afterSnapshot: {
        newPurchasePrice,
        newCustomerPrice,
        newRetailPrice,
        reason,
      },
    });

    const sanitized = PricingService.sanitizeVariant(
      updatedVariant,
      user.role,
      user.permissions
    );

    return successResponse(sanitized, "Price updated successfully");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update price";
    return errorResponse(msg, 500);
  }
}
