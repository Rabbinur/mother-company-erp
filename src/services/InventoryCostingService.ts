import mongoose from "mongoose";
import { StockBatch, type IStockBatch } from "@/models/StockBatch";

export interface BatchDepletionItem {
  batchId: mongoose.Types.ObjectId;
  batchNumber?: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface FifoDepletionResult {
  totalCost: number;
  weightedUnitCost: number;
  batchesConsumed: BatchDepletionItem[];
}

export interface PurchaseCostInput {
  businessId: string | mongoose.Types.ObjectId;
  dealershipId: string | mongoose.Types.ObjectId;
  warehouseId: string | mongoose.Types.ObjectId;
  productId: string | mongoose.Types.ObjectId;
  variantId: string | mongoose.Types.ObjectId;
  supplierId?: string | mongoose.Types.ObjectId | null;
  principalCompanyId?: string | mongoose.Types.ObjectId | null;
  batchNumber?: string;
  purchaseInvoiceRef?: string;
  challanNumber?: string;
  receiptDate?: Date;
  manufacturingDate?: Date | null;
  expiryDate?: Date | null;
  purchasedQuantity: number;
  supplierSchemeFreeQuantity?: number;
  manualFreeQuantity?: number;
  grossPurchasePrice: number;
  lineDiscount?: number;
  allocatedFreight?: number;
  allocatedHandling?: number;
  freeGoodsPolicy?: "absorb_into_unit_cost" | "separate_zero_cost_batch";
  currency?: string;
}

export class InventoryCostingService {
  /**
   * Calculate exact net landed unit cost for a purchase receipt snapshot
   */
  static calculateLandedCost(input: {
    purchasedQuantity: number;
    supplierSchemeFreeQuantity?: number;
    manualFreeQuantity?: number;
    grossPurchasePrice: number;
    lineDiscount?: number;
    allocatedFreight?: number;
    allocatedHandling?: number;
    freeGoodsPolicy?: "absorb_into_unit_cost" | "separate_zero_cost_batch";
  }): { netLandedUnitCost: number; totalReceivedQuantity: number; totalLandedCost: number } {
    const purchased = Math.max(0, Number(input.purchasedQuantity || 0));
    const schemeFree = Math.max(0, Number(input.supplierSchemeFreeQuantity || 0));
    const manualFree = Math.max(0, Number(input.manualFreeQuantity || 0));
    const totalReceived = purchased + schemeFree + manualFree;

    if (totalReceived <= 0) {
      throw new Error("Total received quantity must be greater than zero");
    }

    const gross = Number(input.grossPurchasePrice || 0);
    const discount = Number(input.lineDiscount || 0);
    const freight = Number(input.allocatedFreight || 0);
    const handling = Number(input.allocatedHandling || 0);

    // Total net landed expenditure for the shipment
    const totalLandedCost = Math.max(0, gross - discount + freight + handling);

    // Cost allocation policy
    const policy = input.freeGoodsPolicy || "absorb_into_unit_cost";
    const divisor = policy === "absorb_into_unit_cost" ? totalReceived : (purchased > 0 ? purchased : totalReceived);

    const netLandedUnitCost = Math.round((totalLandedCost / divisor) * 100) / 100;

    return {
      netLandedUnitCost,
      totalReceivedQuantity: totalReceived,
      totalLandedCost,
    };
  }

  /**
   * Record a verified purchase cost snapshot (Batch layer)
   */
  static async recordPurchaseBatch(
    input: PurchaseCostInput,
    session?: mongoose.ClientSession
  ): Promise<IStockBatch> {
    const bId = new mongoose.Types.ObjectId(String(input.businessId));
    const dId = new mongoose.Types.ObjectId(String(input.dealershipId));
    const wId = new mongoose.Types.ObjectId(String(input.warehouseId));
    const pId = new mongoose.Types.ObjectId(String(input.productId));
    const vId = new mongoose.Types.ObjectId(String(input.variantId));

    const costCalc = this.calculateLandedCost({
      purchasedQuantity: input.purchasedQuantity,
      supplierSchemeFreeQuantity: input.supplierSchemeFreeQuantity,
      manualFreeQuantity: input.manualFreeQuantity,
      grossPurchasePrice: input.grossPurchasePrice,
      lineDiscount: input.lineDiscount,
      allocatedFreight: input.allocatedFreight,
      allocatedHandling: input.allocatedHandling,
      freeGoodsPolicy: input.freeGoodsPolicy,
    });

    const batchDoc = await StockBatch.create(
      [
        {
          businessId: bId,
          dealershipId: dId,
          warehouseId: wId,
          productId: pId,
          variantId: vId,
          supplierId: input.supplierId ? new mongoose.Types.ObjectId(String(input.supplierId)) : null,
          principalCompanyId: input.principalCompanyId
            ? new mongoose.Types.ObjectId(String(input.principalCompanyId))
            : null,
          batchNumber: input.batchNumber,
          purchaseInvoiceRef: input.purchaseInvoiceRef,
          challanNumber: input.challanNumber,
          receiptDate: input.receiptDate || new Date(),
          manufacturingDate: input.manufacturingDate || null,
          expiryDate: input.expiryDate || null,
          purchasedQuantity: input.purchasedQuantity,
          supplierSchemeFreeQuantity: input.supplierSchemeFreeQuantity || 0,
          manualFreeQuantity: input.manualFreeQuantity || 0,
          totalReceivedQuantity: costCalc.totalReceivedQuantity,
          remainingQuantity: costCalc.totalReceivedQuantity,
          reservedQuantity: 0,
          grossPurchasePrice: input.grossPurchasePrice,
          lineDiscount: input.lineDiscount || 0,
          allocatedFreight: input.allocatedFreight || 0,
          allocatedHandling: input.allocatedHandling || 0,
          netLandedUnitCost: costCalc.netLandedUnitCost,
          currency: input.currency || "BDT",
          status: "active",
        },
      ],
      session ? { session } : {}
    );

    return batchDoc[0];
  }

  /**
   * Deplete stock using FIFO (or FEFO) and calculate historical Cost of Goods Sold (COGS).
   * Crucial: never relies on current Product.purchasePrice!
   */
  static async depleteFifoStock(params: {
    dealershipId: string | mongoose.Types.ObjectId;
    productId: string | mongoose.Types.ObjectId;
    variantId: string | mongoose.Types.ObjectId;
    quantity: number;
    useFefo?: boolean;
    session?: mongoose.ClientSession;
  }): Promise<FifoDepletionResult> {
    const dId = new mongoose.Types.ObjectId(String(params.dealershipId));
    const pId = new mongoose.Types.ObjectId(String(params.productId));
    const vId = new mongoose.Types.ObjectId(String(params.variantId));
    let needed = Number(params.quantity);

    if (needed <= 0) {
      return { totalCost: 0, weightedUnitCost: 0, batchesConsumed: [] };
    }

    // Sort order: FEFO sorts by expiryDate asc; FIFO sorts by receiptDate asc
    const sortField: Record<string, 1> = params.useFefo ? { expiryDate: 1 } : { receiptDate: 1 };

    const activeBatches = await StockBatch.find({
      dealershipId: dId,
      productId: pId,
      variantId: vId,
      status: "active",
      remainingQuantity: { $gt: 0 },
    })
      .sort(sortField)
      .session(params.session || null);

    let totalCost = 0;
    const consumed: BatchDepletionItem[] = [];

    for (const batch of activeBatches) {
      if (needed <= 0) break;

      const take = Math.min(batch.remainingQuantity, needed);
      const batchCost = take * batch.netLandedUnitCost;

      batch.remainingQuantity -= take;
      if (batch.remainingQuantity === 0) {
        batch.status = "depleted";
      }
      await batch.save({ session: params.session });

      consumed.push({
        batchId: batch._id as mongoose.Types.ObjectId,
        batchNumber: batch.batchNumber,
        quantity: take,
        unitCost: batch.netLandedUnitCost,
        totalCost: batchCost,
      });

      totalCost += batchCost;
      needed -= take;
    }

    // If remaining needed > 0, fallback to oldest or default unit cost for legacy stock
    if (needed > 0) {
      // Record remainder as standard unbatched layer
      const fallbackCost = activeBatches.length > 0 ? activeBatches[0].netLandedUnitCost : 0;
      totalCost += needed * fallbackCost;
      consumed.push({
        batchId: new mongoose.Types.ObjectId(),
        batchNumber: "LEGACY-UNBATCHED",
        quantity: needed,
        unitCost: fallbackCost,
        totalCost: needed * fallbackCost,
      });
    }

    const weightedUnitCost =
      params.quantity > 0 ? Math.round((totalCost / params.quantity) * 100) / 100 : 0;

    return {
      totalCost: Math.round(totalCost * 100) / 100,
      weightedUnitCost,
      batchesConsumed: consumed,
    };
  }

  /**
   * Calculate weighted average cost across remaining inventory for a product variant
   */
  static async calculateWeightedAverageCost(params: {
    dealershipId: string | mongoose.Types.ObjectId;
    productId: string | mongoose.Types.ObjectId;
    variantId: string | mongoose.Types.ObjectId;
  }): Promise<{ averageUnitCost: number; totalRemainingQuantity: number; totalValuation: number }> {
    const dId = new mongoose.Types.ObjectId(String(params.dealershipId));
    const pId = new mongoose.Types.ObjectId(String(params.productId));
    const vId = new mongoose.Types.ObjectId(String(params.variantId));

    const batches = await StockBatch.find({
      dealershipId: dId,
      productId: pId,
      variantId: vId,
      status: "active",
      remainingQuantity: { $gt: 0 },
    }).lean();

    let totalQty = 0;
    let totalValuation = 0;

    for (const b of batches) {
      totalQty += b.remainingQuantity;
      totalValuation += b.remainingQuantity * b.netLandedUnitCost;
    }

    const averageUnitCost = totalQty > 0 ? Math.round((totalValuation / totalQty) * 100) / 100 : 0;

    return {
      averageUnitCost,
      totalRemainingQuantity: totalQty,
      totalValuation: Math.round(totalValuation * 100) / 100,
    };
  }

  /**
   * Calculate total inventory valuation for a dealership based on historical landed costs
   */
  static async calculateDealershipValuation(params: {
    dealershipId: string | mongoose.Types.ObjectId;
    warehouseId?: string | mongoose.Types.ObjectId;
  }): Promise<{ totalValuation: number; totalUnits: number; batchCount: number }> {
    const query: Record<string, unknown> = {
      dealershipId: new mongoose.Types.ObjectId(String(params.dealershipId)),
      status: "active",
      remainingQuantity: { $gt: 0 },
    };

    if (params.warehouseId) {
      query.warehouseId = new mongoose.Types.ObjectId(String(params.warehouseId));
    }

    const batches = await StockBatch.find(query).lean();

    let totalValuation = 0;
    let totalUnits = 0;

    for (const b of batches) {
      totalUnits += b.remainingQuantity;
      totalValuation += b.remainingQuantity * b.netLandedUnitCost;
    }

    return {
      totalValuation: Math.round(totalValuation * 100) / 100,
      totalUnits,
      batchCount: batches.length,
    };
  }
}
