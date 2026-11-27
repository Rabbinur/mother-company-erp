import mongoose from "mongoose";
import { GoodsReceiptNote, type IGoodsReceiptNote } from "@/models/GoodsReceiptNote";
import { Dispatch, type IDispatch } from "@/models/Dispatch";
import { StockMovement, type IStockMovement } from "@/models/StockMovement";
import { StockBatch, type IStockBatch } from "@/models/StockBatch";
import type { WarehouseOperationsData } from "./types";

export class WarehouseOperationsService {
  static async getWarehouseOperationsData(params: {
    businessId: mongoose.Types.ObjectId;
    dealershipId?: mongoose.Types.ObjectId;
    warehouseId?: mongoose.Types.ObjectId;
    startDate: Date;
    endDate: Date;
  }): Promise<WarehouseOperationsData> {
    const grnQuery: any = {
      businessId: params.businessId,
      isCancelled: { $ne: true },
      createdAt: { $gte: params.startDate, $lte: params.endDate },
    };
    if (params.dealershipId) grnQuery.dealershipId = params.dealershipId;
    if (params.warehouseId) grnQuery.warehouseId = params.warehouseId;

    const dispatchQuery: any = {
      businessId: params.businessId,
      status: { $ne: "CANCELLED" },
      createdAt: { $gte: params.startDate, $lte: params.endDate },
    };
    if (params.dealershipId) dispatchQuery.dealershipIds = params.dealershipId;
    if (params.warehouseId) dispatchQuery.warehouseId = params.warehouseId;

    const movementQuery: any = {
      businessId: params.businessId,
      createdAt: { $gte: params.startDate, $lte: params.endDate },
    };
    if (params.dealershipId) movementQuery.dealershipId = params.dealershipId;
    if (params.warehouseId) movementQuery.warehouseId = params.warehouseId;

    const batchQuery: any = {
      businessId: params.businessId,
      status: "quarantined",
    };
    if (params.dealershipId) batchQuery.dealershipId = params.dealershipId;
    if (params.warehouseId) batchQuery.warehouseId = params.warehouseId;

    const [grns, dispatches, movements, quarantinedBatches] = await Promise.all([
      GoodsReceiptNote.find(grnQuery).lean(),
      Dispatch.find(dispatchQuery).lean(),
      StockMovement.find(movementQuery).lean(),
      StockBatch.find(batchQuery).lean(),
    ]);

    // 1. GRN Receiving & Verification
    let totalGrnsReceived = grns.length;
    let verifiedGrnsCount = 0;
    let pendingVerificationCount = 0;
    let needsReviewCount = 0;
    let totalVerificationMs = 0;
    let verifiedCountWithTimestamps = 0;

    for (const grn of grns) {
      if (grn.status === "VERIFIED") {
        verifiedGrnsCount++;
        if (grn.verifiedAt && grn.createdAt) {
          const ms = new Date(grn.verifiedAt).getTime() - new Date(grn.createdAt).getTime();
          if (ms > 0) {
            totalVerificationMs += ms;
            verifiedCountWithTimestamps++;
          }
        }
      } else if (grn.status === "NEEDS_REVIEW") {
        needsReviewCount++;
      } else if (
        grn.status === "DRAFT" ||
        grn.status === "OCR_PROCESSING" ||
        grn.status === "READY_FOR_CONFIRMATION"
      ) {
        pendingVerificationCount++;
      }
    }

    const averageVerificationHours = verifiedCountWithTimestamps > 0
      ? Number((totalVerificationMs / verifiedCountWithTimestamps / (1000 * 60 * 60)).toFixed(1))
      : null;

    // 2. Dispatch Readiness & Day-End Reconciliation
    let pendingDispatchCount = 0;
    let readyForDispatchCount = 0;
    let loadedCount = 0;
    let inTransitCount = 0;
    let dayEndReconciliationsCount = 0;
    let completedReconciliationsCount = 0;
    let incompleteReconciliationsCount = 0;
    let dispatchesWithVarianceCount = 0;

    for (const d of dispatches) {
      if (d.status === "PENDING_DISPATCH") pendingDispatchCount++;
      else if (d.status === "READY_FOR_DISPATCH") readyForDispatchCount++;
      else if (d.status === "LOADED") loadedCount++;
      else if (d.status === "IN_TRANSIT") inTransitCount++;

      if (d.reconciliation) {
        dayEndReconciliationsCount++;
        const rec = d.reconciliation;
        const hasStockVariance = typeof rec.stockVariance === "number";
        const hasCashDiff = typeof rec.cashDifference === "number";
        const hasBalanced = typeof rec.isStockBalanced === "boolean";

        const hasEvidence = hasStockVariance || hasCashDiff || hasBalanced;

        if (!hasEvidence) {
          // Missing/undefined evidence must NOT automatically trigger discrepancy alerts
          incompleteReconciliationsCount++;
        } else {
          completedReconciliationsCount++;
          // Confirmed variance exists ONLY if non-zero variance or explicitly unbalanced
          const isStockUnbalanced = hasBalanced && rec.isStockBalanced === false;
          const hasNonZeroStockVariance = hasStockVariance && rec.stockVariance !== 0;
          const hasNonZeroCashDiff = hasCashDiff && rec.cashDifference !== 0;

          if (isStockUnbalanced || hasNonZeroStockVariance || hasNonZeroCashDiff) {
            dispatchesWithVarianceCount++;
          }
        }
      }
    }

    let reconciliationStatus: "CONFIGURED" | "INCOMPLETE" | "NOT_CONFIGURED" = "NOT_CONFIGURED";
    if (dayEndReconciliationsCount > 0) {
      if (completedReconciliationsCount > 0 && incompleteReconciliationsCount === 0) {
        reconciliationStatus = "CONFIGURED";
      } else {
        reconciliationStatus = "INCOMPLETE";
      }
    }

    // 3. Stock Movements (Transfers & Adjustments)
    let warehouseTransfersCount = 0;
    let totalQuantityTransferred = 0;
    let stockAdjustmentsCount = 0;
    let netAdjustmentQuantity = 0;

    for (const m of movements) {
      if (m.type === "warehouse_transfer_in" || m.type === "warehouse_transfer_out") {
        warehouseTransfersCount++;
        totalQuantityTransferred += Math.abs(m.quantity || 0);
      } else if (
        m.type === "manual_adjustment" ||
        m.type === "physical_count_adjustment" ||
        m.type === "correction" ||
        m.type === "damage"
      ) {
        stockAdjustmentsCount++;
        netAdjustmentQuantity += m.quantity || 0;
      }
    }

    // 4. Damaged & Quarantined Batches
    const quarantinedBatchesCount = quarantinedBatches.length;
    let quarantinedQuantity = 0;
    for (const b of quarantinedBatches) {
      quarantinedQuantity += b.remainingQuantity || 0;
    }

    return {
      grnReceiving: {
        totalGrnsReceived,
        verifiedGrnsCount,
        pendingVerificationCount,
        needsReviewCount,
        averageVerificationHours,
      },
      putAwayActivity: "NOT_CONFIGURED",
      pickingActivity: "NOT_CONFIGURED",
      dispatchReadiness: {
        pendingDispatchCount,
        readyForDispatchCount,
        loadedCount,
        inTransitCount,
      },
      warehouseTransfersCount,
      totalQuantityTransferred,
      stockAdjustmentsCount,
      netAdjustmentQuantity,
      quarantinedBatchesCount,
      quarantinedQuantity,
      dayEndReconciliationsCount,
      completedReconciliationsCount,
      incompleteReconciliationsCount,
      dispatchesWithVarianceCount,
      reconciliationStatus,
    };
  }
}
