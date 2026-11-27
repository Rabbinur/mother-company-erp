import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { authenticateFieldSales } from "@/lib/security/field-sales-auth";
import { getSessionUser } from "@/lib/auth/session";
import { SalesmanCustomerDueService } from "@/services/customer/SalesmanCustomerDueService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
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
    const requestedDealership = url.searchParams.get("dealershipId") || undefined;
    let dealershipId = requestedDealership;

    // Delivery staff cannot view financial dues or customer credit accounts
    if (user && (user.role === "deliveryman" || user.role === "delivery_staff")) {
      return forbiddenResponse("Access denied: Delivery staff cannot access customer dues or credit profiles");
    }

    // Strict dealership isolation for sales staff
    if (user && (user.role === "sales_staff" || user.role === "salesman")) {
      if (user.dealershipId) {
        const assignedDealership = String(user.dealershipId);
        if (requestedDealership && requestedDealership !== assignedDealership) {
          return forbiddenResponse("Access denied: Sales staff cannot query financial or credit records of other dealerships");
        }
        dealershipId = assignedDealership;
      }
    }

    if (!dealershipId) {
      return errorResponse("dealershipId is required to access customer dues and invoice history", 400);
    }

    await connectDB();
    const canViewCredit = !user?.permissions || user.permissions.includes("customers.view");
    const profile = await SalesmanCustomerDueService.getSalesmanCustomerDueProfile({
      customerId: id,
      dealershipId,
      salesmanId: user?.userId,
      canViewCredit,
    });

    return successResponse(profile, "Salesman customer due & collection profile retrieved");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load customer due profile";
    return errorResponse(msg, 400);
  }
}
