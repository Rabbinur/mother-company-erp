import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Product } from "@/models/Product";
import { ProductVariant } from "@/models/ProductVariant";
import { InventoryBalance } from "@/models/InventoryBalance";
import { Warehouse } from "@/models/Warehouse";
import { getSessionUser, requirePermission } from "@/lib/auth/session";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
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
  const search = searchParams.get("search") || "";
  const categoryId = searchParams.get("categoryId") || "";
  const brandId = searchParams.get("brandId") || "";
  const status = searchParams.get("status") || "";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  const query: Record<string, unknown> = {};
  if (status) query.status = status;
  else query.status = { $ne: "archived" };

  if (categoryId) query.categoryId = categoryId;
  if (brandId) query.brandId = brandId;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { sku: { $regex: search, $options: "i" } },
      { barcode: { $regex: search, $options: "i" } },
    ];
  }

  // Get central warehouse for stock summary
  const centralWarehouse = await Warehouse.findOne({ isCentral: true }).lean();

  const skip = (page - 1) * limit;
  const [products, total] = await Promise.all([
    Product.find(query)
      .populate("categoryId", "name slug")
      .populate("brandId", "name slug")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.countDocuments(query),
  ]);

  // Fetch variants and inventory for each product
  const enrichedProducts = await Promise.all(
    products.map(async (p) => {
      const rawVariants = await ProductVariant.find({ productId: p._id }).lean();
      const sanitizedVariants = rawVariants.map((v) =>
        PricingService.sanitizeVariant(v, session.role, session.permissions)
      );

      // Stock summary
      let totalOnHand = 0;
      let totalReserved = 0;
      let totalAvailable = 0;

      if (centralWarehouse) {
        const balances = await InventoryBalance.find({
          warehouseId: centralWarehouse._id,
          productId: p._id,
        }).lean();

        for (const b of balances) {
          totalOnHand += b.onHandQuantity || 0;
          totalReserved += b.reservedQuantity || 0;
          totalAvailable += b.availableQuantity || 0;
        }
      }

      return {
        ...p,
        variants: sanitizedVariants,
        inventory: {
          onHand: totalOnHand,
          reserved: totalReserved,
          available: totalAvailable,
        },
      };
    })
  );

  return successResponse(enrichedProducts, "Products retrieved", {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(req: NextRequest) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.PRODUCTS_CREATE
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  try {
    await connectDB();
    const body = await req.json();
    const {
      name,
      sku,
      barcode,
      description,
      categoryId,
      brandId,
      unit,
      productType,
      minStock,
      maxStock,
      reorderLevel,
      taxRate,
      images,
      variants, // optional list of variants
      // Default pricing if simple product
      purchasePrice,
      customerPrice,
      retailPrice,
    } = body;

    if (!name || !sku || !categoryId) {
      return errorResponse("Product Name, SKU, and Category are required", 400);
    }

    const cleanSku = String(sku).toUpperCase().trim();
    const existingSku = await Product.findOne({ sku: cleanSku });
    if (existingSku) {
      return errorResponse(`Product with SKU '${cleanSku}' already exists`, 400);
    }

    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString().slice(-4)}`;

    const hasVariants = Boolean(variants && variants.length > 0);

    const product = await Product.create({
      name,
      slug,
      sku: cleanSku,
      barcode,
      description,
      categoryId,
      brandId: brandId || null,
      unit: unit || "pcs",
      productType: productType || (hasVariants ? "variable" : "simple"),
      hasVariants,
      images: images || [],
      minStock: minStock ?? 5,
      maxStock,
      reorderLevel: reorderLevel ?? 10,
      taxRate: taxRate ?? 0,
      status: "active",
      createdBy: user.userId,
    });

    // Create variants
    const createdVariants = [];
    if (hasVariants && variants && variants.length > 0) {
      for (const v of variants) {
        const vSku = v.sku ? String(v.sku).toUpperCase().trim() : `${cleanSku}-${v.variantName.replace(/\s+/g, "").toUpperCase()}`;
        const newVar = await ProductVariant.create({
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
      // Default primary variant for simple product
      const defaultVariant = await ProductVariant.create({
        productId: product._id,
        variantName: "Standard",
        sku: cleanSku,
        barcode: barcode,
        attributes: [],
        purchasePrice: Number(purchasePrice || 0),
        customerPrice: Number(customerPrice || 0),
        retailPrice: Number(retailPrice || 0),
        status: "active",
      });
      createdVariants.push(defaultVariant);
    }

    await AuditService.log({
      actorId: user.userId,
      actorEmail: user.email,
      action: "PRODUCT_CREATED",
      entityType: "product",
      entityId: String(product._id),
      afterSnapshot: {
        name: product.name,
        sku: product.sku,
        variantsCount: createdVariants.length,
      },
    });

    const sanitized = createdVariants.map((v) =>
      PricingService.sanitizeVariant(v, user.role, user.permissions)
    );

    return successResponse(
      {
        ...product.toObject(),
        variants: sanitized,
      },
      "Product created successfully",
      undefined,
      201
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create product";
    return errorResponse(msg, 500);
  }
}
