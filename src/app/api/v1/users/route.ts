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
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const { user, authorized } = await requirePermission(req, PERMISSIONS.USERS_MANAGE);
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  await connectDB();
  const searchParams = req.nextUrl.searchParams;
  const search = searchParams.get("search") || "";
  const role = searchParams.get("role") || "";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  const query: Record<string, unknown> = {};
  if (role) query.role = role;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;
  const [users, total] = await Promise.all([
    User.find(query)
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(query),
  ]);

  return successResponse(users, "Users retrieved", {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(req: NextRequest) {
  const { user, authorized } = await requirePermission(req, PERMISSIONS.USERS_MANAGE);
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  try {
    await connectDB();
    const body = await req.json();
    const { name, email, password, role, customPermissions, phone } = body;

    if (!name || !email || !password || !role) {
      return errorResponse("Name, email, password, and role are required", 400);
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return errorResponse("A user with this email already exists", 400);
    }

    const passwordHash = await hashPassword(password);
    const newUser = await User.create({
      name,
      email: cleanEmail,
      passwordHash,
      role,
      customPermissions: customPermissions || [],
      phone,
      status: "active",
    });

    await AuditService.log({
      actorId: user.userId,
      actorEmail: user.email,
      action: "USER_CREATED",
      entityType: "user",
      entityId: String(newUser._id),
      afterSnapshot: { name, email: cleanEmail, role },
    });

    return successResponse(
      {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
      },
      "User created successfully",
      undefined,
      201
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create user";
    return errorResponse(msg, 500);
  }
}
