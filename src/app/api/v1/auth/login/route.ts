import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/models/User";
import { verifyPassword } from "@/lib/auth/password";
import { signToken } from "@/lib/auth/jwt";
import { AUTH_COOKIE_NAME } from "@/lib/auth/session";
import { AuditService } from "@/services/AuditService";
import { successResponse, errorResponse } from "@/lib/utils/api-response";

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const body = await req.json().catch(() => ({}));
    const { email, password } = body;

    if (!email || !password) {
      return errorResponse("Email and password are required", 400);
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return errorResponse("Invalid email or password", 401);
    }

    if (user.status !== "active") {
      return errorResponse(
        `Account is ${user.status}. Please contact an administrator.`,
        403
      );
    }

    const isMatch = await verifyPassword(String(password), user.passwordHash);
    if (!isMatch) {
      return errorResponse("Invalid email or password", 401);
    }

    // Update lastLoginAt
    user.lastLoginAt = new Date();
    await user.save();

    // Sign JWT
    const token = signToken({
      userId: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: user.customPermissions,
    });

    await AuditService.log({
      actorId: user._id,
      actorEmail: user.email,
      actorName: user.name,
      action: "USER_LOGIN",
      entityType: "user",
      entityId: String(user._id),
      source: "dashboard",
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    const response = successResponse(
      {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          avatar: user.avatar,
        },
      },
      "Logged in successfully"
    );

    // Set secure HttpOnly cookie
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Login failed";
    return errorResponse(msg, 500);
  }
}
