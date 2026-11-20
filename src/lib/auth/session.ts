import { NextRequest } from "next/server";
import { verifyToken, TokenPayload } from "./jwt";
import { Permission, hasPermission } from "./permissions";
import { connectDB } from "../db/connect";
import { User } from "@/models/User";

export const AUTH_COOKIE_NAME = "mc_erp_token";

export async function getSessionUser(
  req: NextRequest
): Promise<TokenPayload | null> {
  // Check cookie first
  let token = req.cookies.get(AUTH_COOKIE_NAME)?.value;

  // Check Authorization Bearer header as fallback
  if (!token) {
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
  }

  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  return payload;
}

export async function requireAuth(req: NextRequest): Promise<TokenPayload | null> {
  const user = await getSessionUser(req);
  return user;
}

export async function requirePermission(
  req: NextRequest,
  permission: Permission
): Promise<{ user: TokenPayload | null; authorized: boolean }> {
  const user = await getSessionUser(req);
  if (!user) {
    return { user: null, authorized: false };
  }

  // Super admin always authorized
  if (user.role === "super_admin") {
    return { user, authorized: true };
  }

  // If user has cached permissions in token
  if (user.permissions) {
    const allowed = hasPermission(user.role, user.permissions, permission);
    return { user, authorized: allowed };
  }

  // Otherwise, load live user permissions from DB
  try {
    await connectDB();
    const dbUser = await User.findById(user.userId).lean();
    if (!dbUser || dbUser.status !== "active") {
      return { user: null, authorized: false };
    }
    const allowed = hasPermission(
      dbUser.role,
      dbUser.customPermissions,
      permission
    );
    return { user, authorized: allowed };
  } catch {
    return { user, authorized: false };
  }
}
