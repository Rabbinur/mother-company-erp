import type { IGoodsReceiptNote, IGRNItem } from "@/models/GoodsReceiptNote";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import type { TokenPayload } from "@/lib/auth/jwt";

export function canUserViewPurchaseCost(user: TokenPayload | null): boolean {
  if (!user) return false;
  if (user.role === "super_admin" || user.role === "owner" || user.role === "admin") {
    return true;
  }
  return hasPermission(user.role, user.permissions, PERMISSIONS.PRICING_VIEW_PURCHASE_PRICE);
}

export function maskGrnCosts<T extends Partial<IGoodsReceiptNote>>(
  grn: T,
  canViewCost: boolean
): T {
  if (canViewCost) return grn;

  const masked = { ...grn };

  // Commercial totals masked
  delete masked.grossTotal;
  delete masked.totalLineDiscount;
  delete masked.invoiceDiscount;
  delete masked.cashDiscount;
  delete masked.tradeDiscount;
  delete masked.freightCharge;
  delete masked.handlingCharge;
  delete masked.otherCharges;
  delete masked.netInvoiceTotal;

  // Mask each line item
  if (masked.items && Array.isArray(masked.items)) {
    masked.items = masked.items.map((item: IGRNItem) => {
      const itemObj = (item as any).toObject ? (item as any).toObject() : { ...item };
      delete itemObj.unitPurchasePrice;
      delete itemObj.lineDiscount;
      delete itemObj.allocatedInvoiceDiscount;
      delete itemObj.allocatedFreight;
      delete itemObj.allocatedHandling;
      delete itemObj.netLandedUnitCost;
      delete itemObj.lineTotal;
      delete itemObj.taxAmount;
      return itemObj;
    });
  }

  return masked;
}
