import mongoose from "mongoose";
import { Customer } from "@/models/Customer";
import { CustomerDealershipAccount } from "@/models/CustomerDealershipAccount";
import { Order } from "@/models/Order";
import { Payment } from "@/models/Payment";
import { SalesReturn } from "@/models/SalesReturn";
import { DeliveryCollection } from "@/models/DeliveryCollection";
import { Dispatch } from "@/models/Dispatch";

export interface CompleteCustomerProfileData {
  customer: any;
  dealershipAccounts: any[];
  ordersSummary: {
    totalOrders: number;
    totalSpent: number;
    totalFreeQuantity: number;
    recentOrders: any[];
  };
  paymentsSummary: {
    totalPayments: number;
    totalPaid: number;
    recentPayments: any[];
    recentCollections: any[];
  };
  returnsSummary: {
    totalReturns: number;
    totalRefundCredit: number;
    recentReturns: any[];
  };
  deliveryHistory: any[];
}

export class CustomerProfileService {
  /**
   * Fetch complete unified customer profile.
   * STRICT LEDGER GUARANTEE: Never combine separate dealership ledgers or dues!
   */
  static async getCompleteProfile(
    customerId: string | mongoose.Types.ObjectId,
    dealershipId?: string | mongoose.Types.ObjectId
  ): Promise<CompleteCustomerProfileData> {
    const cId = new mongoose.Types.ObjectId(String(customerId));

    const customer = await Customer.findById(cId).lean();
    if (!customer) throw new Error("Customer record not found");

    // 1. Dealership-specific accounts (strictly isolated ledgers)
    const dealershipAccountFilter: any = { customerId: cId, isDeleted: false };
    if (dealershipId) {
      dealershipAccountFilter.dealershipId = new mongoose.Types.ObjectId(String(dealershipId));
    }

    const dealershipAccounts = await CustomerDealershipAccount.find(dealershipAccountFilter)
      .populate("dealershipId", "name code city phone")
      .populate("assignedSalesmanId", "name email phone")
      .lean();

    // 2. Orders & Scheme Free Goods
    const orderFilter: any = { customerId: cId };
    if (dealershipId) orderFilter.dealershipId = new mongoose.Types.ObjectId(String(dealershipId));

    const orders = await Order.find(orderFilter)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    let totalSpent = 0;
    let totalFreeQuantity = 0;
    for (const o of orders) {
      if (o.orderStatus !== "cancelled") {
        totalSpent += o.grandTotal || 0;
        for (const item of o.items || []) {
          totalFreeQuantity += ((item as any).schemeFreeQuantity || 0) + ((item as any).manualFreeQuantity || 0);
        }
      }
    }

    // 3. Payment & Collections
    const paymentFilter: any = { customerId: cId };
    const payments = await Payment.find(paymentFilter)
      .sort({ date: -1 })
      .limit(30)
      .lean();

    const collections = await DeliveryCollection.find({ customerId: cId })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    // 4. Returns & Claims
    const returns = await SalesReturn.find({ customerId: cId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const totalRefundCredit = returns.reduce((sum, r) => sum + (r.netRefundAmount || r.totalRefundAmount || 0), 0);

    // 5. Delivery Stops History
    const dispatches = await Dispatch.find({ "orders.customerId": cId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const deliveryHistory = dispatches.flatMap((d) =>
      (d.orders || [])
        .filter((o: any) => String(o.customerId) === String(cId))
        .map((o: any) => ({
          dispatchNumber: d.dispatchNumber,
          orderNumber: o.orderNumber,
          status: o.status,
          deliveredAt: o.deliveredAt,
          cashCollected: o.cashCollected || 0,
          digitalPaymentCollected: o.digitalPaymentCollected || 0,
        }))
    );

    return {
      customer,
      dealershipAccounts: dealershipAccounts.map((da: any) => ({
        dealershipId: da.dealershipId?._id || da.dealershipId,
        dealershipName: da.dealershipId?.name || "Dealership",
        creditLimit: da.creditLimit || 0,
        currentBalance: da.currentBalance || 0, // Individual dealership balance!
        totalInvoiced: da.totalInvoiced || 0,
        totalCollected: da.totalCollected || 0,
        totalReturned: da.totalReturned || 0,
        salesmanName: da.assignedSalesmanId?.name || "Unassigned",
        status: da.status,
      })),
      ordersSummary: {
        totalOrders: orders.length,
        totalSpent: Math.round(totalSpent * 100) / 100,
        totalFreeQuantity,
        recentOrders: orders.slice(0, 10).map((o: any) => ({
          orderNumber: o.orderNumber,
          grandTotal: o.grandTotal,
          paidAmount: o.paidAmount,
          orderStatus: o.orderStatus,
          paymentStatus: o.paymentStatus,
          createdAt: o.createdAt,
        })),
      },
      paymentsSummary: {
        totalPayments: payments.length,
        totalPaid: Math.round(totalPaid * 100) / 100,
        recentPayments: payments.slice(0, 10).map((p: any) => ({
          paymentNumber: p.paymentNumber,
          amount: p.amount,
          paymentMethod: p.paymentMethod,
          date: p.date,
          status: p.status,
        })),
        recentCollections: collections.slice(0, 10).map((c: any) => ({
          collectionId: c.collectionId,
          amount: c.amount,
          paymentMethod: c.paymentMethod,
          status: c.status,
          syncStatus: c.syncStatus,
          createdAt: c.createdAt,
        })),
      },
      returnsSummary: {
        totalReturns: returns.length,
        totalRefundCredit: Math.round(totalRefundCredit * 100) / 100,
        recentReturns: returns.slice(0, 10).map((r: any) => ({
          returnNumber: r.returnNumber,
          refundAmount: r.netRefundAmount || r.totalRefundAmount || 0,
          status: r.status,
          createdAt: r.createdAt,
        })),
      },
      deliveryHistory: deliveryHistory.slice(0, 10),
    };
  }

  /**
   * Generate CSV export rows for specified section or full profile
   */
  static async generateCsvExport(
    customerId: string | mongoose.Types.ObjectId,
    section: "overview" | "orders" | "payments" | "returns" | "deliveries" | "all" = "all"
  ): Promise<{ filename: string; csvContent: string }> {
    const profile = await this.getCompleteProfile(customerId);
    const rows: string[] = [];

    if (section === "overview" || section === "all") {
      rows.push("--- CUSTOMER & DEALERSHIP LEDGER OVERVIEW ---");
      rows.push(`Shop Name,${profile.customer.shopName},Customer Code,${profile.customer.customerCode}`);
      rows.push(`Phone,${profile.customer.phone},Total Overall Receivable,${profile.customer.currentReceivable}`);
      rows.push("Dealership,Credit Limit,Current Balance (Due),Total Invoiced,Total Collected,Salesman");
      profile.dealershipAccounts.forEach((da) => {
        rows.push(`"${da.dealershipName}",${da.creditLimit},${da.currentBalance},${da.totalInvoiced},${da.totalCollected},"${da.salesmanName}"`);
      });
      rows.push("");
    }

    if (section === "orders" || section === "all") {
      rows.push("--- RECENT SALES ORDERS ---");
      rows.push("Order Number,Grand Total,Paid Amount,Order Status,Payment Status,Date");
      profile.ordersSummary.recentOrders.forEach((o) => {
        rows.push(`${o.orderNumber},${o.grandTotal},${o.paidAmount},${o.orderStatus},${o.paymentStatus},${o.createdAt}`);
      });
      rows.push("");
    }

    if (section === "payments" || section === "all") {
      rows.push("--- PAYMENTS & COLLECTIONS ---");
      rows.push("Payment/Ref,Amount,Method,Status,Date");
      profile.paymentsSummary.recentPayments.forEach((p) => {
        rows.push(`${p.paymentNumber},${p.amount},${p.paymentMethod},${p.status},${p.date}`);
      });
      profile.paymentsSummary.recentCollections.forEach((c) => {
        rows.push(`${c.collectionId},${c.amount},${c.paymentMethod},${c.status},${c.createdAt}`);
      });
      rows.push("");
    }

    if (section === "returns" || section === "all") {
      rows.push("--- RETURNS & SCHEMES ---");
      rows.push("Return Number,Refund Credit,Status,Date");
      profile.returnsSummary.recentReturns.forEach((r) => {
        rows.push(`${r.returnNumber},${r.refundAmount},${r.status},${r.createdAt}`);
      });
      rows.push("");
    }

    return {
      filename: `customer-${profile.customer.customerCode}-${section}.csv`,
      csvContent: rows.join("\n"),
    };
  }
}
