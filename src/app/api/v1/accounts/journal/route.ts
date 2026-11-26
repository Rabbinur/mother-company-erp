import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { JournalEntry } from "@/models/JournalEntry";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { AccountingService } from "@/services/AccountingService";
import {
  successResponse,
  errorResponse,
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
  const referenceType = searchParams.get("referenceType") || searchParams.get("sourceType");
  const businessId = searchParams.get("businessId") || user.businessId;
  const dealershipId = searchParams.get("dealershipId");
  const status = searchParams.get("status");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const query: Record<string, unknown> = {};
  if (status) {
    query.status = status;
  }
  if (referenceType) {
    query.$or = [{ referenceType }, { sourceType: referenceType }];
  }
  if (businessId) {
    query.businessId = businessId;
  }
  if (dealershipId) {
    query.$or = [{ dealershipId }, { "lines.dealershipId": dealershipId }];
  }
  if (startDate || endDate) {
    const dateQuery: Record<string, unknown> = {};
    if (startDate) dateQuery.$gte = new Date(startDate);
    if (endDate) dateQuery.$lte = new Date(endDate);
    query.postingDate = dateQuery;
  }

  const skip = (page - 1) * limit;
  const [entries, total] = await Promise.all([
    JournalEntry.find(query)
      .populate("postedBy", "name email")
      .sort({ postingDate: -1, date: -1, createdAt: -1 })
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

export async function POST(req: NextRequest) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.ACCOUNTS_MANAGE
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  try {
    await connectDB();
    const body = await req.json();
    const { businessId, dealershipId, narration, description, postingDate, date, lines, sourceType, referenceType, referenceId, idempotencyKey } = body;

    if (!lines || !Array.isArray(lines) || lines.length < 2) {
      return errorResponse("Journal entry must have at least 2 balanced lines", 400);
    }

    const entry = await AccountingService.postJournalEntry({
      businessId: businessId || user.businessId,
      dealershipId: dealershipId || undefined,
      sourceType: sourceType || referenceType || "manual_adjustment",
      referenceType: referenceType || sourceType || "manual_adjustment",
      referenceId,
      narration: narration || description || "Manual journal entry",
      description: description || narration || "Manual journal entry",
      postingDate: postingDate ? new Date(postingDate) : date ? new Date(date) : new Date(),
      date: date ? new Date(date) : postingDate ? new Date(postingDate) : new Date(),
      lines,
      idempotencyKey,
      postedBy: user.userId,
    });

    return successResponse(entry, "Journal entry posted successfully", undefined, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to post journal entry";
    return errorResponse(msg, 400);
  }
}
