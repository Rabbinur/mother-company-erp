import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { requireAuth } from "@/lib/auth/session";
import { DispatchService } from "@/services/DispatchService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from "@/lib/utils/api-response";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON payload", 400);
  }

  if (!body.dispatchId || !body.expenseType || !body.amount) {
    return errorResponse("dispatchId, expenseType, and amount are required", 400);
  }

  await connectDB();

  try {
    const updated = await DispatchService.addTripExpense({
      dispatchId: body.dispatchId,
      expenseType: body.expenseType,
      amount: Number(body.amount),
      payer: body.payer || "business",
      principalCompanyId: body.principalCompanyId,
      notes: body.notes,
      allocationMethod: body.allocationMethod,
      dealershipAllocations: body.dealershipAllocations,
      actorId: user.userId,
    });

    return successResponse(updated, "Trip expense added successfully");
  } catch (err: any) {
    return errorResponse(err.message || "Failed to record trip expense", 400);
  }
}
