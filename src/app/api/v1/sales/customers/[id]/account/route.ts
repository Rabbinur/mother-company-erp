import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { requireAuth } from "@/lib/auth/session";
import { Customer } from "@/models/Customer";
import { CustomerDealershipAccount } from "@/models/CustomerDealershipAccount";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/utils/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { id } = await params;
  if (!id) return errorResponse("Customer ID required", 400);

  const dealershipId = req.nextUrl.searchParams.get("dealershipId") || user.dealershipId || user.activeDealershipId;
  if (!dealershipId) return errorResponse("Dealership context required", 400);

  await connectDB();

  try {
    const [customer, account] = await Promise.all([
      Customer.findById(id).lean(),
      CustomerDealershipAccount.findOne({
        customerId: id,
        dealershipId,
        isDeleted: false,
      }).lean(),
    ]);

    if (!customer) return notFoundResponse("Customer not found");

    return successResponse({
      customer,
      account: account || null,
      hasDealershipAccount: !!account,
      creditLimit: account?.creditLimit || 0,
      currentBalance: account?.currentBalance || 0,
      accountStatus: account?.status || "none",
    });
  } catch (err: any) {
    return errorResponse(err.message || "Failed to fetch customer account", 500);
  }
}
