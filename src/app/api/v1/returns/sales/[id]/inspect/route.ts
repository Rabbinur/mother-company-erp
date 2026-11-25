import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { requireAuth } from "@/lib/auth/session";
import { ReturnsService } from "@/services/ReturnsService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from "@/lib/utils/api-response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { id } = await params;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON payload", 400);
  }

  if (!body.inspectedItems || !Array.isArray(body.inspectedItems)) {
    return errorResponse("inspectedItems array is required", 400);
  }

  await connectDB();

  try {
    const inspected = await ReturnsService.inspectSalesReturn({
      returnId: id,
      inspectedItems: body.inspectedItems,
      inspectionNotes: body.inspectionNotes,
      actorId: user.userId,
    });

    return successResponse(inspected, "Sales return inspected successfully");
  } catch (err: any) {
    return errorResponse(err.message || "Failed to inspect sales return", 400);
  }
}
