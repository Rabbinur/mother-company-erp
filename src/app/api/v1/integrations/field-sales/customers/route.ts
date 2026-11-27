import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { authenticateFieldSales } from "@/lib/security/field-sales-auth";
import { getSessionUser } from "@/lib/auth/session";
import { FieldSalesService } from "@/services/FieldSalesService";
import { Customer } from "@/models/Customer";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const auth = authenticateFieldSales(req);
  const user = await getSessionUser(req);

  if (!auth.authenticated && !user) {
    return unauthorizedResponse();
  }

  const search = req.nextUrl.searchParams.get("q") || "";

  try {
    await connectDB();
    const filter: any = { status: "active" };
    if (search) {
      filter.$or = [
        { shopName: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const customers = await Customer.find(filter)
      .select("customerCode name shopName phone address creditLimit currentReceivable")
      .limit(50)
      .lean();

    return successResponse(customers, "Field sales customers retrieved");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to list customers";
    return errorResponse(msg, 500);
  }
}

export async function POST(req: NextRequest) {
  const auth = authenticateFieldSales(req);
  const user = await getSessionUser(req);

  if (!auth.authenticated && !user) {
    return unauthorizedResponse();
  }

  try {
    await connectDB();
    const body = await req.json();
    const { name, shopName, phone, dealershipId, businessId, address, creditLimit, salesmanId } = body;

    const bId = businessId || user?.businessId;
    if (!name || !shopName || !phone || !dealershipId || !bId) {
      return errorResponse(
        "Missing required fields: name, shopName, phone, dealershipId, businessId",
        400
      );
    }

    const result = await FieldSalesService.syncCustomer({
      name,
      shopName,
      phone,
      dealershipId,
      businessId: bId,
      address,
      creditLimit: Number(creditLimit || 0),
      salesmanId: salesmanId || user?.userId,
    });

    return successResponse(
      result,
      result.isNew ? "New customer registered in Mother ERP" : "Existing customer linked to dealership",
      undefined,
      result.isNew ? 201 : 200
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Customer sync failed";
    return errorResponse(msg, 400);
  }
}
