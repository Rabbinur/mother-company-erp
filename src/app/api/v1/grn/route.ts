import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { GoodsReceiptNote } from "@/models/GoodsReceiptNote";
import { GoodsReceiptNoteService } from "@/services/GoodsReceiptNoteService";
import { requireAuth } from "@/lib/auth/session";
import { canUserViewPurchaseCost, maskGrnCosts } from "@/lib/grn/cost-masking";
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

  // Derive businessId and dealershipId from authenticated context
  const businessId = user.businessId;
  const dealershipId = user.dealershipId || user.activeDealershipId;
  const status = searchParams.get("status");
  const warehouseId = searchParams.get("warehouseId");
  const supplierId = searchParams.get("supplierId");
  const search = searchParams.get("search");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const skip = (page - 1) * limit;

  const filter: any = {};
  if (businessId) filter.businessId = businessId;
  if (dealershipId && user.role !== "super_admin" && user.role !== "owner") {
    filter.dealershipId = dealershipId;
  }
  if (status) filter.status = status;
  if (warehouseId) filter.warehouseId = warehouseId;
  if (supplierId) filter.supplierId = supplierId;
  if (search) {
    filter.$or = [
      { grnNumber: { $regex: search, $options: "i" } },
      { challanNumber: { $regex: search, $options: "i" } },
      { invoiceNumber: { $regex: search, $options: "i" } },
    ];
  }

  const [grns, total] = await Promise.all([
    GoodsReceiptNote.find(filter)
      .populate("supplierId", "name companyName phone")
      .populate("warehouseId", "name code")
      .populate("dealershipId", "name code")
      .populate("principalCompanyId", "name code")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    GoodsReceiptNote.countDocuments(filter),
  ]);

  const canViewCost = canUserViewPurchaseCost(user);
  const sanitizedGrns = grns.map((g) => maskGrnCosts(g as any, canViewCost));

  return successResponse({
    grns: sanitizedGrns,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
    canViewCost,
  });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  try {
    const body = await req.json();

    // Enforce businessId and dealershipId from authenticated context
    const businessId = user.businessId || body.businessId;
    const dealershipId = user.dealershipId || user.activeDealershipId || body.dealershipId;

    if (!businessId) {
      return errorResponse("Missing business context", 400);
    }
    if (!dealershipId) {
      return errorResponse("Missing active dealership context", 400);
    }
    if (!body.warehouseId) {
      return errorResponse("Warehouse is required", 400);
    }
    if (!body.supplierId) {
      return errorResponse("Supplier (Vendor) is required", 400);
    }
    if (!body.challanNumber || !body.challanNumber.trim()) {
      return errorResponse("Challan number is required", 400);
    }
    if (!body.challanDate) {
      return errorResponse("Challan date is required", 400);
    }

    await connectDB();

    const grn = await GoodsReceiptNoteService.createGrn({
      businessId,
      dealershipId,
      warehouseId: body.warehouseId,
      supplierId: body.supplierId,
      principalCompanyId: body.principalCompanyId,
      purchaseOrderId: body.purchaseOrderId,
      challanNumber: body.challanNumber,
      challanDate: body.challanDate,
      invoiceNumber: body.invoiceNumber,
      invoiceDate: body.invoiceDate,
      items: body.items,
      invoiceDiscount: body.invoiceDiscount,
      invoiceDiscountType: body.invoiceDiscountType,
      cashDiscount: body.cashDiscount,
      tradeDiscount: body.tradeDiscount,
      freightCharge: body.freightCharge,
      handlingCharge: body.handlingCharge,
      otherCharges: body.otherCharges,
      discountAllocationPolicy: body.discountAllocationPolicy,
      notes: body.notes,
      actorId: user.userId,
    });

    const canViewCost = canUserViewPurchaseCost(user);
    return successResponse(
      maskGrnCosts(grn.toObject(), canViewCost),
      "GRN created successfully",
      undefined,
      201
    );
  } catch (err: any) {
    return errorResponse(err.message || "Failed to create GRN", 400);
  }
}
