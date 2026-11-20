import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/models/User";
import { getSessionUser } from "@/lib/auth/session";
import { DEFAULT_ROLE_PERMISSIONS } from "@/lib/auth/permissions";
import { successResponse, unauthorizedResponse } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) {
    return unauthorizedResponse();
  }

  await connectDB();
  const user = await User.findById(session.userId).lean();
  if (!user || user.status !== "active") {
    return unauthorizedResponse("Account inactive or not found");
  }

  const effectivePermissions = [
    ...(DEFAULT_ROLE_PERMISSIONS[user.role] || []),
    ...(user.customPermissions || []),
  ];

  return successResponse({
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      phone: user.phone,
      avatar: user.avatar,
      lastLoginAt: user.lastLoginAt,
      permissions: Array.from(new Set(effectivePermissions)),
    },
  });
}
