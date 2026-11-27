import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { authenticateFieldSales } from "@/lib/security/field-sales-auth";
import { getSessionUser } from "@/lib/auth/session";
import { DeliveryCollectionSyncService } from "@/services/delivery/DeliveryCollectionSyncService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api-response";

export async function POST(req: NextRequest) {
  const auth = authenticateFieldSales(req);
  const user = await getSessionUser(req);

  if (!auth.authenticated && !user) {
    return unauthorizedResponse("Unauthorized: Missing Field Sales API credentials or ERP session");
  }

  try {
    await connectDB();
    const body = await req.json();
    const {
      deliverymanId,
      collectionIds,
      depositAmount,
      depositedToAccountId,
      reconciledByUserId,
      notes,
    } = body;

    const actorId = user?.userId || reconciledByUserId;

    if (!deliverymanId || !collectionIds || !depositAmount || !depositedToAccountId || !actorId) {
      return errorResponse(
        "Missing required fields: deliverymanId, collectionIds, depositAmount, depositedToAccountId, actorId",
        400
      );
    }

    // Security Check: deliveryman cannot approve their own deposit
    if (String(deliverymanId) === String(actorId)) {
      return forbiddenResponse(
        "Security Violation: Deliveryman cannot self-approve deposit reconciliation."
      );
    }

    const result = await DeliveryCollectionSyncService.recordDeliverymanDeposit({
      deliverymanId,
      collectionIds,
      depositAmount: Number(depositAmount),
      depositedToAccountId,
      reconciledByUserId: actorId,
      notes,
    });

    return successResponse(
      result,
      "Deliveryman deposit reconciled and recorded successfully",
      undefined,
      201
    );
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Failed to record deposit reconciliation";
    return errorResponse(msg, 400);
  }
}
