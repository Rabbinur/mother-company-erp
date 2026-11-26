import mongoose from "mongoose";
import { Order } from "@/models/Order";
import { User } from "@/models/User";
import { Payment } from "@/models/Payment";
import { SalesReturn } from "@/models/SalesReturn";
import { roundMoney, addMoney } from "../AccountingService";
import type { AnalyticsDateFilter, SalesmanPerformanceItem } from "./types";

export class SalesmanPerformanceService {
  static async getSalesmanPerformance(params: {
    businessId: mongoose.Types.ObjectId;
    dealershipId?: mongoose.Types.ObjectId;
    dateFilter: AnalyticsDateFilter;
    dealershipMap: Map<string, { name: string; code: string }>;
  }): Promise<{
    salesmen: SalesmanPerformanceItem[];
    topPerformers: SalesmanPerformanceItem[];
  }> {
    const { businessId, dealershipId, dateFilter, dealershipMap } = params;

    // 1. Fetch all orders in period (booked, fulfilled, cancelled)
    const orderQuery: Record<string, any> = {
      businessId,
      salesmanId: { $exists: true, $ne: null },
      orderDate: { $gte: dateFilter.startDate, $lte: dateFilter.endDate },
    };
    if (dealershipId) orderQuery.dealershipId = dealershipId;

    const orders = await Order.find(orderQuery).lean();

    // 2. Fetch sales returns in period
    const returnQuery: Record<string, any> = {
      businessId,
      status: { $in: ["approved", "settled", "APPROVED", "SETTLED"] },
      createdAt: { $gte: dateFilter.startDate, $lte: dateFilter.endDate },
    };
    if (dealershipId) returnQuery.dealershipId = dealershipId;
    const salesReturns = await SalesReturn.find(returnQuery).lean();

    // 3. Payments collected in period
    const paymentQuery: Record<string, any> = {
      paymentType: "customer_receipt",
      status: "verified",
      date: { $gte: dateFilter.startDate, $lte: dateFilter.endDate },
    };
    const payments = await Payment.find(paymentQuery).lean();
    const orderPaymentMap = new Map<string, number>();
    for (const pay of payments) {
      if (Array.isArray(pay.allocations)) {
        for (const alloc of pay.allocations) {
          if (alloc.invoiceId) {
            const ordKey = String(alloc.invoiceId);
            orderPaymentMap.set(ordKey, addMoney(orderPaymentMap.get(ordKey) || 0, alloc.amountAllocated || 0));
          }
        }
      }
    }

    // 4. Salesman Aggregator Map
    const staffMap = new Map<
      string,
      {
        salesmanId: string;
        dealershipId?: string;
        bookedCount: number;
        bookedSales: number;
        fulfilledCount: number;
        fulfilledSales: number;
        cancelledCount: number;
        returnedCount: number;
        returnsAmount: number;
        collectedAmount: number;
      }
    >();

    for (const ord of orders) {
      const sId = String(ord.salesmanId);
      const entry = staffMap.get(sId) || {
        salesmanId: sId,
        dealershipId: ord.dealershipId ? String(ord.dealershipId) : undefined,
        bookedCount: 0,
        bookedSales: 0,
        fulfilledCount: 0,
        fulfilledSales: 0,
        cancelledCount: 0,
        returnedCount: 0,
        returnsAmount: 0,
        collectedAmount: 0,
      };

      const val = roundMoney(ord.totalAmount || ord.grandTotal || ord.subtotal || 0);
      const status = (ord.orderStatus || (ord as any).status || "").toLowerCase();

      if (status === "cancelled") {
        entry.cancelledCount += 1;
      } else {
        entry.bookedCount += 1;
        entry.bookedSales = addMoney(entry.bookedSales, val);

        if (status === "fulfilled" || status === "delivered") {
          entry.fulfilledCount += 1;
          entry.fulfilledSales = addMoney(entry.fulfilledSales, val);

          // Add collected payments for this order
          const collectedOnOrder = orderPaymentMap.get(String(ord._id)) || 0;
          entry.collectedAmount = addMoney(entry.collectedAmount, collectedOnOrder);
        }
      }

      staffMap.set(sId, entry);
    }

    // 5. Resolve Salesman User Profiles
    const salesmanIds = Array.from(staffMap.keys());
    const users = await User.find({ _id: { $in: salesmanIds } }).lean();
    const userMap = new Map<string, any>();
    for (const u of users) {
      userMap.set(String(u._id), u);
    }

    // 6. Build Performance Metrics & Composite Scores
    const resultList: SalesmanPerformanceItem[] = Array.from(staffMap.values()).map((s) => {
      const user = userMap.get(s.salesmanId);
      const fulfillmentRate = s.bookedCount > 0 ? roundMoney((s.fulfilledCount / s.bookedCount) * 100) : 0;
      const cancellationRate = s.bookedCount + s.cancelledCount > 0
        ? roundMoney((s.cancelledCount / (s.bookedCount + s.cancelledCount)) * 100)
        : 0;
      const collectionEff = s.fulfilledSales > 0
        ? roundMoney(Math.min(100, (s.collectedAmount / s.fulfilledSales) * 100))
        : 100;

      // Performance Composite Score Formula:
      // Evaluates 50% fulfilled sales volume + 50% actual cash/bank collections.
      // The cancellation penalty applies across the entire weighted performance score:
      // compositeScore = (fulfilledSales * 0.5 + collectedAmount * 0.5) * cancellationFactor
      // where cancellationFactor = max(0, 1 - (cancellationRate / 100))
      const cancellationFactor = Math.max(0, 1 - cancellationRate / 100);
      const compositeScore = roundMoney(
        (s.fulfilledSales * 0.5 + s.collectedAmount * 0.5) * cancellationFactor
      );

      return {
        salesmanId: s.salesmanId,
        salesmanName: user?.name || "Sales Representative",
        email: user?.email || "",
        dealershipId: s.dealershipId,
        dealershipName: s.dealershipId ? dealershipMap.get(s.dealershipId)?.name : undefined,
        bookedOrdersCount: s.bookedCount,
        bookedSalesAmount: s.bookedSales,
        fulfilledOrdersCount: s.fulfilledCount,
        fulfilledSalesAmount: s.fulfilledSales,
        fulfillmentRatePercentage: fulfillmentRate,
        cancelledOrdersCount: s.cancelledCount,
        cancellationRatePercentage: cancellationRate,
        returnedOrdersCount: s.returnedCount,
        returnsAmount: s.returnsAmount,
        collectedAmount: s.collectedAmount,
        collectionEfficiencyPercentage: collectionEff,
        compositeScore,
        performanceRank: 0,
      };
    });

    // Rank staff by compositeScore (fulfilled sales + collections)
    resultList.sort((a, b) => b.compositeScore - a.compositeScore);
    resultList.forEach((s, idx) => {
      s.performanceRank = idx + 1;
    });

    return {
      salesmen: resultList,
      topPerformers: resultList.slice(0, 5),
    };
  }
}
