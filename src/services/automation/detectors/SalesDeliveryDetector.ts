import mongoose from "mongoose";
import { Order } from "@/models/Order";
import { Dispatch } from "@/models/Dispatch";
import { SalesReturn } from "@/models/SalesReturn";
import { Claim } from "@/models/Claim";
import type { IAutomationRule } from "@/models/AutomationRule";
import type { DetectorResult, DetectedCondition } from "../types";

export class SalesDeliveryDetector {
  static async evaluate(params: {
    rule: IAutomationRule;
    businessId: mongoose.Types.ObjectId;
    dealershipId?: mongoose.Types.ObjectId;
  }): Promise<DetectorResult> {
    const { rule, businessId, dealershipId } = params;
    const ruleKey = rule.ruleKey;
    const config = rule.configuration || {};
    const conditions: DetectedCondition[] = [];
    const now = new Date();

    const baseFilter: Record<string, any> = { businessId };
    if (dealershipId) baseFilter.dealershipId = dealershipId;

    let evaluatedCount = 0;

    if (ruleKey === "UNFULFILLED_ORDER_OVERDUE") {
      const maxAgingDays = config.maxAgingDays ?? 2;
      const cutoff = new Date(now.getTime() - maxAgingDays * 86400000);

      const orders = await Order.find({
        ...baseFilter,
        orderStatus: { $in: ["confirmed", "processing", "CONFIRMED"] },
        fulfillmentStatus: { $in: ["unfulfilled", "partially_fulfilled"] },
        orderDate: { $lte: cutoff },
      }).lean();
      evaluatedCount = orders.length;

      for (const ord of orders) {
        const days = Math.floor((now.getTime() - new Date(ord.orderDate).getTime()) / 86400000);
        conditions.push({
          ruleKey,
          category: "SALES",
          severity: rule.severity,
          title: `Unfulfilled Order Aging: #${ord.orderNumber}`,
          message: `Order #${ord.orderNumber} has remained unfulfilled for ${days} days since confirmation.`,
          sourceEntityType: "Order",
          sourceEntityId: String(ord._id),
          dealershipId: ord.dealershipId ? String(ord.dealershipId) : undefined,
          deduplicationKey: `${businessId}:${ruleKey}:${ord._id}`,
          metadata: { orderId: String(ord._id), orderNumber: ord.orderNumber, daysAging: days, totalAmount: ord.totalAmount },
        });
      }
    } else if (ruleKey === "DISPATCH_UNRESOLVED_STOPS") {
      const dispatches = await Dispatch.find({
        ...baseFilter,
        status: { $in: ["IN_TRANSIT", "PARTIALLY_DELIVERED", "DELIVERY_FAILED"] },
      }).lean();
      evaluatedCount = dispatches.length;

      for (const disp of dispatches) {
        const dId = disp.dealershipIds && disp.dealershipIds.length > 0 ? String(disp.dealershipIds[0]) : undefined;
        const unresolved = (disp.orders || (disp as any).stops || []).filter((s: any) =>
          ["pending", "failed", "rejected"].includes(s.status)
        );
        if (unresolved.length > 0) {
          conditions.push({
            ruleKey,
            category: "SALES",
            severity: rule.severity,
            title: `Dispatch Trip with Unresolved Stops: ${disp.dispatchNumber}`,
            message: `Dispatch ${disp.dispatchNumber} has ${unresolved.length} unresolved delivery stops requiring action.`,
            sourceEntityType: "Dispatch",
            sourceEntityId: String(disp._id),
            dealershipId: dId,
            deduplicationKey: `${businessId}:${ruleKey}:${disp._id}`,
            metadata: { dispatchId: String(disp._id), dispatchNumber: disp.dispatchNumber, unresolvedStops: unresolved.length },
          });
        }
      }
    } else if (ruleKey === "DELIVERY_TRIP_UNRECONCILED") {
      const hoursThreshold = config.maxHoursBeforeWarning ?? 24;
      const cutoff = new Date(now.getTime() - hoursThreshold * 3600000);

      const dispatches = await Dispatch.find({
        ...baseFilter,
        status: { $in: ["DELIVERED", "PARTIALLY_DELIVERED"] },
        updatedAt: { $lte: cutoff },
      }).lean();
      evaluatedCount = dispatches.length;

      for (const disp of dispatches) {
        const dId = disp.dealershipIds && disp.dealershipIds.length > 0 ? String(disp.dealershipIds[0]) : undefined;
        if (!disp.reconciliation || !(disp.reconciliation as any).reconciledAt) {
          conditions.push({
            ruleKey,
            category: "SALES",
            severity: rule.severity,
            title: `Unreconciled Delivery Trip: ${disp.dispatchNumber}`,
            message: `Dispatch ${disp.dispatchNumber} was completed over ${hoursThreshold}h ago without settlement confirmation.`,
            sourceEntityType: "Dispatch",
            sourceEntityId: String(disp._id),
            dealershipId: dId,
            deduplicationKey: `${businessId}:${ruleKey}:${disp._id}`,
            metadata: { dispatchId: String(disp._id), dispatchNumber: disp.dispatchNumber },
          });
        }
      }
    } else if (ruleKey === "DAY_END_DELIVERY_RECONCILIATION_PENDING") {
      const activeDispatches = await Dispatch.find({
        ...baseFilter,
        status: { $in: ["PARTIALLY_DELIVERED", "DELIVERED", "RETURNED"] },
      }).lean();
      evaluatedCount = activeDispatches.length;

      for (const disp of activeDispatches) {
        const dId = disp.dealershipIds && disp.dealershipIds.length > 0 ? String(disp.dealershipIds[0]) : undefined;
        const returnedUnits = (disp.items || []).reduce((acc: number, it: any) => acc + (it.returnedQuantity || 0) + (it.damagedQuantity || 0), 0);
        if (returnedUnits > 0 && (!disp.reconciliation || !disp.reconciliation.isStockBalanced)) {
          conditions.push({
            ruleKey,
            category: "SALES",
            severity: rule.severity,
            title: `Stock Return Reconciliation Pending: ${disp.dispatchNumber}`,
            message: `Dispatch ${disp.dispatchNumber} has ${returnedUnits} returned/damaged units requiring warehouse check-in.`,
            sourceEntityType: "Dispatch",
            sourceEntityId: String(disp._id),
            dealershipId: dId,
            deduplicationKey: `${businessId}:${ruleKey}:${disp._id}`,
            metadata: { dispatchId: String(disp._id), dispatchNumber: disp.dispatchNumber, returnedUnits },
          });
        }
      }
    } else if (ruleKey === "SALES_RETURN_PENDING_INSPECTION") {
      const returns = await SalesReturn.find({
        ...baseFilter,
        status: { $in: ["REQUESTED", "RECEIVED", "UNDER_INSPECTION", "pending"] },
      }).lean();
      evaluatedCount = returns.length;

      for (const ret of returns) {
        conditions.push({
          ruleKey,
          category: "SALES",
          severity: rule.severity,
          title: `Sales Return Pending Inspection: ${ret.returnNumber}`,
          message: `Return ${ret.returnNumber} for Order #${ret.orderNumber} is awaiting warehouse QA inspection.`,
          sourceEntityType: "SalesReturn",
          sourceEntityId: String(ret._id),
          dealershipId: ret.dealershipId ? String(ret.dealershipId) : undefined,
          deduplicationKey: `${businessId}:${ruleKey}:${ret._id}`,
          metadata: { returnId: String(ret._id), returnNumber: ret.returnNumber, orderNumber: ret.orderNumber },
        });
      }
    } else if (ruleKey === "UNRESOLVED_CLAIM_OVERDUE") {
      const maxDays = config.maxPendingDays ?? 7;
      const cutoff = new Date(now.getTime() - maxDays * 86400000);

      const claims = await Claim.find({
        ...baseFilter,
        status: { $in: ["SUBMITTED", "UNDER_REVIEW"] },
        createdAt: { $lte: cutoff },
      }).lean();
      evaluatedCount = claims.length;

      for (const clm of claims) {
        const days = Math.floor((now.getTime() - new Date(clm.createdAt).getTime()) / 86400000);
        conditions.push({
          ruleKey,
          category: "SALES",
          severity: rule.severity,
          title: `Unresolved Claim Overdue: ${clm.claimNumber}`,
          message: `Claim ${clm.claimNumber} (BDT ${(clm.claimedAmount || 0).toLocaleString()}) has been pending review for ${days} days.`,
          sourceEntityType: "Claim",
          sourceEntityId: String(clm._id),
          dealershipId: clm.dealershipId ? String(clm.dealershipId) : undefined,
          deduplicationKey: `${businessId}:${ruleKey}:${clm._id}`,
          metadata: { claimId: String(clm._id), claimNumber: clm.claimNumber, claimedAmount: clm.claimedAmount, daysPending: days },
        });
      }
    }

    return {
      ruleKey,
      category: "SALES",
      status: "EVALUATED",
      conditions,
      evaluatedCount,
    };
  }
}
