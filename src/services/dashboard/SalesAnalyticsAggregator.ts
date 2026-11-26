import mongoose from "mongoose";
import { Order } from "@/models/Order";
import { Customer } from "@/models/Customer";
import { SalesReturn } from "@/models/SalesReturn";
import { roundMoney, addMoney, subtractMoney } from "../AccountingService";
import type {
  DashboardDateRange,
  SalesTimelinePoint,
  DealershipSalesItem,
  TopProductSalesItem,
  TopCustomerItem,
  SalesReturnsSummary,
} from "./types";

export interface SalesAggregationResult {
  sales: {
    timeline: SalesTimelinePoint[];
    dealershipComparison: DealershipSalesItem[];
    topProducts: TopProductSalesItem[];
    topCustomers: TopCustomerItem[];
    returnsSummary: SalesReturnsSummary;
  };
  currentPeriodGrossSales: number;
  currentPeriodNetSales: number;
  currentPeriodCost: number;
  priorPeriodSales: number;
  salesGrowthPercentage: number;
  totalReturnsAmount: number;
  netSales: number;
  grossProfit: number;
  productSalesMap: Map<string, { product: any; variant: any; name: string; sku: string; qty: number; revenue: number; cost: number }>;
  dealershipSalesMap: Map<string, { sales: number; count: number }>;
}

export class SalesAnalyticsAggregator {
  static async aggregateSales(params: {
    businessId: mongoose.Types.ObjectId;
    dealershipId?: mongoose.Types.ObjectId;
    principalCompanyId?: mongoose.Types.ObjectId;
    dateRange: DashboardDateRange;
    dealerships: any[];
    dealershipMap: Map<string, { name: string; code: string }>;
    custBalanceMap: Map<string, number>;
  }): Promise<SalesAggregationResult> {
    const { businessId, dealershipId, principalCompanyId, dateRange, dealerships, dealershipMap, custBalanceMap } = params;

    // 1. Fulfilled orders in current period
    const orderFilter: Record<string, any> = {
      businessId,
      $or: [
        { orderStatus: { $in: ["FULFILLED", "fulfilled", "DELIVERED", "delivered"] } },
        { fulfillmentStatus: "fulfilled" },
        { status: { $in: ["FULFILLED", "fulfilled", "DELIVERED", "delivered"] } },
        { deliveryStatus: { $in: ["DELIVERED", "delivered"] } },
      ],
      $and: [
        {
          $or: [
            { fulfilledDate: { $gte: dateRange.startDate, $lte: dateRange.endDate } },
            { orderDate: { $gte: dateRange.startDate, $lte: dateRange.endDate } },
          ],
        },
      ],
    };
    if (dealershipId) orderFilter.dealershipId = dealershipId;
    if (principalCompanyId) orderFilter.principalCompanyId = principalCompanyId;

    const fulfilledOrders = await Order.find(orderFilter)
      .populate("customerId", "name shopName phone")
      .populate("dealershipId", "name code")
      .lean();

    // 2. Prior period orders for growth comparison
    const priorOrderFilter: Record<string, any> = {
      businessId,
      $or: [
        { orderStatus: { $in: ["FULFILLED", "fulfilled", "DELIVERED", "delivered"] } },
        { fulfillmentStatus: "fulfilled" },
        { status: { $in: ["FULFILLED", "fulfilled", "DELIVERED", "delivered"] } },
        { deliveryStatus: { $in: ["DELIVERED", "delivered"] } },
      ],
      $and: [
        {
          $or: [
            { fulfilledDate: { $gte: dateRange.priorStartDate, $lte: dateRange.priorEndDate } },
            { orderDate: { $gte: dateRange.priorStartDate, $lte: dateRange.priorEndDate } },
          ],
        },
      ],
    };
    if (dealershipId) priorOrderFilter.dealershipId = dealershipId;
    if (principalCompanyId) priorOrderFilter.principalCompanyId = principalCompanyId;

    const priorOrders = await Order.find(priorOrderFilter).lean();

    let currentPeriodGrossSales = 0;
    let currentPeriodNetSales = 0;
    let currentPeriodCost = 0;
    const customerSpentMap = new Map<string, { cust: any; total: number; count: number }>();
    const productSalesMap = new Map<string, { product: any; variant: any; name: string; sku: string; qty: number; revenue: number; cost: number }>();
    const dealershipSalesMap = new Map<string, { sales: number; count: number }>();
    const timelineMap = new Map<string, { sales: number; count: number }>();

    for (const ord of fulfilledOrders) {
      const grossVal = roundMoney(
        ord.subtotal ?? (roundMoney(ord.grandTotal || ord.totalAmount || 0) + roundMoney(ord.discountTotal || (ord as any).totalDiscount || 0))
      );
      const netVal = roundMoney(ord.totalAmount || ord.grandTotal || ord.subtotal || 0);

      currentPeriodGrossSales = addMoney(currentPeriodGrossSales, grossVal);
      currentPeriodNetSales = addMoney(currentPeriodNetSales, netVal);

      let orderCost = 0;
      if (Array.isArray(ord.items)) {
        for (const it of ord.items) {
          const qty = it.quantity || 1;
          const costPrice = (it as any).costPrice || 0;
          orderCost = addMoney(orderCost, roundMoney(costPrice * qty));
        }
      }
      if ((ord as any).totalCost) {
        orderCost = roundMoney((ord as any).totalCost);
      }
      currentPeriodCost = addMoney(currentPeriodCost, orderCost);

      // Customer aggregation
      const cId = String((ord.customerId as any)?._id || ord.customerId);
      const custEntry = customerSpentMap.get(cId) || { cust: ord.customerId, total: 0, count: 0 };
      custEntry.total = addMoney(custEntry.total, grossVal);
      custEntry.count += 1;
      customerSpentMap.set(cId, custEntry);

      // Dealership aggregation
      const dKey = String((ord.dealershipId as any)?._id || ord.dealershipId);
      const dEntry = dealershipSalesMap.get(dKey) || { sales: 0, count: 0 };
      dEntry.sales = addMoney(dEntry.sales, grossVal);
      dEntry.count += 1;
      dealershipSalesMap.set(dKey, dEntry);

      // Timeline aggregation
      const dateKey = new Date(ord.fulfilledDate || ord.orderDate).toISOString().slice(0, 10);
      const tEntry = timelineMap.get(dateKey) || { sales: 0, count: 0 };
      tEntry.sales = addMoney(tEntry.sales, grossVal);
      tEntry.count += 1;
      timelineMap.set(dateKey, tEntry);

      // Product sales aggregation
      if (Array.isArray(ord.items)) {
        for (const it of ord.items) {
          const vKey = String(it.variantId || it.productId);
          const pEntry = productSalesMap.get(vKey) || {
            product: it.productId,
            variant: it.variantId,
            name: it.name || "Product",
            sku: it.sku || "",
            qty: 0,
            revenue: 0,
            cost: 0,
          };
          const lineQty = it.quantity || 1;
          const lineRev = roundMoney((it as any).totalPrice ?? ((it.unitPrice ?? it.customerPriceSnapshot ?? 0) * lineQty));
          const lineCost = roundMoney(((it as any).costPrice || 0) * lineQty);
          pEntry.qty += lineQty;
          pEntry.revenue = addMoney(pEntry.revenue, lineRev);
          pEntry.cost = addMoney(pEntry.cost, lineCost);
          productSalesMap.set(vKey, pEntry);
        }
      }
    }

    let priorPeriodSales = 0;
    for (const pOrd of priorOrders) {
      const pGross = roundMoney(
        pOrd.subtotal ?? (roundMoney(pOrd.grandTotal || pOrd.totalAmount || 0) + roundMoney(pOrd.discountTotal || (pOrd as any).totalDiscount || 0))
      );
      priorPeriodSales = addMoney(priorPeriodSales, pGross);
    }

    const salesGrowthPercentage =
      priorPeriodSales > 0
        ? roundMoney(((currentPeriodGrossSales - priorPeriodSales) / priorPeriodSales) * 100)
        : currentPeriodGrossSales > 0
        ? 100
        : 0;

    // 3. Sales Returns in Period
    const returnFilter: Record<string, any> = {
      businessId,
      status: { $in: ["approved", "settled", "APPROVED", "SETTLED"] },
      createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
    };
    if (dealershipId) returnFilter.dealershipId = dealershipId;

    const salesReturns = await SalesReturn.find(returnFilter).lean();
    let totalReturnsAmount = 0;
    let refundedCash = 0;
    let creditNotesIssued = 0;

    for (const ret of salesReturns) {
      const rAmt = roundMoney(ret.totalRefundAmount || 0);
      totalReturnsAmount = addMoney(totalReturnsAmount, rAmt);
      if (ret.refundMethod === "cash" || ret.refundMethod === "bank_transfer") {
        refundedCash = addMoney(refundedCash, rAmt);
      } else {
        creditNotesIssued = addMoney(creditNotesIssued, rAmt);
      }
    }

    const netSales = Math.max(0, subtractMoney(currentPeriodNetSales, totalReturnsAmount));
    const grossProfit = Math.max(0, subtractMoney(netSales, currentPeriodCost));

    // Top-selling products
    const topProducts: TopProductSalesItem[] = Array.from(productSalesMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map((p) => ({
        productId: String(p.product?._id || p.product),
        variantId: String(p.variant?._id || p.variant),
        name: p.name,
        sku: p.sku,
        quantitySold: p.qty,
        revenue: p.revenue,
        grossProfit: Math.max(0, subtractMoney(p.revenue, p.cost)),
      }));

    // Resolve unpopulated customers if needed
    const unpopulatedCustIds = Array.from(customerSpentMap.keys()).filter((id) => {
      const c = customerSpentMap.get(id)?.cust;
      return !c?.name && !c?.shopName;
    });
    if (unpopulatedCustIds.length > 0) {
      const dbCusts = await Customer.find({ _id: { $in: unpopulatedCustIds } }).lean();
      for (const c of dbCusts) {
        const entry = customerSpentMap.get(String(c._id));
        if (entry) entry.cust = c;
      }
    }

    // Top-performing customers
    const topCustomers: TopCustomerItem[] = Array.from(customerSpentMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map((c) => {
        const custObj = c.cust as any;
        const cIdStr = String(custObj?._id || custObj);
        return {
          customerId: cIdStr,
          customerName: custObj?.name || "Customer",
          shopName: custObj?.shopName || custObj?.name || "",
          phone: custObj?.phone || "",
          ordersCount: c.count,
          totalSpent: c.total,
          outstandingBalance: custBalanceMap.get(cIdStr) || 0,
        };
      });

    // Dealership-wise sales comparison
    const dealershipSalesComparison: DealershipSalesItem[] = dealerships.map((d) => {
      const did = String(d._id);
      const dSales = dealershipSalesMap.get(did)?.sales || 0;
      const dCount = dealershipSalesMap.get(did)?.count || 0;
      const share = currentPeriodGrossSales > 0 ? roundMoney((dSales / currentPeriodGrossSales) * 100) : 0;
      return {
        dealershipId: did,
        dealershipName: d.name,
        dealershipCode: d.code,
        sales: dSales,
        ordersCount: dCount,
        sharePercentage: share,
      };
    });

    const salesTimeline: SalesTimelinePoint[] = Array.from(timelineMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, val]) => ({
        date,
        label: date,
        sales: val.sales,
        ordersCount: val.count,
      }));

    return {
      sales: {
        timeline: salesTimeline,
        dealershipComparison: dealershipSalesComparison,
        topProducts,
        topCustomers,
        returnsSummary: {
          totalReturnsAmount,
          returnsCount: salesReturns.length,
          refundedCash,
          creditNotesIssued,
        },
      },
      currentPeriodGrossSales,
      currentPeriodNetSales,
      currentPeriodCost,
      priorPeriodSales,
      salesGrowthPercentage,
      totalReturnsAmount,
      netSales,
      grossProfit,
      productSalesMap,
      dealershipSalesMap,
    };
  }
}
