import mongoose from "mongoose";
import { CustomerDealershipAccount } from "@/models/CustomerDealershipAccount";
import { Customer } from "@/models/Customer";
import { Order } from "@/models/Order";
import type { IAutomationRule } from "@/models/AutomationRule";
import type { DetectorResult, DetectedCondition } from "../types";

export class CustomerDetector {
  static async evaluate(params: {
    rule: IAutomationRule;
    businessId: mongoose.Types.ObjectId;
    dealershipId?: mongoose.Types.ObjectId;
  }): Promise<DetectorResult> {
    const { rule, businessId, dealershipId } = params;
    const ruleKey = rule.ruleKey;
    const config = rule.configuration || {};
    const conditions: DetectedCondition[] = [];

    const baseFilter: Record<string, any> = { businessId, isDeleted: false };
    if (dealershipId) baseFilter.dealershipId = dealershipId;

    const accounts = await CustomerDealershipAccount.find(baseFilter).lean();
    const evaluatedCount = accounts.length;

    // Resolve customer names
    const custIds = Array.from(new Set(accounts.map((a) => String(a.customerId))));
    const customers = await Customer.find({ _id: { $in: custIds } }).lean();
    const custMap = new Map(customers.map((c) => [String(c._id), c.name || "Customer"]));

    const now = new Date();

    for (const acc of accounts) {
      const custName = custMap.get(String(acc.customerId)) || "Customer";
      const balance = acc.currentBalance || 0;
      const creditLimit = acc.creditLimit || 0;

      if (ruleKey === "CUSTOMER_OUTSTANDING_EXCEEDED") {
        const threshold = config.thresholdAmount ?? 200000;
        if (balance > threshold) {
          conditions.push({
            ruleKey,
            category: "CUSTOMER",
            severity: rule.severity,
            title: `High Outstanding: ${custName}`,
            message: `${custName} has outstanding balance of BDT ${balance.toLocaleString()} exceeding threshold of BDT ${threshold.toLocaleString()}.`,
            sourceEntityType: "CustomerDealershipAccount",
            sourceEntityId: String(acc._id),
            dealershipId: acc.dealershipId ? String(acc.dealershipId) : undefined,
            deduplicationKey: `${businessId}:${ruleKey}:${acc.customerId}:${acc.dealershipId}`,
            metadata: { customerId: String(acc.customerId), currentBalance: balance, threshold },
          });
        }
      } else if (ruleKey === "CREDIT_UTILIZATION_WARNING") {
        const warningPct = config.warningPercentage ?? 85;
        if (creditLimit > 0) {
          const utilPct = (balance / creditLimit) * 100;
          if (utilPct >= warningPct && utilPct < 100) {
            conditions.push({
              ruleKey,
              category: "CUSTOMER",
              severity: rule.severity,
              title: `Credit Warning (${utilPct.toFixed(1)}%): ${custName}`,
              message: `${custName} is utilizing ${utilPct.toFixed(1)}% of credit limit (BDT ${balance.toLocaleString()} of BDT ${creditLimit.toLocaleString()}).`,
              sourceEntityType: "CustomerDealershipAccount",
              sourceEntityId: String(acc._id),
              dealershipId: acc.dealershipId ? String(acc.dealershipId) : undefined,
              deduplicationKey: `${businessId}:${ruleKey}:${acc.customerId}:${acc.dealershipId}`,
              metadata: { customerId: String(acc.customerId), creditLimit, currentBalance: balance, utilizationPercentage: utilPct },
            });
          }
        }
      } else if (ruleKey === "CREDIT_LIMIT_EXCEEDED") {
        if (creditLimit > 0 && balance >= creditLimit) {
          conditions.push({
            ruleKey,
            category: "CUSTOMER",
            severity: rule.severity,
            title: `Credit Limit Exceeded: ${custName}`,
            message: `${custName} has exceeded credit limit: balance BDT ${balance.toLocaleString()} vs limit BDT ${creditLimit.toLocaleString()}.`,
            sourceEntityType: "CustomerDealershipAccount",
            sourceEntityId: String(acc._id),
            dealershipId: acc.dealershipId ? String(acc.dealershipId) : undefined,
            deduplicationKey: `${businessId}:${ruleKey}:${acc.customerId}:${acc.dealershipId}`,
            metadata: { customerId: String(acc.customerId), creditLimit, currentBalance: balance },
          });
        }
      } else if (ruleKey === "CUSTOMER_INACTIVE") {
        const inactiveDays = config.inactiveDays ?? 60;
        const cutoffDate = new Date(now.getTime() - inactiveDays * 86400000);

        const latestOrder = await Order.findOne({
          customerId: acc.customerId,
          businessId,
          orderStatus: { $nin: ["cancelled", "draft", "CANCELLED", "DRAFT"] },
        })
          .sort({ orderDate: -1 })
          .lean();

        const lastDate = latestOrder?.orderDate ? new Date(latestOrder.orderDate) : acc.createdAt;
        if (lastDate < cutoffDate) {
          const daysInactive = Math.floor((now.getTime() - new Date(lastDate).getTime()) / 86400000);
          conditions.push({
            ruleKey,
            category: "CUSTOMER",
            severity: rule.severity,
            title: `Inactive Customer: ${custName}`,
            message: `${custName} has placed no confirmed orders in ${daysInactive} days. Outreach recommended.`,
            sourceEntityType: "CustomerDealershipAccount",
            sourceEntityId: String(acc._id),
            dealershipId: acc.dealershipId ? String(acc.dealershipId) : undefined,
            deduplicationKey: `${businessId}:${ruleKey}:${acc.customerId}:${acc.dealershipId}`,
            metadata: { customerId: String(acc.customerId), daysInactive, lastOrderDate: lastDate },
          });
        }
      } else if (ruleKey === "RECEIVABLE_OVERDUE") {
        // Query unpaid orders with actual dueDate where available
        const overdueOrders = await Order.find({
          customerId: acc.customerId,
          businessId,
          paymentStatus: { $in: ["unpaid", "partially_paid"] },
          dueDate: { $exists: true, $ne: null, $lt: now },
        } as any).lean();

        for (const ord of overdueOrders) {
          const due = (ord as any).dueDate ? new Date((ord as any).dueDate) : null;
          if (!due || isNaN(due.getTime()) || due >= now) continue;
          conditions.push({
            ruleKey,
            category: "CUSTOMER",
            severity: rule.severity,
            title: `Overdue Receivable: Order #${ord.orderNumber}`,
            message: `Order #${ord.orderNumber} for ${custName} is overdue since ${due.toISOString().split("T")[0]}. Outstanding: BDT ${(ord.receivableAmount || 0).toLocaleString()}.`,
            sourceEntityType: "Order",
            sourceEntityId: String(ord._id),
            dealershipId: ord.dealershipId ? String(ord.dealershipId) : undefined,
            deduplicationKey: `${businessId}:${ruleKey}:${ord._id}`,
            metadata: { orderId: String(ord._id), orderNumber: ord.orderNumber, dueDate: due, receivableAmount: ord.receivableAmount },
          });
        }
      }
    }

    return {
      ruleKey,
      category: "CUSTOMER",
      status: "EVALUATED",
      conditions,
      evaluatedCount,
    };
  }
}
