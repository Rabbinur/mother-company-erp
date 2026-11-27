import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { authenticateFieldSales } from "@/lib/security/field-sales-auth";
import { getSessionUser } from "@/lib/auth/session";
import { SalesmanCustomerDueService } from "@/services/customer/SalesmanCustomerDueService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from "@/lib/utils/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = authenticateFieldSales(req);
  const user = await getSessionUser(req);

  if (!auth.authenticated && !user) {
    return unauthorizedResponse("Unauthorized: Missing Field Sales API key or valid ERP session");
  }

  try {
    const { id } = await params;
    const url = req.nextUrl;

    // Derive dealershipId strictly from authenticated user context or verified query
    let dealershipId = url.searchParams.get("dealershipId") || undefined;

    // If user is sales staff in ERP session, strictly force their assigned dealership
    if (user && (user.role === "sales_staff" || user.role === "salesman")) {
      if (user.dealershipId) {
        dealershipId = String(user.dealershipId);
      }
    }

    if (!dealershipId) {
      return errorResponse("dealershipId is required to access customer dues and invoice history", 400);
    }

    await connectDB();
    const profile = await SalesmanCustomerDueService.getSalesmanCustomerDueProfile({
      customerId: id,
      dealershipId,
      salesmanId: user?.userId,
    });

    return successResponse(profile, "Salesman customer due & collection profile retrieved");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load customer due profile";
    return errorResponse(msg, 400);
  }
}
