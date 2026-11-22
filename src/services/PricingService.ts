import mongoose from "mongoose";
import { ProductVariant, IProductVariant } from "@/models/ProductVariant";
import { PriceHistory } from "@/models/PriceHistory";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";

export interface SanitizedVariant {
  _id: string;
  productId: string;
  variantName: string;
  sku: string;
  barcode?: string;
  attributes: Array<{ name: string; value: string }>;
  customerPrice: number;
  retailPrice: number;
  purchasePrice?: number; // omitted for unauthorized users
  image?: string;
  status: string;
  potentialMarginPercentage?: number;
}

export class PricingService {
  /**
   * Sanitizes a variant document, stripping purchasePrice if user lacks permission
   */
  static sanitizeVariant(
    variant: Record<string, unknown> | IProductVariant,
    userRole?: string,
    userPermissions?: string[]
  ): SanitizedVariant {
    const raw = (variant as IProductVariant).toObject
      ? (variant as IProductVariant).toObject()
      : (variant as Record<string, unknown>);

    const canViewPurchasePrice =
      userRole === "super_admin" ||
      (userRole &&
        hasPermission(
          userRole,
          userPermissions,
          PERMISSIONS.PRICING_VIEW_PURCHASE_PRICE
        ));

    const customerPrice = Number(raw.customerPrice || 0);
    const retailPrice = Number(raw.retailPrice || 0);
    const margin =
      retailPrice > 0
        ? Math.round(((retailPrice - customerPrice) / retailPrice) * 100 * 10) /
          10
        : 0;

    const sanitized: SanitizedVariant = {
      _id: String(raw._id),
      productId: String(raw.productId),
      variantName: String(raw.variantName || "Standard"),
      sku: String(raw.sku),
      barcode: raw.barcode ? String(raw.barcode) : undefined,
      attributes: (raw.attributes as Array<{ name: string; value: string }>) || [],
      customerPrice,
      retailPrice,
      image: raw.image ? String(raw.image) : undefined,
      status: String(raw.status || "active"),
      potentialMarginPercentage: margin,
    };

    if (canViewPurchasePrice) {
      sanitized.purchasePrice = Number(raw.purchasePrice || 0);
    }

    return sanitized;
  }

  /**
   * Update 3-level price for a variant with audit tracking
   */
  static async updatePrices(params: {
    productId: string | mongoose.Types.ObjectId;
    variantId: string | mongoose.Types.ObjectId;
    newPurchasePrice: number;
    newCustomerPrice: number;
    newRetailPrice: number;
    changedBy?: string | mongoose.Types.ObjectId;
    reason?: string;
    effectiveDate?: Date;
  }): Promise<IProductVariant> {
    const pId = new mongoose.Types.ObjectId(String(params.productId));
    const vId = new mongoose.Types.ObjectId(String(params.variantId));
    const uId = params.changedBy
      ? new mongoose.Types.ObjectId(String(params.changedBy))
      : undefined;

    const variant = await ProductVariant.findOne({ _id: vId, productId: pId });
    if (!variant) {
      throw new Error("Product variant not found");
    }

    // Record price history audit
    await PriceHistory.create({
      productId: pId,
      variantId: vId,
      oldPurchasePrice: variant.purchasePrice,
      newPurchasePrice: params.newPurchasePrice,
      oldCustomerPrice: variant.customerPrice,
      newCustomerPrice: params.newCustomerPrice,
      oldRetailPrice: variant.retailPrice,
      newRetailPrice: params.newRetailPrice,
      changedBy: uId,
      reason: params.reason || "Manual price revision",
      effectiveDate: params.effectiveDate || new Date(),
    });

    variant.purchasePrice = params.newPurchasePrice;
    variant.customerPrice = params.newCustomerPrice;
    variant.retailPrice = params.newRetailPrice;
    await variant.save();

    return variant;
  }
}
