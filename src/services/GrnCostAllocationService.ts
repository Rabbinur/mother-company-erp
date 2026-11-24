import type { IGRNItem } from "@/models/GoodsReceiptNote";
import { InventoryCostingService } from "./InventoryCostingService";

export interface AllocationTotalsInput {
  items: Array<{
    challanQuantity: number;
    supplierSchemeFreeQuantity?: number;
    manualFreeQuantity?: number;
    receivedQuantity?: number;
    unitPurchasePrice: number;
    lineDiscount?: number;
    lineDiscountType?: "fixed" | "percentage";
    taxAmount?: number;
  }>;
  invoiceDiscount?: number;
  invoiceDiscountType?: "fixed" | "percentage";
  cashDiscount?: number;
  tradeDiscount?: number;
  freightCharge?: number;
  handlingCharge?: number;
  otherCharges?: number;
  allocationPolicy?: "proportional_value" | "proportional_quantity";
  freeGoodsPolicy?: "absorb_into_unit_cost" | "separate_zero_cost_batch";
}

export interface AllocatedResult {
  items: Array<IGRNItem>;
  grossTotal: number;
  totalLineDiscount: number;
  invoiceDiscount: number;
  cashDiscount: number;
  tradeDiscount: number;
  freightCharge: number;
  handlingCharge: number;
  otherCharges: number;
  taxTotal: number;
  netInvoiceTotal: number;
}

export class GrnCostAllocationService {
  /**
   * Allocate invoice-level discounts, freight, and handling across GRN line items
   */
  static allocateCosts(input: AllocationTotalsInput): AllocatedResult {
    const policy = input.allocationPolicy || "proportional_value";
    const freeGoodsPolicy = input.freeGoodsPolicy || "absorb_into_unit_cost";

    let grossTotal = 0;
    let totalLineDiscount = 0;
    let totalNetBeforeInvoice = 0;
    let totalQuantity = 0;
    let taxTotal = 0;

    // 1. First pass: compute line totals and base totals
    const preparedLines = input.items.map((item, idx) => {
      const challanQty = Math.max(0, Number(item.challanQuantity || 0));
      const schemeFreeQty = Math.max(0, Number(item.supplierSchemeFreeQuantity || 0));
      const manualFreeQty = Math.max(0, Number(item.manualFreeQuantity || 0));
      const receivedQty = item.receivedQuantity !== undefined
        ? Math.max(0, Number(item.receivedQuantity))
        : challanQty;
      const unitPrice = Math.max(0, Number(item.unitPurchasePrice || 0));

      const lineGross = challanQty * unitPrice;
      grossTotal += lineGross;

      let lineDisc = 0;
      if (item.lineDiscountType === "percentage") {
        lineDisc = (lineGross * Math.min(100, Math.max(0, Number(item.lineDiscount || 0)))) / 100;
      } else {
        lineDisc = Math.min(lineGross, Math.max(0, Number(item.lineDiscount || 0)));
      }
      totalLineDiscount += lineDisc;

      const netLine = Math.max(0, lineGross - lineDisc);
      totalNetBeforeInvoice += netLine;
      totalQuantity += challanQty + schemeFreeQty + manualFreeQty;

      const lineTax = Math.max(0, Number(item.taxAmount || 0));
      taxTotal += lineTax;

      return {
        ...item,
        lineItemNumber: idx + 1,
        challanQuantity: challanQty,
        supplierSchemeFreeQuantity: schemeFreeQty,
        manualFreeQuantity: manualFreeQty,
        receivedQuantity: receivedQty,
        shortageQuantity: Math.max(0, challanQty - receivedQty),
        excessQuantity: Math.max(0, receivedQty - challanQty),
        unitPurchasePrice: unitPrice,
        lineGross,
        lineDiscount: lineDisc,
        netLine,
        taxAmount: lineTax,
      };
    });

    // 2. Compute invoice discount
    let invDiscount = 0;
    if (input.invoiceDiscountType === "percentage") {
      invDiscount = (totalNetBeforeInvoice * Math.min(100, Math.max(0, Number(input.invoiceDiscount || 0)))) / 100;
    } else {
      invDiscount = Math.min(totalNetBeforeInvoice, Math.max(0, Number(input.invoiceDiscount || 0)));
    }

    const cashDisc = Math.max(0, Number(input.cashDiscount || 0));
    const tradeDisc = Math.max(0, Number(input.tradeDiscount || 0));
    const freight = Math.max(0, Number(input.freightCharge || 0));
    const handling = Math.max(0, Number(input.handlingCharge || 0));
    const other = Math.max(0, Number(input.otherCharges || 0));

    // Combine invoice discount with trade discount for line allocation
    const totalDistributableDiscount = invDiscount + tradeDisc;
    const totalDistributableExpenses = freight + handling + other;

    // 3. Second pass: Allocate invoice discounts and expenses proportionally
    let allocatedDiscountSum = 0;
    let allocatedFreightSum = 0;
    let allocatedHandlingSum = 0;

    const allocatedItems = preparedLines.map((line, idx) => {
      let ratio = 0;
      if (policy === "proportional_quantity") {
        ratio = totalQuantity > 0 ? (line.challanQuantity + line.supplierSchemeFreeQuantity + line.manualFreeQuantity) / totalQuantity : 0;
      } else {
        // proportional_value
        ratio = totalNetBeforeInvoice > 0 ? line.netLine / totalNetBeforeInvoice : 0;
      }

      // Handle remainder on last item to prevent rounding loss
      const isLast = idx === preparedLines.length - 1;
      const allocatedInvDisc = isLast
        ? Math.max(0, totalDistributableDiscount - allocatedDiscountSum)
        : Math.round(totalDistributableDiscount * ratio * 100) / 100;
      allocatedDiscountSum += allocatedInvDisc;

      const allocatedFr = isLast
        ? Math.max(0, freight - allocatedFreightSum)
        : Math.round(freight * ratio * 100) / 100;
      allocatedFreightSum += allocatedFr;

      const allocatedHnd = isLast
        ? Math.max(0, (handling + other) - allocatedHandlingSum)
        : Math.round((handling + other) * ratio * 100) / 100;
      allocatedHandlingSum += allocatedHnd;

      // Net Landed Cost calculation
      // Effective units received (use physically received if available, otherwise challan)
      const effectiveUnits = line.receivedQuantity > 0 ? line.receivedQuantity : line.challanQuantity;
      const totalUnitsWithFree = effectiveUnits + line.supplierSchemeFreeQuantity + line.manualFreeQuantity;

      const totalLandedItemCost = Math.max(
        0,
        (effectiveUnits * line.unitPurchasePrice) -
          (line.lineDiscount + allocatedInvDisc) +
          allocatedFr +
          allocatedHnd
      );

      const netLandedUnitCost = totalUnitsWithFree > 0
        ? Math.round((totalLandedItemCost / totalUnitsWithFree) * 10000) / 10000
        : line.unitPurchasePrice;

      const lineTotal = Math.max(0, line.lineGross - line.lineDiscount);

      return {
        lineItemNumber: line.lineItemNumber,
        productName: (line as any).productName || "Item " + line.lineItemNumber,
        productId: (line as any).productId || null,
        variantId: (line as any).variantId || null,
        sku: (line as any).sku,
        barcode: (line as any).barcode,
        uom: (line as any).uom || "pcs",
        matchStatus: (line as any).matchStatus || "unmatched",
        matchConfidence: (line as any).matchConfidence || 0,
        matchedVariantName: (line as any).matchedVariantName,

        challanQuantity: line.challanQuantity,
        supplierSchemeFreeQuantity: line.supplierSchemeFreeQuantity,
        manualFreeQuantity: line.manualFreeQuantity,

        receivedQuantity: line.receivedQuantity,
        shortageQuantity: line.shortageQuantity,
        excessQuantity: line.excessQuantity,
        damagedQuantity: Math.max(0, Number((line as any).damagedQuantity || 0)),
        rejectedQuantity: Math.max(0, Number((line as any).rejectedQuantity || 0)),

        batchNumber: (line as any).batchNumber,
        manufacturingDate: (line as any).manufacturingDate || null,
        expiryDate: (line as any).expiryDate || null,

        unitPurchasePrice: line.unitPurchasePrice,
        lineDiscount: line.lineDiscount,
        lineDiscountType: line.lineDiscountType || "fixed",
        allocatedInvoiceDiscount: allocatedInvDisc,
        allocatedFreight: allocatedFr,
        allocatedHandling: allocatedHnd,
        netLandedUnitCost,
        lineTotal,
        taxAmount: line.taxAmount,
        notes: (line as any).notes,
      } as IGRNItem;
    });

    // Cash discount is conditional upon prompt payment; it does not reduce invoice billed total or inventory landed cost before being earned
    const netInvoiceTotal = Math.max(
      0,
      grossTotal -
        totalLineDiscount -
        invDiscount -
        tradeDisc +
        freight +
        handling +
        other +
        taxTotal
    );

    return {
      items: allocatedItems,
      grossTotal: Math.round(grossTotal * 100) / 100,
      totalLineDiscount: Math.round(totalLineDiscount * 100) / 100,
      invoiceDiscount: Math.round(invDiscount * 100) / 100,
      cashDiscount: Math.round(cashDisc * 100) / 100,
      tradeDiscount: Math.round(tradeDisc * 100) / 100,
      freightCharge: Math.round(freight * 100) / 100,
      handlingCharge: Math.round(handling * 100) / 100,
      otherCharges: Math.round(other * 100) / 100,
      taxTotal: Math.round(taxTotal * 100) / 100,
      netInvoiceTotal: Math.round(netInvoiceTotal * 100) / 100,
    };
  }
}
