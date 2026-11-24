import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { PurchaseOrderService } from "@/services/PurchaseOrderService";
import { requireAuth } from "@/lib/auth/session";
import { canUserViewPurchaseCost } from "@/lib/grn/cost-masking";
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

  try {
    const po: any = await PurchaseOrderService.getPurchaseOrderDetails(id);

    const canViewCost = canUserViewPurchaseCost(user);
    if (!canViewCost) {
      delete po.subtotal;
      delete po.discountTotal;
      delete po.grandTotal;
      delete po.paidAmount;
      delete po.balanceDue;
      if (po.items) {
        po.items = po.items.map((it: any) => {
          const copy = { ...it };
          delete copy.unitCost;
          delete copy.discount;
          delete copy.subtotal;
          return copy;
        });
      }
    }

    return successResponse(po);
  } catch (err: any) {
    return notFoundResponse(err.message || "Purchase Order not found");
  }
}
