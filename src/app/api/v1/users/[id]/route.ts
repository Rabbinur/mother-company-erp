import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/models/User";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { hashPassword } from "@/lib/auth/password";
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
  const { user, authorized } = await requirePermission(req, PERMISSIONS.USERS_MANAGE);
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  const { id } = await params;
  await connectDB();
  const foundUser = await User.findById(id).select("-passwordHash").lean();
  if (!foundUser) return notFoundResponse("User not found");

  return successResponse(foundUser);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, authorized } = await requirePermission(req, PERMISSIONS.USERS_MANAGE);
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  const { id } = await params;
  try {
    await connectDB();
    const targetUser = await User.findById(id);
    if (!targetUser) return notFoundResponse("User not found");

    const body = await req.json();
    const beforeSnapshot = {
      name: targetUser.name,
      role: targetUser.role,
      status: targetUser.status,
    };

    if (body.name) targetUser.name = body.name;
    if (body.role) targetUser.role = body.role;
    if (body.status) targetUser.status = body.status;
    if (body.phone !== undefined) targetUser.phone = body.phone;
    if (body.customPermissions) targetUser.customPermissions = body.customPermissions;

    if (body.password) {
      targetUser.passwordHash = await hashPassword(body.password);
    }

    await targetUser.save();

    await AuditService.log({
      actorId: user.userId,
      actorEmail: user.email,
      action: "USER_UPDATED",
      entityType: "user",
      entityId: String(targetUser._id),
      beforeSnapshot,
      afterSnapshot: {
        name: targetUser.name,
        role: targetUser.role,
        status: targetUser.status,
      },
    });

    return successResponse(
      {
        id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        status: targetUser.status,
      },
      "User updated successfully"
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update user";
    return errorResponse(msg, 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, authorized } = await requirePermission(req, PERMISSIONS.USERS_MANAGE);
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  const { id } = await params;
  if (id === user.userId) {
    return errorResponse("Cannot delete your own administrator account", 400);
  }

  await connectDB();
  const deleted = await User.findByIdAndUpdate(id, { status: "inactive" });
  if (!deleted) return notFoundResponse("User not found");

  await AuditService.log({
    actorId: user.userId,
    actorEmail: user.email,
    action: "USER_DEACTIVATED",
    entityType: "user",
    entityId: id,
  });

  return successResponse(null, "User deactivated successfully");
}
