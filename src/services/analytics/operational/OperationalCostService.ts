import mongoose from "mongoose";
import { Dispatch, type IDispatch } from "@/models/Dispatch";
import { Claim, type IClaim } from "@/models/Claim";
import type { OperationalCostData } from "./types";

export class OperationalCostService {
  static async getOperationalCostData(params: {
    businessId: mongoose.Types.ObjectId;
    dealershipId?: mongoose.Types.ObjectId;
    warehouseId?: mongoose.Types.ObjectId;
    principalCompanyId?: mongoose.Types.ObjectId;
    startDate: Date;
    endDate: Date;
    canViewCosts: boolean;
    dealershipMap: Map<string, { name: string; code: string }>;
    totalFulfilledDeliveries: number;
    totalDeliveredQuantity: number;
  }): Promise<OperationalCostData> {
    if (!params.canViewCosts) {
      return {
        totalDeliveryExpenses: null,
        costPerFulfilledOrder: null,
        costPerDeliveredUnit: null,
        allocatedDeliveryCostByDealership: [],
        tripExpenseTypeBreakdown: {},
        workerHandlingCostTotal: null,
        pendingPrincipalReimbursementClaimsCount: 0,
        pendingPrincipalReimbursementAmount: null,
        principalReceivableAmount: null,
        settledReimbursementAmount: null,
      };
    }

    const dispatchQuery: any = {
      businessId: params.businessId,
      status: { $ne: "CANCELLED" },
      createdAt: { $gte: params.startDate, $lte: params.endDate },
    };
    if (params.dealershipId) dispatchQuery.dealershipIds = params.dealershipId;
    if (params.warehouseId) dispatchQuery.warehouseId = params.warehouseId;

    const claimQuery: any = {
      businessId: params.businessId,
      claimCategory: "principal_reimbursement",
      createdAt: { $gte: params.startDate, $lte: params.endDate },
    };
    if (params.dealershipId) claimQuery.dealershipId = params.dealershipId;
    if (params.principalCompanyId) claimQuery.principalCompanyId = params.principalCompanyId;

    const [dispatches, claims] = await Promise.all([
      Dispatch.find(dispatchQuery).lean(),
      Claim.find(claimQuery).lean(),
    ]);

    let totalDeliveryExpenses = 0;
    let workerHandlingCostTotal = 0;
    const tripExpenseTypeBreakdown: Record<string, number> = {};
    const dealershipAllocationMap = new Map<string, number>();

    for (const d of dispatches) {
      // Expenses
      for (const exp of d.expenses || []) {
        const amt = exp.amount || 0;
        totalDeliveryExpenses += amt;
        const eType = exp.expenseType || "other";
        tripExpenseTypeBreakdown[eType] = (tripExpenseTypeBreakdown[eType] || 0) + amt;

        if (exp.dealershipAllocations && exp.dealershipAllocations.length > 0) {
          for (const alloc of exp.dealershipAllocations) {
            const dKey = String(alloc.dealershipId);
            dealershipAllocationMap.set(dKey, (dealershipAllocationMap.get(dKey) || 0) + (alloc.amount || 0));
          }
        } else if (d.dealershipIds && d.dealershipIds.length > 0) {
          const splitAmt = amt / d.dealershipIds.length;
          for (const dId of d.dealershipIds) {
            const dKey = String(dId);
            dealershipAllocationMap.set(dKey, (dealershipAllocationMap.get(dKey) || 0) + splitAmt);
          }
        }
      }

      // Worker handling costs
      for (const w of d.workers || []) {
        workerHandlingCostTotal += w.totalAmount || 0;
      }
    }

    // Principal Reimbursement Claims
    let pendingClaimsCount = 0;
    let pendingClaimsAmount = 0;
    let principalReceivableAmount = 0;
    let settledReimbursementAmount = 0;

    for (const c of claims) {
      if (c.status === "SUBMITTED" || c.status === "UNDER_REVIEW") {
        pendingClaimsCount++;
        pendingClaimsAmount += c.claimedAmount || 0;
      } else if (c.status === "APPROVED") {
        pendingClaimsCount++;
        const approved = c.approvedAmount ?? c.claimedAmount ?? 0;
        const settled = c.settledAmount || 0;
        pendingClaimsAmount += approved;
        principalReceivableAmount += Math.max(0, approved - settled);
      } else if (c.status === "SETTLED") {
        settledReimbursementAmount += c.settledAmount || c.approvedAmount || c.claimedAmount || 0;
      }
    }

    const costPerFulfilledOrder = params.totalFulfilledDeliveries > 0
      ? Number((totalDeliveryExpenses / params.totalFulfilledDeliveries).toFixed(2))
      : 0;

    const costPerDeliveredUnit = params.totalDeliveredQuantity > 0
      ? Number((totalDeliveryExpenses / params.totalDeliveredQuantity).toFixed(2))
      : 0;

    const allocatedDeliveryCostByDealership = Array.from(dealershipAllocationMap.entries()).map(([dId, amt]) => {
      const info = params.dealershipMap.get(dId);
      return {
        dealershipId: dId,
        dealershipName: info?.name || "Dealership",
        allocatedAmount: Number(amt.toFixed(2)),
      };
    });

    return {
      totalDeliveryExpenses: Number(totalDeliveryExpenses.toFixed(2)),
      costPerFulfilledOrder,
      costPerDeliveredUnit,
      allocatedDeliveryCostByDealership,
      tripExpenseTypeBreakdown,
      workerHandlingCostTotal: Number(workerHandlingCostTotal.toFixed(2)),
      pendingPrincipalReimbursementClaimsCount: pendingClaimsCount,
      pendingPrincipalReimbursementAmount: Number(pendingClaimsAmount.toFixed(2)),
      principalReceivableAmount: Number(principalReceivableAmount.toFixed(2)),
      settledReimbursementAmount: Number(settledReimbursementAmount.toFixed(2)),
    };
  }
}
