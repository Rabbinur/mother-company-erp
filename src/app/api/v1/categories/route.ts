import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Category } from "@/models/Category";
import { Product } from "@/models/Product";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api-response";

export async function GET() {
  await connectDB();
  const categories = await Category.find().populate("parentId").sort({ name: 1 }).lean();
  return successResponse(categories);
}

export async function POST(req: NextRequest) {
  const { user, authorized } = await requirePermission(req, PERMISSIONS.PRODUCTS_CREATE);
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  try {
    await connectDB();
    const body = await req.json();
    const { name, description, parentId, image, status } = body;

    if (!name) return errorResponse("Category name is required", 400);

    const slug = String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const existing = await Category.findOne({ slug });
    if (existing) {
      return errorResponse("A category with a similar name already exists", 400);
    }

    const category = await Category.create({
      name,
      slug,
      description,
      parentId: parentId || null,
      image,
      status: status || "active",
    });

    return successResponse(category, "Category created successfully", undefined, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create category";
    return errorResponse(msg, 500);
  }
}

export async function DELETE(req: NextRequest) {
  const { user, authorized } = await requirePermission(req, PERMISSIONS.PRODUCTS_DELETE);
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return errorResponse("Category ID required", 400);

  await connectDB();

  // Safety rule: Prevent deletion of categories that have active products
  const productsCount = await Product.countDocuments({
    categoryId: id,
    status: { $ne: "archived" },
  });

  if (productsCount > 0) {
    return errorResponse(
      `Cannot delete category. There are ${productsCount} active product(s) assigned to it. Reassign or archive products first.`,
      400
    );
  }

  await Category.findByIdAndDelete(id);
  return successResponse(null, "Category deleted successfully");
}
