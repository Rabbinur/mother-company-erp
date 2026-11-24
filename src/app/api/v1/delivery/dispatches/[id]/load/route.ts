import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { requireAuth } from "@/lib/auth/session";
import { DispatchService } from "@/services/DispatchService";
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
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // optional body
  }

  await connectDB();

  try {
    const dispatch = await DispatchService.loadDispatch({
      dispatchId: id,
      loadedItems: body.loadedItems,
      actorId: user.userId,
    });
    return successResponse(dispatch, "Dispatch loaded and stock in-transit custody updated");
  } catch (err: any) {
    return errorResponse(err.message || "Failed to load dispatch", 400);
  }
}
