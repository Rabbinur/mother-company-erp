import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { getSessionUser, requirePermission } from "@/lib/auth/session";
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
  const session = await getSessionUser(req);
  if (!session) return unauthorizedResponse();

  await connectDB();
  const searchParams = req.nextUrl.searchParams;
  const variantId = searchParams.get("variantId") || undefined;
  const productId = searchParams.get("productId") || undefined;
  const dealershipId = searchParams.get("dealershipId") || undefined;
  const isHistory = searchParams.get("history") === "true";

  try {
    if (isHistory || (!dealershipId && (variantId || productId))) {
      // Retrieve sanitized price history
      const history = await PricingService.getPriceHistory(
        {
          productId,
          variantId,
          dealershipId,
          businessId: session.businessId,
          limit: 50,
        },
        session.role,
        session.permissions
      );
      return successResponse(history, "Price history retrieved");
    }

    if (productId) {
      // Resolve active price (dealership override or base catalog)
      const resolved = await PricingService.resolveActivePrice({
        productId,
        variantId,
        dealershipId,
      });

      const canView = PricingService.canViewPurchasePrice(
        session.role,
        session.permissions
      );

      const responseData: Record<string, unknown> = {
        productId,
        variantId,
        dealershipId,
        customerPrice: resolved.customerPrice,
        retailPrice: resolved.retailPrice,
        currency: resolved.currency,
        priceSource: resolved.priceSource,
      };

      if (canView) {
        responseData.purchasePrice = resolved.purchasePrice;
      }

      return successResponse(responseData, "Active pricing resolved");
    }

    // Default: list recent price history
    const history = await PricingService.getPriceHistory(
      { businessId: session.businessId, limit: 50 },
      session.role,
      session.permissions
    );
    return successResponse(history, "Recent price history retrieved");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch pricing";
    return errorResponse(msg, 500);
  }
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
      dealershipId,
      newPurchasePrice,
      newCustomerPrice,
      newRetailPrice,
      purchasePrice,
      customerPrice,
      retailPrice,
      reason,
      effectiveDate,
      effectiveFrom,
      effectiveTo,
    } = body;

    if (!productId) {
      return errorResponse("Product ID is required", 400);
    }

    const pPrice = newPurchasePrice !== undefined ? newPurchasePrice : purchasePrice;
    const cPrice = newCustomerPrice !== undefined ? newCustomerPrice : customerPrice;
    const rPrice = newRetailPrice !== undefined ? newRetailPrice : retailPrice;

    if (pPrice === undefined || cPrice === undefined || rPrice === undefined) {
      return errorResponse(
        "All three prices (Purchase Price, Customer Price, and Retail Price) are required",
        400
      );
    }

    if (Number(cPrice) <= 0) {
      return errorResponse("Customer price must be greater than zero", 400);
    }

    if (dealershipId) {
      // Set dealership-specific price override
      const priceDoc = await PricingService.setDealershipPrice({
        businessId: body.businessId || user.businessId,
        dealershipId,
        productId,
        variantId,
        purchasePrice: Number(pPrice),
        customerPrice: Number(cPrice),
        retailPrice: Number(rPrice),
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : effectiveDate ? new Date(effectiveDate) : new Date(),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
        changedBy: user.userId,
        reason: reason || "Dealership price adjustment",
      });

      await AuditService.log({
        actorId: user.userId,
        actorEmail: user.email,
        action: "DEALERSHIP_PRICE_UPDATED",
        entityType: "price",
        entityId: String(priceDoc._id),
        afterSnapshot: {
          dealershipId,
          productId,
          variantId,
          customerPrice: cPrice,
          retailPrice: rPrice,
          reason,
        },
      });

      return successResponse(priceDoc, "Dealership price override set successfully");
    }

    // Otherwise update base catalog price on ProductVariant
    if (!variantId) {
      return errorResponse("Variant ID is required for catalog base price updates", 400);
    }

    const updatedVariant = await PricingService.updatePrices({
      productId,
      variantId,
      newPurchasePrice: Number(pPrice),
      newCustomerPrice: Number(cPrice),
      newRetailPrice: Number(rPrice),
      changedBy: user.userId,
      reason: reason || "Manual catalog price adjustment",
      effectiveDate: effectiveDate ? new Date(effectiveDate) : undefined,
    });

    await AuditService.log({
      actorId: user.userId,
      actorEmail: user.email,
      action: "CATALOG_PRICE_UPDATED",
      entityType: "price",
      entityId: String(variantId),
      afterSnapshot: {
        productId,
        variantId,
        newCustomerPrice: cPrice,
        newRetailPrice: rPrice,
        reason,
      },
    });

    const sanitized = PricingService.sanitizeVariant(
      updatedVariant,
      user.role,
      user.permissions
    );

    return successResponse(sanitized, "Base catalog price updated successfully");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update price";
    return errorResponse(msg, 500);
  }
}
