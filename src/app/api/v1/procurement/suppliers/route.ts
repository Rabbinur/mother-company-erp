import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { SupplierService } from "@/services/SupplierService";
import { requireAuth } from "@/lib/auth/session";
import { canUserViewPurchaseCost } from "@/lib/grn/cost-masking";
import {
  successResponse,
  unauthorizedResponse,
  errorResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  await connectDB();
  const { searchParams } = new URL(req.url);

  const businessId = user.businessId;
  const search = searchParams.get("search") || undefined;
  const status = searchParams.get("status") || undefined;
  const principalCompanyId = searchParams.get("principalCompanyId") || undefined;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  if (!businessId) {
    return errorResponse("Business context required", 400);
  }

  const result = await SupplierService.listSuppliers({
    businessId,
    search,
    status,
    principalCompanyId,
    page,
    limit,
  });

  const canViewCost = canUserViewPurchaseCost(user);
  if (!canViewCost) {
    result.suppliers = result.suppliers.map((s: any) => {
      const copy = { ...s };
      delete copy.openingBalance;
      delete copy.currentPayable;
      return copy;
    });
  }

  return successResponse(result);
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  try {
    const body = await req.json();
    const businessId = user.businessId || body.businessId;

    if (!businessId) {
      return errorResponse("Business context required", 400);
    }
    if (!body.name || !body.companyName || !body.phone) {
      return errorResponse("Name, Company Name, and Phone are required", 400);
    }

    await connectDB();

    const supplier = await SupplierService.createSupplier({
      businessId,
      code: body.code,
      name: body.name,
      companyName: body.companyName,
      phone: body.phone,
      email: body.email,
      address: body.address,
      contactPerson: body.contactPerson,
      taxVatNumber: body.taxVatNumber,
      principalCompanyId: body.principalCompanyId,
      paymentTerms: body.paymentTerms,
      customPaymentTermsDays: body.customPaymentTermsDays,
      openingBalance: body.openingBalance,
      notes: body.notes,
    });

    return successResponse(supplier, "Supplier created successfully", undefined, 201);
  } catch (err: any) {
    return errorResponse(err.message || "Failed to create supplier", 400);
  }
}
