import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { AuditLog } from "@/models/AuditLog";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.AUDIT_VIEW
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  await connectDB();
  const searchParams = req.nextUrl.searchParams;
  const entityType = searchParams.get("entityType");
  const action = searchParams.get("action");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "30", 10);

  const query: Record<string, unknown> = {};
  if (entityType) query.entityType = entityType;
  if (action) query.action = action;

  const skip = (page - 1) * limit;
  const [logs, total] = await Promise.all([
    AuditLog.find(query)
      .populate("actorId", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(query),
  ]);

  return successResponse(logs, "Audit logs retrieved", {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}
