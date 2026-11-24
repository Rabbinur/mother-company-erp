import mongoose from "mongoose";
import { ProductVariant, type IProductVariant } from "@/models/ProductVariant";
import { DealershipPrice, type IDealershipPrice } from "@/models/DealershipPrice";
import { PriceHistory, type IPriceHistory } from "@/models/PriceHistory";
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
  purchasePrice?: number; // strictly omitted for unauthorized roles
  image?: string;
  status: string;
  potentialMarginPercentage?: number;
}

export interface IPriceSnapshot {
  productId: string;
  variantId?: string;
  dealershipId?: string;
  currency: string;
  purchasePrice?: number; // confidential acquisition cost (omitted if unauthorized)
  customerPrice: number; // dealership selling price
  retailPrice: number; // suggested retail price (MSRP)
  dealerMarginAmount?: number; // customerPrice - purchasePrice
  dealerMarginPercentage?: number;
  retailerMarginAmount: number; // retailPrice - customerPrice
  retailerMarginPercentage: number;
  priceSource: "dealership_override" | "catalog_base";
  snapshotAt: Date;
}

export interface SanitizedPriceHistory {
  _id: string;
  productId: string;
  variantId?: string;
  dealershipId?: string;
  oldCustomerPrice: number;
  newCustomerPrice: number;
  oldRetailPrice: number;
  newRetailPrice: number;
  oldPurchasePrice?: number; // omitted for unauthorized users
  newPurchasePrice?: number; // omitted for unauthorized users
  currency: string;
  changedBy?: unknown;
  reason?: string;
  effectiveDate: Date;
  createdAt: Date;
}

export class PricingService {
  /**
   * Authoritative check: returns true if user is authorized to view or edit Purchase Price.
   * Authorized: super_admin, owner, admin, manager, purchase_manager, accountant.
   * Unauthorized: sales_manager, sales_staff, cashier, delivery_staff, etc.
   */
  static canViewPurchasePrice(userRole?: string, userPermissions?: string[]): boolean {
    if (!userRole) return false;
    if (userRole === "super_admin" || userRole === "owner" || userRole === "admin") {
      return true;
    }
    return hasPermission(userRole, userPermissions, PERMISSIONS.PRICING_VIEW_PURCHASE_PRICE);
  }

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

    const canView = this.canViewPurchasePrice(userRole, userPermissions);

    const customerPrice = Number(raw.customerPrice || 0);
    const retailPrice = Number(raw.retailPrice || 0);
    const retailerProfit = retailPrice > 0 ? retailPrice - customerPrice : 0;
    const margin =
      retailPrice > 0
        ? Math.round((retailerProfit / retailPrice) * 100 * 10) / 10
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

    if (canView) {
      sanitized.purchasePrice = Number(raw.purchasePrice || 0);
    }

    return sanitized;
  }

  /**
   * Resolves the authoritative active pricing for a product / variant in a dealership context.
   * Precedence:
   * 1. Dealership-specific active override (DealershipPrice)
   * 2. Catalog base price (ProductVariant)
   */
  static async resolveActivePrice(params: {
    businessId?: string | mongoose.Types.ObjectId;
    dealershipId?: string | mongoose.Types.ObjectId;
    productId: string | mongoose.Types.ObjectId;
    variantId?: string | mongoose.Types.ObjectId;
  }): Promise<{
    purchasePrice: number;
    customerPrice: number;
    retailPrice: number;
    currency: string;
    priceSource: "dealership_override" | "catalog_base";
  }> {
    const pId = new mongoose.Types.ObjectId(String(params.productId));
    const vId = params.variantId ? new mongoose.Types.ObjectId(String(params.variantId)) : undefined;
    const dId = params.dealershipId ? new mongoose.Types.ObjectId(String(params.dealershipId)) : undefined;
    const now = new Date();

    // 1. Try DealershipPrice override if dealership context provided
    if (dId) {
      const overrideQuery: Record<string, unknown> = {
        dealershipId: dId,
        productId: pId,
        status: "active",
        effectiveFrom: { $lte: now },
        $or: [
          { effectiveTo: null },
          { effectiveTo: { $gte: now } },
          { effectiveTo: { $exists: false } },
        ],
      };
      if (vId) {
        overrideQuery.variantId = vId;
      }

      const override = await DealershipPrice.findOne(overrideQuery).sort({ effectiveFrom: -1 }).lean();
      if (override) {
        return {
          purchasePrice: override.purchasePrice,
          customerPrice: override.customerPrice,
          retailPrice: override.retailPrice,
          currency: override.currency || "BDT",
          priceSource: "dealership_override",
        };
      }
    }

    // 2. Fallback to catalog base price in ProductVariant
    let variant: IProductVariant | null = null;
    if (vId) {
      variant = await ProductVariant.findOne({ _id: vId, productId: pId });
    } else {
      variant = await ProductVariant.findOne({ productId: pId }).sort({ createdAt: 1 });
    }

    if (!variant) {
      throw new Error("No pricing found for the specified product and variant");
    }

    return {
      purchasePrice: variant.purchasePrice,
      customerPrice: variant.customerPrice,
      retailPrice: variant.retailPrice,
      currency: "BDT",
      priceSource: "catalog_base",
    };
  }

  /**
   * Creates an immutable Price Snapshot for downstream transactions (Orders, Invoices).
   * Automatically sanitizes confidential purchase prices for unauthorized user roles.
   */
  static async createPriceSnapshot(
    params: {
      businessId?: string | mongoose.Types.ObjectId;
      dealershipId?: string | mongoose.Types.ObjectId;
      productId: string | mongoose.Types.ObjectId;
      variantId?: string | mongoose.Types.ObjectId;
    },
    userRole?: string,
    userPermissions?: string[]
  ): Promise<IPriceSnapshot> {
    const resolved = await this.resolveActivePrice(params);
    const canView = this.canViewPurchasePrice(userRole, userPermissions);

    const retailerMarginAmount = Math.max(0, resolved.retailPrice - resolved.customerPrice);
    const retailerMarginPercentage =
      resolved.retailPrice > 0
        ? Math.round((retailerMarginAmount / resolved.retailPrice) * 100 * 10) / 10
        : 0;

    const dealerMarginAmount = Math.max(0, resolved.customerPrice - resolved.purchasePrice);
    const dealerMarginPercentage =
      resolved.customerPrice > 0
        ? Math.round((dealerMarginAmount / resolved.customerPrice) * 100 * 10) / 10
        : 0;

    const snapshot: IPriceSnapshot = {
      productId: String(params.productId),
      variantId: params.variantId ? String(params.variantId) : undefined,
      dealershipId: params.dealershipId ? String(params.dealershipId) : undefined,
      currency: resolved.currency,
      customerPrice: resolved.customerPrice,
      retailPrice: resolved.retailPrice,
      retailerMarginAmount,
      retailerMarginPercentage,
      priceSource: resolved.priceSource,
      snapshotAt: new Date(),
    };

    if (canView) {
      snapshot.purchasePrice = resolved.purchasePrice;
      snapshot.dealerMarginAmount = dealerMarginAmount;
      snapshot.dealerMarginPercentage = dealerMarginPercentage;
    }

    return snapshot;
  }

  /**
   * Set or override dealership-specific price with effective dating and audit logging
   */
  static async setDealershipPrice(params: {
    businessId: string | mongoose.Types.ObjectId;
    dealershipId: string | mongoose.Types.ObjectId;
    productId: string | mongoose.Types.ObjectId;
    variantId?: string | mongoose.Types.ObjectId;
    purchasePrice: number;
    customerPrice: number;
    retailPrice: number;
    effectiveFrom?: Date;
    effectiveTo?: Date | null;
    changedBy?: string | mongoose.Types.ObjectId;
    reason?: string;
  }): Promise<IDealershipPrice> {
    const bId = new mongoose.Types.ObjectId(String(params.businessId));
    const dId = new mongoose.Types.ObjectId(String(params.dealershipId));
    const pId = new mongoose.Types.ObjectId(String(params.productId));
    const vId = params.variantId ? new mongoose.Types.ObjectId(String(params.variantId)) : null;
    const uId = params.changedBy ? new mongoose.Types.ObjectId(String(params.changedBy)) : undefined;

    // Previous active price lookup for audit trail
    const previous = await DealershipPrice.findOne({
      dealershipId: dId,
      productId: pId,
      variantId: vId,
      status: "active",
    }).sort({ effectiveFrom: -1 });

    const oldPurchase = previous ? previous.purchasePrice : 0;
    const oldCustomer = previous ? previous.customerPrice : 0;
    const oldRetail = previous ? previous.retailPrice : 0;

    const newDealershipPrice = await DealershipPrice.create({
      businessId: bId,
      dealershipId: dId,
      productId: pId,
      variantId: vId,
      purchasePrice: params.purchasePrice,
      customerPrice: params.customerPrice,
      retailPrice: params.retailPrice,
      currency: "BDT",
      effectiveFrom: params.effectiveFrom || new Date(),
      effectiveTo: params.effectiveTo || null,
      status: "active",
      createdBy: uId,
    });

    // Record immutable audit history
    await PriceHistory.create({
      businessId: bId,
      dealershipId: dId,
      productId: pId,
      variantId: vId,
      oldPurchasePrice: oldPurchase,
      newPurchasePrice: params.purchasePrice,
      oldCustomerPrice: oldCustomer,
      newCustomerPrice: params.customerPrice,
      oldRetailPrice: oldRetail,
      newRetailPrice: params.retailPrice,
      currency: "BDT",
      changedBy: uId,
      reason: params.reason || "Dealership price override set",
      effectiveDate: params.effectiveFrom || new Date(),
    });

    return newDealershipPrice;
  }

  /**
   * Update catalog base prices on ProductVariant with audit history
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
    const uId = params.changedBy ? new mongoose.Types.ObjectId(String(params.changedBy)) : undefined;

    const variant = await ProductVariant.findOne({ _id: vId, productId: pId });
    if (!variant) {
      throw new Error("Product variant not found");
    }

    // Record immutable price history audit
    await PriceHistory.create({
      businessId: variant.businessId,
      productId: pId,
      variantId: vId,
      oldPurchasePrice: variant.purchasePrice,
      newPurchasePrice: params.newPurchasePrice,
      oldCustomerPrice: variant.customerPrice,
      newCustomerPrice: params.newCustomerPrice,
      oldRetailPrice: variant.retailPrice,
      newRetailPrice: params.newRetailPrice,
      currency: "BDT",
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

  /**
   * Retrieve price history audit trail sanitized according to requester's permissions
   */
  static async getPriceHistory(
    params: {
      productId?: string | mongoose.Types.ObjectId;
      variantId?: string | mongoose.Types.ObjectId;
      dealershipId?: string | mongoose.Types.ObjectId;
      businessId?: string | mongoose.Types.ObjectId;
      limit?: number;
    },
    userRole?: string,
    userPermissions?: string[]
  ): Promise<SanitizedPriceHistory[]> {
    const query: Record<string, unknown> = {};
    if (params.productId) query.productId = new mongoose.Types.ObjectId(String(params.productId));
    if (params.variantId) query.variantId = new mongoose.Types.ObjectId(String(params.variantId));
    if (params.dealershipId) query.dealershipId = new mongoose.Types.ObjectId(String(params.dealershipId));
    if (params.businessId) query.businessId = new mongoose.Types.ObjectId(String(params.businessId));

    const history = await PriceHistory.find(query)
      .populate("productId", "name sku")
      .populate("variantId", "variantName sku")
      .populate("changedBy", "name email")
      .sort({ createdAt: -1 })
      .limit(params.limit || 50)
      .lean();

    const canView = this.canViewPurchasePrice(userRole, userPermissions);

    return history.map((record) => {
      const item: SanitizedPriceHistory = {
        _id: String(record._id),
        productId: String(record.productId),
        variantId: record.variantId ? String(record.variantId) : undefined,
        dealershipId: record.dealershipId ? String(record.dealershipId) : undefined,
        oldCustomerPrice: record.oldCustomerPrice,
        newCustomerPrice: record.newCustomerPrice,
        oldRetailPrice: record.oldRetailPrice,
        newRetailPrice: record.newRetailPrice,
        currency: record.currency || "BDT",
        changedBy: record.changedBy,
        reason: record.reason,
        effectiveDate: record.effectiveDate,
        createdAt: record.createdAt,
      };

      if (canView) {
        item.oldPurchasePrice = record.oldPurchasePrice;
        item.newPurchasePrice = record.newPurchasePrice;
      }

      return item;
    });
  }
}
