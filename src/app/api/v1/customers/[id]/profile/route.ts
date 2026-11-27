import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { requireAuth } from "@/lib/auth/session";
import { CustomerProfileService } from "@/services/customer/CustomerProfileService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from "@/lib/utils/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { id } = await params;
  const dealershipId = req.nextUrl.searchParams.get("dealershipId") || user.dealershipId;

  try {
    await connectDB();
    const profile = await CustomerProfileService.getCompleteProfile(id, dealershipId);
    return successResponse(profile, "Complete unified customer profile retrieved");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load customer profile";
    return errorResponse(msg, 500);
  }
}
