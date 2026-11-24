import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Product } from "@/models/Product";
import { ProductVariant } from "@/models/ProductVariant";
import { InventoryBalance } from "@/models/InventoryBalance";
import { Warehouse } from "@/models/Warehouse";
import { getSessionUser, requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { PricingService } from "@/services/PricingService";
import { ProductService } from "@/services/ProductService";
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
  const principalCompanyId = searchParams.get("principalCompanyId") || "";
  const status = searchParams.get("status") || "";
  const businessId = searchParams.get("businessId") || session.businessId;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  const query: Record<string, unknown> = {};
  if (status) query.status = status;
  else query.status = { $ne: "archived" };

  if (businessId) query.businessId = businessId;
  if (categoryId) query.categoryId = categoryId;
  if (brandId) query.brandId = brandId;
  if (principalCompanyId) query.principalCompanyId = principalCompanyId;

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { sku: { $regex: search, $options: "i" } },
      { code: { $regex: search, $options: "i" } },
      { barcode: { $regex: search, $options: "i" } },
    ];
  }

  // Optional central warehouse for stock summary
  const centralWarehouse = await Warehouse.findOne({ isCentral: true }).lean();

  const skip = (page - 1) * limit;
  const [products, total] = await Promise.all([
    Product.find(query)
      .populate("categoryId", "name slug")
      .populate("brandId", "name slug")
      .populate("principalCompanyId", "name code")
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

    const created = await ProductService.createProduct(
      {
        ...body,
        businessId: body.businessId || user.businessId,
      },
      {
        userId: user.userId,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
      }
    );

    return successResponse(created, "Product created successfully", undefined, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create product";
    return errorResponse(msg, 400);
  }
}
