import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Product } from "@/models/Product";
import { ProductVariant } from "@/models/ProductVariant";
import { InventoryBalance } from "@/models/InventoryBalance";
import { Warehouse } from "@/models/Warehouse";
import { getSessionUser, requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { PricingService } from "@/services/PricingService";
import { AuditService } from "@/services/AuditService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/utils/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser(req);
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  await connectDB();

  const product = await Product.findById(id)
    .populate("categoryId", "name slug")
    .populate("brandId", "name slug")
    .lean();

  if (!product) return notFoundResponse("Product not found");

  const variants = await ProductVariant.find({ productId: id }).lean();
  const sanitizedVariants = variants.map((v) =>
    PricingService.sanitizeVariant(v, session.role, session.permissions)
  );

  const centralWarehouse = await Warehouse.findOne({ isCentral: true }).lean();
  let balances: unknown[] = [];
  if (centralWarehouse) {
    balances = await InventoryBalance.find({
      warehouseId: centralWarehouse._id,
      productId: id,
    }).lean();
  }

  return successResponse({
    ...product,
    variants: sanitizedVariants,
    warehouseBalances: balances,
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.PRODUCTS_UPDATE
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  const { id } = await params;
  try {
    await connectDB();
    const product = await Product.findById(id);
    if (!product) return notFoundResponse("Product not found");

    const body = await req.json();
    const beforeSnapshot = {
      name: product.name,
      sku: product.sku,
      status: product.status,
    };

    if (body.name) product.name = body.name;
    if (body.description !== undefined) product.description = body.description;
    if (body.categoryId) product.categoryId = body.categoryId;
    if (body.brandId !== undefined) product.brandId = body.brandId;
    if (body.unit) product.unit = body.unit;
    if (body.minStock !== undefined) product.minStock = body.minStock;
    if (body.maxStock !== undefined) product.maxStock = body.maxStock;
    if (body.reorderLevel !== undefined) product.reorderLevel = body.reorderLevel;
    if (body.taxRate !== undefined) product.taxRate = body.taxRate;
    if (body.status) product.status = body.status;
    if (body.images) product.images = body.images;

    await product.save();

    await AuditService.log({
      actorId: user.userId,
      actorEmail: user.email,
      action: "PRODUCT_UPDATED",
      entityType: "product",
      entityId: id,
      beforeSnapshot,
      afterSnapshot: {
        name: product.name,
        status: product.status,
      },
    });

    return successResponse(product, "Product updated successfully");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update product";
    return errorResponse(msg, 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.PRODUCTS_DELETE
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  const { id } = await params;
  await connectDB();

  // Soft delete / archive product safely
  const product = await Product.findByIdAndUpdate(
    id,
    { status: "archived" },
    { new: true }
  );

  if (!product) return notFoundResponse("Product not found");

  await ProductVariant.updateMany({ productId: id }, { status: "inactive" });

  await AuditService.log({
    actorId: user.userId,
    actorEmail: user.email,
    action: "PRODUCT_ARCHIVED",
    entityType: "product",
    entityId: id,
  });

  return successResponse(null, "Product archived successfully");
}
