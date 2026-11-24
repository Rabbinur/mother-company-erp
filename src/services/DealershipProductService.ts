import mongoose from "mongoose";
import { DealershipProduct, type IDealershipProduct } from "@/models/DealershipProduct";
import { Product } from "@/models/Product";
import { ProductVariant } from "@/models/ProductVariant";
import { AuditService } from "@/services/AuditService";
import { PricingService } from "@/services/PricingService";

export interface AssignProductInput {
  businessId: string | mongoose.Types.ObjectId;
  dealershipId: string | mongoose.Types.ObjectId;
  productId: string | mongoose.Types.ObjectId;
  principalCompanyId?: string | mongoose.Types.ObjectId | null;
  isAvailable?: boolean;
  assignedBy?: string | mongoose.Types.ObjectId;
}

export class DealershipProductService {
  /**
   * Assign a product to a dealership without duplicating catalog records
   */
  static async assignProduct(input: AssignProductInput): Promise<IDealershipProduct> {
    const bId = new mongoose.Types.ObjectId(String(input.businessId));
    const dId = new mongoose.Types.ObjectId(String(input.dealershipId));
    const pId = new mongoose.Types.ObjectId(String(input.productId));

    // Verify product exists and belongs to business
    const product = await Product.findById(pId);
    if (!product) {
      throw new Error("Product not found");
    }

    // Determine principal company from product if not explicitly provided
    const principalCompanyId = input.principalCompanyId
      ? new mongoose.Types.ObjectId(String(input.principalCompanyId))
      : product.principalCompanyId || null;

    const existing = await DealershipProduct.findOne({
      dealershipId: dId,
      productId: pId,
    });

    if (existing) {
      existing.isAvailable = input.isAvailable !== undefined ? input.isAvailable : true;
      existing.status = "active";
      if (principalCompanyId) existing.principalCompanyId = principalCompanyId;
      await existing.save();
      return existing;
    }

    const created = await DealershipProduct.create({
      businessId: bId,
      dealershipId: dId,
      productId: pId,
      principalCompanyId,
      isAvailable: input.isAvailable !== undefined ? input.isAvailable : true,
      status: "active",
      assignedAt: new Date(),
      assignedBy: input.assignedBy ? new mongoose.Types.ObjectId(String(input.assignedBy)) : undefined,
    });

    return created;
  }

  /**
   * Bulk assign multiple products to a dealership
   */
  static async bulkAssign(
    businessId: string | mongoose.Types.ObjectId,
    dealershipId: string | mongoose.Types.ObjectId,
    productIds: Array<string | mongoose.Types.ObjectId>,
    assignedBy?: string | mongoose.Types.ObjectId
  ): Promise<{ assignedCount: number; productIds: string[] }> {
    const results: string[] = [];
    for (const pId of productIds) {
      const assigned = await this.assignProduct({
        businessId,
        dealershipId,
        productId: pId,
        assignedBy,
      });
      results.push(String(assigned.productId));
    }
    return { assignedCount: results.length, productIds: results };
  }

  /**
   * Toggle product availability for a specific dealership
   */
  static async setAvailability(params: {
    dealershipId: string | mongoose.Types.ObjectId;
    productId: string | mongoose.Types.ObjectId;
    isAvailable: boolean;
    actor?: { userId?: string; email?: string };
  }): Promise<IDealershipProduct> {
    const dId = new mongoose.Types.ObjectId(String(params.dealershipId));
    const pId = new mongoose.Types.ObjectId(String(params.productId));

    const item = await DealershipProduct.findOne({
      dealershipId: dId,
      productId: pId,
    });

    if (!item) {
      throw new Error("Product is not assigned to this dealership");
    }

    item.isAvailable = params.isAvailable;
    item.status = params.isAvailable ? "active" : "inactive";
    await item.save();

    if (params.actor?.userId) {
      await AuditService.log({
        actorId: params.actor.userId,
        actorEmail: params.actor.email,
        action: "DEALERSHIP_PRODUCT_AVAILABILITY_CHANGED",
        entityType: "dealership_product",
        entityId: String(item._id),
        afterSnapshot: {
          dealershipId: String(dId),
          productId: String(pId),
          isAvailable: item.isAvailable,
        },
      });
    }

    return item;
  }

  /**
   * Get products available for a dealership with role-based variant sanitization
   */
  static async getDealershipProducts(params: {
    dealershipId: string | mongoose.Types.ObjectId;
    businessId?: string | mongoose.Types.ObjectId;
    principalCompanyId?: string | mongoose.Types.ObjectId;
    isAvailable?: boolean;
    search?: string;
    userRole?: string;
    userPermissions?: string[];
  }): Promise<Record<string, unknown>[]> {
    const dId = new mongoose.Types.ObjectId(String(params.dealershipId));
    const query: Record<string, unknown> = {
      dealershipId: dId,
      status: "active",
    };

    if (params.isAvailable !== undefined) {
      query.isAvailable = params.isAvailable;
    }
    if (params.principalCompanyId) {
      query.principalCompanyId = new mongoose.Types.ObjectId(String(params.principalCompanyId));
    }

    const assignments = await DealershipProduct.find(query)
      .populate({
        path: "productId",
        match: { status: "active" },
        populate: [
          { path: "categoryId", select: "name slug" },
          { path: "brandId", select: "name slug" },
          { path: "principalCompanyId", select: "name code" },
        ],
      })
      .populate("principalCompanyId", "name code")
      .lean();

    // Filter out unpopulated products (e.g. inactive) and enrich with sanitized variants
    const activeAssignments = assignments.filter((a) => a.productId);

    const enriched = await Promise.all(
      activeAssignments.map(async (assignment) => {
        const prod = assignment.productId as unknown as { _id: mongoose.Types.ObjectId; [key: string]: unknown };
        const rawVariants = await ProductVariant.find({
          productId: new mongoose.Types.ObjectId(String(prod._id)),
          status: "active",
        }).lean();
        const sanitizedVariants = rawVariants.map((v) =>
          PricingService.sanitizeVariant(v, params.userRole, params.userPermissions)
        );

        return {
          _id: assignment._id,
          dealershipId: assignment.dealershipId,
          isAvailable: assignment.isAvailable,
          assignedAt: assignment.assignedAt,
          principalCompany: assignment.principalCompanyId,
          product: {
            ...prod,
            variants: sanitizedVariants,
          },
        };
      })
    );

    if (params.search) {
      const q = params.search.toLowerCase();
      return enriched.filter((item) => {
        const prod = item.product as { name?: string; sku?: string; barcode?: string };
        return (
          prod.name?.toLowerCase().includes(q) ||
          prod.sku?.toLowerCase().includes(q) ||
          prod.barcode?.toLowerCase().includes(q)
        );
      });
    }

    return enriched;
  }
}
