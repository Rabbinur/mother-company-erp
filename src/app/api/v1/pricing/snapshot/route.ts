import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { getSessionUser } from "@/lib/auth/session";
import { PricingService } from "@/services/PricingService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from "@/lib/utils/api-response";

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return unauthorizedResponse();

  try {
    await connectDB();
    const body = await req.json();
    const { productId, variantId, dealershipId } = body;

    if (!productId) {
      return errorResponse("productId is required", 400);
    }

    const snapshot = await PricingService.createPriceSnapshot(
      {
        businessId: session.businessId,
        dealershipId,
        productId,
        variantId,
      },
      session.role,
      session.permissions
    );

    return successResponse(snapshot, "Price snapshot generated successfully", undefined, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to generate price snapshot";
    return errorResponse(msg, 400);
  }
}
