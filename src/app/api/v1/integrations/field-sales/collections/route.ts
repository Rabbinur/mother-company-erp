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

  // STRICT SECURITY: Salesmen must NEVER see collection balances or financial summaries
  if (user && (user.role === "sales_staff" || user.role === "salesman")) {
    return errorResponse("Forbidden: Sales staff are not permitted to access collection financial summaries", 403);
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
      customerId,
      dealershipId,
      deliverymanId,
      salesmanId,
      collectorId,
      collectorRole,
      amount,
      paymentMethod,
      transactionReference,
      dispatchId,
      notes,
      idempotencyKey,
    } = body;

    const targetCollectorId = collectorId || salesmanId || deliverymanId || user?.userId;
    const isSalesman = collectorRole === "salesman" || user?.role === "sales_staff" || user?.role === "salesman" || Boolean(salesmanId);

    if (!amount || Number(amount) <= 0) {
      return errorResponse("Positive collection amount is required", 400);
    }
    if (!orderId && (!customerId || !dealershipId)) {
      return errorResponse("Either orderId or both customerId and dealershipId are required", 400);
    }
    if (!targetCollectorId) {
      return errorResponse("Collector identity (salesmanId or deliverymanId) is required", 400);
    }

    if (paymentMethod && paymentMethod !== "cash") {
      return errorResponse("Collections currently accept physical cash only.", 400);
    }

    // STRICT LAW: Salesman collections always start pending_verification and cannot be auto-verified
    const collection = await DeliveryCollectionSyncService.recordCollection({
      collectionId,
      orderId,
      customerId,
      dealershipId: dealershipId || (user?.dealershipId ? String(user.dealershipId) : undefined),
      salesmanId: isSalesman ? targetCollectorId : undefined,
      deliverymanId: !isSalesman ? targetCollectorId : undefined,
      collectorId: targetCollectorId,
      collectorRole: isSalesman ? "salesman" : "deliveryman",
      amount: Number(amount),
      paymentMethod: "cash",
      transactionReference,
      dispatchId,
      notes,
      source: auth.authenticated ? "field_sales" : "mother_erp",
      idempotencyKey: idempotencyKey || collectionId,
      autoVerifyIfPermitted: isSalesman ? false : (user?.role === "accountant" || user?.role === "manager" || user?.role === "admin"),
      actorId: user?.userId,
    });

    return successResponse(
      collection,
      "Cash collection recorded and queued for manager verification",
      undefined,
      201
    );
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Failed to record collection";
    return errorResponse(msg, 400);
  }
}
