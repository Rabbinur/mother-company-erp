import mongoose from "mongoose";
import { Order } from "@/models/Order";
import { Customer } from "@/models/Customer";
import { CustomerDealershipAccount } from "@/models/CustomerDealershipAccount";
import { roundMoney, addMoney } from "../AccountingService";
import type { AnalyticsDateFilter, CustomerSegmentItem } from "./types";

export class CustomerIntelligenceService {
  static async getCustomerIntelligence(params: {
    businessId: mongoose.Types.ObjectId;
    dealershipId?: mongoose.Types.ObjectId;
    dateFilter: AnalyticsDateFilter;
    inactiveDaysThreshold?: number;
    dealershipMap: Map<string, { name: string; code: string }>;
  }): Promise<{
    customers: CustomerSegmentItem[];
    segmentCounts: Record<string, number>;
    inactiveCustomers: CustomerSegmentItem[];
    highCreditRisk: CustomerSegmentItem[];
  }> {
    const { businessId, dealershipId, dateFilter, inactiveDaysThreshold = 60, dealershipMap } = params;
    const nowTime = new Date().getTime();

    // 1. Fulfilled orders in date period
    const orderFilter: Record<string, any> = {
      businessId,
      $or: [
        { orderStatus: { $in: ["FULFILLED", "fulfilled", "DELIVERED", "delivered"] } },
        { fulfillmentStatus: "fulfilled" },
        { status: { $in: ["FULFILLED", "fulfilled", "DELIVERED", "delivered"] } },
      ],
      $and: [
        {
          $or: [
            { fulfilledDate: { $gte: dateFilter.startDate, $lte: dateFilter.endDate } },
            { orderDate: { $gte: dateFilter.startDate, $lte: dateFilter.endDate } },
          ],
        },
      ],
    };
    if (dealershipId) orderFilter.dealershipId = dealershipId;

    const orders = await Order.find(orderFilter).lean();

    // 2. Customer Accounts for credit & balance
    const custAccQuery: Record<string, any> = { businessId, isDeleted: false };
    if (dealershipId) custAccQuery.dealershipId = dealershipId;
    const custAccounts = await CustomerDealershipAccount.find(custAccQuery).lean();

    const accountMap = new Map<string, any>();
    for (const ca of custAccounts) {
      accountMap.set(String(ca.customerId), ca);
    }

    // 3. Aggregate customer purchasing behavior
    const customerOrderMap = new Map<
      string,
      {
        count: number;
        total: number;
        lastDate: Date;
        dealershipId: string;
      }
    >();

    for (const ord of orders) {
      const cIdStr = String(ord.customerId);
      const val = roundMoney(ord.totalAmount || ord.grandTotal || ord.subtotal || 0);
      const ordDate = new Date(ord.fulfilledDate || ord.orderDate);

      const entry = customerOrderMap.get(cIdStr) || {
        count: 0,
        total: 0,
        lastDate: ordDate,
        dealershipId: String(ord.dealershipId),
      };

      entry.count += 1;
      entry.total = addMoney(entry.total, val);
      if (ordDate.getTime() > entry.lastDate.getTime()) {
        entry.lastDate = ordDate;
      }
      customerOrderMap.set(cIdStr, entry);
    }

    // 4. Load all registered Customers under business
    const customers = await Customer.find({ businessId, isDeleted: false }).lean();

    const segmentList: CustomerSegmentItem[] = [];
    const segmentCounts: Record<string, number> = {
      VIP: 0,
      REGULAR: 0,
      OCCASIONAL: 0,
      AT_RISK: 0,
      INACTIVE: 0,
    };

    for (const c of customers) {
      const cIdStr = String(c._id);
      const orderData = customerOrderMap.get(cIdStr);
      const accountData = accountMap.get(cIdStr);

      const count = orderData?.count || 0;
      const spent = orderData?.total || 0;
      const lastDate = orderData?.lastDate || null;
      const daysSince = lastDate ? Math.floor((nowTime - lastDate.getTime()) / (1000 * 60 * 60 * 24)) : 999;

      const creditLimit = accountData?.creditLimit || 0;
      const currentBalance = accountData?.currentBalance ?? (accountData as any)?.balance ?? 0;
      const totalCollected = accountData?.totalCollected || 0;
      const totalInvoiced = accountData?.totalInvoiced || 0;

      // Safely handle creditLimit <= 0:
      // When creditLimit is 0 or unassigned, return null ("N/A - Unrestricted") to avoid divide-by-zero or false 0% reporting.
      let creditUtil: number | null = null;
      if (creditLimit > 0) {
        creditUtil = roundMoney((currentBalance / creditLimit) * 100);
      }
      const collectionRate = totalInvoiced > 0 ? roundMoney((totalCollected / totalInvoiced) * 100) : 100;

      // Deterministic Behavioral Segmentation Hierarchy:
      // 1. INACTIVE: Any account dormant for >= inactiveDaysThreshold (whether with previous orders or 0 orders)
      // 2. AT_RISK: Has placed orders in the past, but inactive between 45 days and (inactiveDaysThreshold - 1)
      // 3. VIP: Active buyer (recency <= 45d) with net spend >= 100k BDT or >= 5 orders in period
      // 4. REGULAR: Active buyer (recency <= 45d) with >= 2 orders in period
      // 5. OCCASIONAL: Active buyer (recency <= 45d) with 1 order in period
      // 6. INACTIVE: Any account with no orders and dormant
      let segment: "VIP" | "REGULAR" | "OCCASIONAL" | "AT_RISK" | "INACTIVE";
      if (daysSince >= inactiveDaysThreshold) {
        segment = "INACTIVE";
      } else if (daysSince > 45 && count > 0) {
        segment = "AT_RISK";
      } else if (spent >= 100000 || count >= 5) {
        segment = "VIP";
      } else if (count >= 2) {
        segment = "REGULAR";
      } else if (count === 1) {
        segment = "OCCASIONAL";
      } else {
        segment = "INACTIVE";
      }

      segmentCounts[segment] = (segmentCounts[segment] || 0) + 1;

      const dIdStr = orderData?.dealershipId || (accountData?.dealershipId ? String(accountData.dealershipId) : undefined);

      segmentList.push({
        customerId: cIdStr,
        customerName: c.name || "Customer",
        shopName: c.shopName || c.name || "",
        phone: c.phone || "",
        segment,
        ordersCount: count,
        totalSpent: spent,
        netRevenue: spent,
        averageOrderValue: count > 0 ? roundMoney(spent / count) : 0,
        lastOrderDate: lastDate,
        daysSinceLastOrder: daysSince,
        creditLimit,
        outstandingBalance: currentBalance,
        creditUtilizationPercentage: creditUtil,
        collectionRatePercentage: collectionRate,
        dealershipId: dIdStr,
        dealershipName: dIdStr ? dealershipMap.get(dIdStr)?.name : undefined,
      });
    }

    segmentList.sort((a, b) => b.totalSpent - a.totalSpent);

    const inactiveCustomers = segmentList.filter((c) => c.segment === "INACTIVE" || c.daysSinceLastOrder >= inactiveDaysThreshold);
    const highCreditRisk = segmentList.filter(
      (c) => (c.creditUtilizationPercentage !== null && c.creditUtilizationPercentage >= 90) || (c.creditLimit <= 0 && c.outstandingBalance > 50000)
    );

    return {
      customers: segmentList,
      segmentCounts,
      inactiveCustomers,
      highCreditRisk,
    };
  }
}
