import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Brand } from "@/models/Brand";
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
  const brands = await Brand.find().sort({ name: 1 }).lean();
  return successResponse(brands);
}

export async function POST(req: NextRequest) {
  const { user, authorized } = await requirePermission(req, PERMISSIONS.PRODUCTS_CREATE);
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  try {
    await connectDB();
    const body = await req.json();
    const { name, description, logo, status } = body;

    if (!name) return errorResponse("Brand name is required", 400);

    const slug = String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const brand = await Brand.create({
      name,
      slug,
      description,
      logo,
      status: status || "active",
    });

    return successResponse(brand, "Brand created successfully", undefined, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create brand";
    return errorResponse(msg, 500);
  }
}
