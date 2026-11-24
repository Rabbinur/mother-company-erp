import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { GoodsReceiptNote } from "@/models/GoodsReceiptNote";
import { GoodsReceiptNoteService } from "@/services/GoodsReceiptNoteService";
import { requireAuth } from "@/lib/auth/session";
import { canUserViewPurchaseCost, maskGrnCosts } from "@/lib/grn/cost-masking";
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  errorResponse,
} from "@/lib/utils/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { id } = await params;
  await connectDB();

  const grn = await GoodsReceiptNote.findById(id)
    .populate("supplierId", "name companyName phone email address taxVatNumber")
    .populate("warehouseId", "name code address")
    .populate("dealershipId", "name code")
    .populate("principalCompanyId", "name code")
    .populate("createdBy", "name email")
    .populate("verifiedBy", "name email")
    .lean();

  if (!grn) return notFoundResponse("GRN not found");

  const canViewCost = canUserViewPurchaseCost(user);
  return successResponse(maskGrnCosts(grn as any, canViewCost));
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { id } = await params;
  await connectDB();

  try {
    const body = await req.json();

    const updated = await GoodsReceiptNoteService.updateGrn(id, {
      items: body.items || [],
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
      reason: body.reason,
    });

    const canViewCost = canUserViewPurchaseCost(user);
    return successResponse(maskGrnCosts(updated.toObject(), canViewCost));
  } catch (err: any) {
    return errorResponse(err.message || "Failed to update GRN", 400);
  }
}
