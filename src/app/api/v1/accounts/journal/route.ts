import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { JournalEntry } from "@/models/JournalEntry";
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
    PERMISSIONS.ACCOUNTS_VIEW
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  await connectDB();
  const searchParams = req.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "25", 10);
  const referenceType = searchParams.get("referenceType");

  const query: Record<string, unknown> = { isPosted: true };
  if (referenceType) query.referenceType = referenceType;

  const skip = (page - 1) * limit;
  const [entries, total] = await Promise.all([
    JournalEntry.find(query)
      .populate("postedBy", "name email")
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    JournalEntry.countDocuments(query),
  ]);

  return successResponse(entries, "Journal entries retrieved", {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}
