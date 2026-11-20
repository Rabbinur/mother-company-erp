import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Role } from "@/models/Role";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS, ALL_PERMISSIONS } from "@/lib/auth/permissions";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const { user, authorized } = await requirePermission(req, PERMISSIONS.ROLES_MANAGE);
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  await connectDB();
  const roles = await Role.find().sort({ isSystem: -1, name: 1 }).lean();

  return successResponse({
    roles,
    availablePermissions: ALL_PERMISSIONS,
  });
}

export async function POST(req: NextRequest) {
  const { user, authorized } = await requirePermission(req, PERMISSIONS.ROLES_MANAGE);
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  try {
    await connectDB();
    const body = await req.json();
    const { name, code, description, permissions } = body;

    if (!name || !code) {
      return errorResponse("Role name and code are required", 400);
    }

    const cleanCode = String(code).toLowerCase().replace(/\s+/g, "_").trim();
    const existing = await Role.findOne({ code: cleanCode });
    if (existing) {
      return errorResponse("Role with this code already exists", 400);
    }

    const newRole = await Role.create({
      name,
      code: cleanCode,
      description,
      permissions: permissions || [],
      isSystem: false,
    });

    return successResponse(newRole, "Custom role created successfully", undefined, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create role";
    return errorResponse(msg, 500);
  }
}
