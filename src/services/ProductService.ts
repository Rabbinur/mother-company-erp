import mongoose from "mongoose";
import { Product, type IProduct } from "@/models/Product";
import { ProductVariant, type IProductVariant } from "@/models/ProductVariant";
import { AuditService } from "@/services/AuditService";
import { PricingService, type SanitizedVariant } from "@/services/PricingService";

export interface CreateProductInput {
  businessId?: string | mongoose.Types.ObjectId;
  principalCompanyId?: string | mongoose.Types.ObjectId | null;
  name: string;
  sku: string;
  code?: string;
  barcode?: string;
  description?: string;
  categoryId: string | mongoose.Types.ObjectId;
  brandId?: string | mongoose.Types.ObjectId | null;
  unit?: string;
  uom?: string;
  productType?: "simple" | "variable" | "service";
  minStock?: number;
  maxStock?: number;
  reorderLevel?: number;
  taxRate?: number;
  images?: string[];
  variants?: Array<{
    variantName: string;
    sku?: string;
    barcode?: string;
    attributes?: Array<{ name: string; value: string }>;
    purchasePrice?: number;
    customerPrice?: number;
    retailPrice?: number;
    image?: string;
  }>;
  purchasePrice?: number;
  customerPrice?: number;
  retailPrice?: number;
}

export interface EnrichedProduct extends Omit<IProduct, "variants"> {
  variants: SanitizedVariant[];
}

export class ProductService {
  /**
   * Create a new product with its variants and default pricing
   */
  static async createProduct(
    input: CreateProductInput,
    actor?: { userId: string | mongoose.Types.ObjectId; email?: string; role?: string; permissions?: string[] }
  ): Promise<Record<string, unknown>> {
    const cleanSku = String(input.sku).toUpperCase().trim();

    // Check SKU uniqueness within business scope
    const skuQuery: Record<string, unknown> = { sku: cleanSku };
    if (input.businessId) {
      skuQuery.businessId = new mongoose.Types.ObjectId(String(input.businessId));
    }
    const existingSku = await Product.findOne(skuQuery);
    if (existingSku) {
      throw new Error(`Product with SKU '${cleanSku}' already exists in this organization`);
    }

    const slug = `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString().slice(-4)}`;
    const hasVariants = Boolean(input.variants && input.variants.length > 0);
    const resolvedUom = input.uom || input.unit || "pcs";

    const product = await Product.create({
      businessId: input.businessId ? new mongoose.Types.ObjectId(String(input.businessId)) : undefined,
      principalCompanyId: input.principalCompanyId
        ? new mongoose.Types.ObjectId(String(input.principalCompanyId))
        : null,
      name: input.name.trim(),
      slug,
      sku: cleanSku,
      code: input.code ? String(input.code).trim() : undefined,
      barcode: input.barcode ? String(input.barcode).trim() : undefined,
      description: input.description,
      categoryId: new mongoose.Types.ObjectId(String(input.categoryId)),
      brandId: input.brandId ? new mongoose.Types.ObjectId(String(input.brandId)) : null,
      unit: resolvedUom,
      uom: resolvedUom,
      productType: input.productType || (hasVariants ? "variable" : "simple"),
      hasVariants,
      images: input.images || [],
      minStock: input.minStock ?? 5,
      maxStock: input.maxStock,
      reorderLevel: input.reorderLevel ?? 10,
      taxRate: input.taxRate ?? 0,
      status: "active",
      createdBy: actor?.userId ? new mongoose.Types.ObjectId(String(actor.userId)) : undefined,
    });

    const createdVariants: IProductVariant[] = [];

    if (hasVariants && input.variants && input.variants.length > 0) {
      for (const v of input.variants) {
        const vSku = v.sku
          ? String(v.sku).toUpperCase().trim()
          : `${cleanSku}-${v.variantName.replace(/\s+/g, "").toUpperCase()}`;

        const newVar = await ProductVariant.create({
          businessId: product.businessId,
          productId: product._id,
          variantName: v.variantName || "Standard",
          sku: vSku,
          barcode: v.barcode,
          attributes: v.attributes || [],
          purchasePrice: Number(v.purchasePrice || 0),
          customerPrice: Number(v.customerPrice || 0),
          retailPrice: Number(v.retailPrice || 0),
          image: v.image,
          status: "active",
        });
        createdVariants.push(newVar);
      }
    } else {
      const defaultVariant = await ProductVariant.create({
        businessId: product.businessId,
        productId: product._id,
        variantName: "Standard",
        sku: cleanSku,
        barcode: input.barcode,
        attributes: [],
        purchasePrice: Number(input.purchasePrice || 0),
        customerPrice: Number(input.customerPrice || 0),
        retailPrice: Number(input.retailPrice || 0),
        status: "active",
      });
      createdVariants.push(defaultVariant);
    }

    if (actor?.userId) {
      await AuditService.log({
        actorId: String(actor.userId),
        actorEmail: actor.email,
        action: "PRODUCT_CREATED",
        entityType: "product",
        entityId: String(product._id),
        afterSnapshot: {
          name: product.name,
          sku: product.sku,
          variantsCount: createdVariants.length,
          businessId: product.businessId ? String(product.businessId) : undefined,
        },
      });
    }

    const sanitizedVariants = createdVariants.map((v) =>
      PricingService.sanitizeVariant(v, actor?.role, actor?.permissions)
    );

    return {
      ...product.toObject(),
      variants: sanitizedVariants,
    };
  }

  /**
   * Retrieve single product with sanitized variants
   */
  static async getProductById(
    id: string | mongoose.Types.ObjectId,
    businessId?: string | mongoose.Types.ObjectId,
    userRole?: string,
    userPermissions?: string[]
  ): Promise<Record<string, unknown> | null> {
    const query: Record<string, unknown> = {
      _id: new mongoose.Types.ObjectId(String(id)),
      status: { $ne: "archived" },
    };
    if (businessId) {
      query.businessId = new mongoose.Types.ObjectId(String(businessId));
    }

    const product = await Product.findOne(query)
      .populate("categoryId", "name slug")
      .populate("brandId", "name slug")
      .populate("principalCompanyId", "name code")
      .lean();

    if (!product) return null;

    const rawVariants = await ProductVariant.find({ productId: product._id }).lean();
    const sanitizedVariants = rawVariants.map((v) =>
      PricingService.sanitizeVariant(v, userRole, userPermissions)
    );

    return {
      ...product,
      variants: sanitizedVariants,
    };
  }

  /**
   * Update an existing product
   */
  static async updateProduct(
    id: string | mongoose.Types.ObjectId,
    updateData: Partial<CreateProductInput> & { status?: "active" | "inactive" | "archived" },
    actor?: { userId: string | mongoose.Types.ObjectId; email?: string; role?: string }
  ): Promise<IProduct | null> {
    const product = await Product.findById(new mongoose.Types.ObjectId(String(id)));
    if (!product) {
      throw new Error("Product not found");
    }

    if (updateData.sku && updateData.sku.toUpperCase() !== product.sku) {
      const cleanSku = String(updateData.sku).toUpperCase().trim();
      const conflict = await Product.findOne({
        sku: cleanSku,
        _id: { $ne: product._id },
        businessId: product.businessId,
      });
      if (conflict) {
        throw new Error(`Product with SKU '${cleanSku}' already exists in this organization`);
      }
      product.sku = cleanSku;
    }

    if (updateData.name) product.name = updateData.name.trim();
    if (updateData.code !== undefined) product.code = updateData.code;
    if (updateData.barcode !== undefined) product.barcode = updateData.barcode;
    if (updateData.description !== undefined) product.description = updateData.description;
    if (updateData.categoryId) product.categoryId = new mongoose.Types.ObjectId(String(updateData.categoryId));
    if (updateData.brandId !== undefined) {
      product.brandId = updateData.brandId ? new mongoose.Types.ObjectId(String(updateData.brandId)) : null;
    }
    if (updateData.principalCompanyId !== undefined) {
      product.principalCompanyId = updateData.principalCompanyId
        ? new mongoose.Types.ObjectId(String(updateData.principalCompanyId))
        : null;
    }
    if (updateData.uom || updateData.unit) {
      const uom = updateData.uom || updateData.unit || "pcs";
      product.uom = uom;
      product.unit = uom;
    }
    if (updateData.minStock !== undefined) product.minStock = updateData.minStock;
    if (updateData.maxStock !== undefined) product.maxStock = updateData.maxStock;
    if (updateData.reorderLevel !== undefined) product.reorderLevel = updateData.reorderLevel;
    if (updateData.taxRate !== undefined) product.taxRate = updateData.taxRate;
    if (updateData.status) product.status = updateData.status;
    if (updateData.images) product.images = updateData.images;

    if (actor?.userId) {
      product.updatedBy = new mongoose.Types.ObjectId(String(actor.userId));
    }

    await product.save();

    if (actor?.userId) {
      await AuditService.log({
        actorId: String(actor.userId),
        actorEmail: actor.email,
        action: "PRODUCT_UPDATED",
        entityType: "product",
        entityId: String(product._id),
        afterSnapshot: {
          name: product.name,
          sku: product.sku,
          status: product.status,
        },
      });
    }

    return product;
  }
}
