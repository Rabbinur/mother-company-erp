import mongoose from "mongoose";
import { SalesTarget, type ISalesTarget } from "@/models/SalesTarget";
import { Order } from "@/models/Order";
import { ProductVariant } from "@/models/ProductVariant";
import { InventoryBalance } from "@/models/InventoryBalance";
import { DeliveryCollection } from "@/models/DeliveryCollection";
import { Notification } from "@/models/Notification";

export interface TargetEvaluationResult {
  targetId: string;
  title: string;
  scope: string;
  targetAmount: number;
  achievedAmount: number;
  achievementPercentage: number;
  status: string;
  alertSent: boolean;
  alertType?: string;
}

export class SalesTargetAlertService {
  /**
   * Evaluate Sales Targets and generate non-duplicate email/inbox alerts
   */
  static async evaluateSalesTargets(
    businessId: string | mongoose.Types.ObjectId
  ): Promise<TargetEvaluationResult[]> {
    const bId = new mongoose.Types.ObjectId(String(businessId));
    const now = new Date();

    const targets = await SalesTarget.find({
      businessId: bId,
      startDate: { $lte: now },
      endDate: { $gte: now },
    });

    const results: TargetEvaluationResult[] = [];

    for (const target of targets) {
      // Aggregate actual sales revenue within target timeframe
      const orderFilter: any = {
        businessId: bId,
        createdAt: { $gte: target.startDate, $lte: target.endDate },
        orderStatus: { $in: ["confirmed", "processing", "dispatched", "delivered"] },
      };

      if (target.dealershipId) orderFilter.dealershipId = target.dealershipId;
      if (target.salesmanId) orderFilter.assignedSalesmanId = target.salesmanId;

      const matchedOrders = await Order.find(orderFilter).select("grandTotal").lean();
      const achievedAmount = matchedOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
      const percentage = target.targetAmount > 0
        ? Math.round((achievedAmount / target.targetAmount) * 1000) / 10
        : 0;

      target.achievedAmount = achievedAmount;
      target.achievementPercentage = percentage;

      // Status classification
      if (percentage >= 120) {
        target.status = "exceeded";
      } else if (percentage >= 100) {
        target.status = "achieved";
      } else if (now > target.endDate) {
        target.status = "missed";
      } else {
        target.status = "in_progress";
      }

      // Pacing alert determination
      const totalDuration = target.endDate.getTime() - target.startDate.getTime();
      const elapsedDuration = now.getTime() - target.startDate.getTime();
      const elapsedRatio = totalDuration > 0 ? elapsedDuration / totalDuration : 0;

      let alertType: string | undefined;
      if (percentage >= 120) {
        alertType = "TARGET_EXCEEDED";
      } else if (percentage >= 100) {
        alertType = "TARGET_ACHIEVED";
      } else if (elapsedRatio > 0.5 && percentage < 40) {
        alertType = "BEHIND_TARGET_PACING";
      }

      let alertSent = false;
      const todayStr = now.toISOString().slice(0, 10);
      const alreadySentToday = target.alertHistory.some(
        (a) => a.alertType === alertType && a.sentAt.toISOString().slice(0, 10) === todayStr
      );

      if (alertType && !alreadySentToday) {
        target.alertHistory.push({ alertType, sentAt: now });
        target.lastAlertSentAt = now;
        alertSent = true;

        await Notification.create({
          title: `[Sales Target Alert] ${target.title}: ${alertType}`,
          message: `${target.title} is at ${percentage}% (BDT ${achievedAmount} of BDT ${target.targetAmount}).`,
          type: "system",
          targetRole: "manager",
          link: "/analytics/sales",
        }).catch(() => {});
      }

      await target.save();

      results.push({
        targetId: String(target._id),
        title: target.title,
        scope: target.scope,
        targetAmount: target.targetAmount,
        achievedAmount,
        achievementPercentage: percentage,
        status: target.status,
        alertSent,
        alertType,
      });
    }

    return results;
  }

  /**
   * Daily sales summary & pending collection alerts
   */
  static async evaluateDailyOperationalAlerts(
    businessId: string | mongoose.Types.ObjectId
  ): Promise<{ pendingCollectionsAmount: number; lowStockCount: number }> {
    const bId = new mongoose.Types.ObjectId(String(businessId));

    // 1. Pending deliveryman cash held
    const pendingCollections = await DeliveryCollection.find({
      businessId: bId,
      status: { $in: ["verified", "pending_verification"] },
    }).select("amount").lean();

    const pendingCollectionsAmount = pendingCollections.reduce((sum, c) => sum + (c.amount || 0), 0);

    if (pendingCollectionsAmount > 10000) {
      await Notification.create({
        title: "[Cash Alert] Un-deposited Delivery Collections",
        message: `Deliverymen currently hold BDT ${pendingCollectionsAmount} in un-deposited cash collections awaiting deposit reconciliation.`,
        type: "system",
        targetRole: "accountant",
        link: "/delivery",
      }).catch(() => {});
    }

    // 2. Low stock count
    const balances = await InventoryBalance.find({
      onHandQuantity: { $lte: 5 },
    }).limit(20).lean();

    return {
      pendingCollectionsAmount,
      lowStockCount: balances.length,
    };
  }
}
