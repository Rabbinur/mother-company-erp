import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { authenticateFieldSales } from "@/lib/security/field-sales-auth";
import { getSessionUser } from "@/lib/auth/session";
import { DeliveryCollectionSyncService } from "@/services/delivery/DeliveryCollectionSyncService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const auth = authenticateFieldSales(req);
  const user = await getSessionUser(req);

  if (!auth.authenticated && !user) {
    return unauthorizedResponse("Unauthorized: Missing Field Sales API key or valid ERP session");
  }

  const url = req.nextUrl;
  const deliverymanId = url.searchParams.get("deliverymanId") || user?.userId;

  if (!deliverymanId) {
    return errorResponse("deliverymanId is required", 400);
  }

  try {
    await connectDB();
    const summary =
      await DeliveryCollectionSyncService.getDeliverymanFinancialSummary(
        deliverymanId
      );
    return successResponse(
      summary,
      "Deliveryman financial collection summary retrieved"
    );
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Failed to load collection summary";
    return errorResponse(msg, 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = authenticateFieldSales(req);
  const user = await getSessionUser(req);

  if (!auth.authenticated && !user) {
    return unauthorizedResponse("Unauthorized: Missing Field Sales API key or valid ERP session");
  }

  try {
    await connectDB();
    const body = await req.json();
    const {
      collectionId,
      orderId,
      deliverymanId,
      amount,
      paymentMethod,
      transactionReference,
      dispatchId,
      notes,
      idempotencyKey,
    } = body;

    const targetDManId = deliverymanId || user?.userId;
    if (!orderId || !targetDManId || !amount) {
      return errorResponse("orderId, deliverymanId, and amount are required", 400);
    }

    const collection = await DeliveryCollectionSyncService.recordCollection({
      collectionId,
      orderId,
      deliverymanId: targetDManId,
      amount: Number(amount),
      paymentMethod: paymentMethod || "cash",
      transactionReference,
      dispatchId,
      notes,
      source: auth.authenticated ? "field_sales" : "mother_erp",
      idempotencyKey: idempotencyKey || collectionId,
      autoVerifyIfPermitted: user?.role === "accountant" || user?.role === "manager" || user?.role === "admin",
      actorId: user?.userId,
    });

    return successResponse(
      collection,
      "Delivery collection recorded and synchronized successfully",
      undefined,
      201
    );
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Failed to record collection";
    return errorResponse(msg, 400);
  }
}
