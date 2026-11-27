import mongoose from "mongoose";
import { Customer } from "@/models/Customer";
import { CustomerDealershipAccount } from "@/models/CustomerDealershipAccount";
import { Order } from "@/models/Order";
import { Payment } from "@/models/Payment";
import { DeliveryCollection } from "@/models/DeliveryCollection";
import { Dealership } from "@/models/Dealership";

export interface SalesmanCustomerDueProfile {
  customer: {
    id: string;
    customerCode: string;
    name: string;
    shopName: string;
    phone: string;
    address?: string;
    status: string;
  };
  dealershipDue: {
    dealershipId: string;
    dealershipName: string;
    outstandingDue: number;
    creditLimit: number;
    availableCredit: number;
    totalInvoiced: number;
    totalCollected: number;
  };
  invoiceWiseDues: Array<{
    orderId: string;
    orderNumber: string;
    orderDate: Date;
    dueDate?: Date;
    orderTotal: number;
    paidAmount: number;
    dueAmount: number;
    paymentStatus: string;
    deliveryStatus: string;
  }>;
  paymentHistory: Array<{
    paymentId: string;
    paymentNumber: string;
    amount: number;
    paymentMethod: string;
    date: Date;
    reference?: string;
  }>;
  lastPayment: {
    date: Date;
    amount: number;
  } | null;
  collectionHistory: Array<{
    collectionId: string;
    amount: number;
    paymentMethod: string;
    status: string;
    collectorRole: string;
    collectedAt: Date;
    notes?: string;
  }>;
  pendingCollectionsTotal: number;
}

export class SalesmanCustomerDueService {
  /**
   * Fetch customer dues, unpaid invoices, and payment history strictly for the salesman's dealership.
   * STRICT SECURITY: Never expose GL journals, purchase prices, margins, or other dealerships' records!
   */
  static async getSalesmanCustomerDueProfile(params: {
    customerId: string | mongoose.Types.ObjectId;
    dealershipId: string | mongoose.Types.ObjectId;
    salesmanId?: string | mongoose.Types.ObjectId;
  }): Promise<SalesmanCustomerDueProfile> {
    const cId = new mongoose.Types.ObjectId(String(params.customerId));
    const dId = new mongoose.Types.ObjectId(String(params.dealershipId));

    const [customer, account, dealership] = await Promise.all([
      Customer.findById(cId).select("customerCode name shopName phone address status").lean(),
      CustomerDealershipAccount.findOne({ customerId: cId, dealershipId: dId, isDeleted: false }).lean(),
      Dealership.findById(dId).select("name code").lean(),
    ]);

    if (!customer) throw new Error("Customer record not found");
    if (!account) throw new Error("Customer has no active account with this dealership");

    // 1. Invoice-wise unpaid amount and due date (strictly for this dealership & customer)
    const unpaidOrders = await Order.find({
      customerId: cId,
      dealershipId: dId,
      orderStatus: { $in: ["confirmed", "processing", "fulfilled", "delivered"] },
      paymentStatus: { $in: ["unpaid", "partially_paid"] },
    })
      .sort({ orderDate: -1 })
      .select("orderNumber orderDate grandTotal paidAmount receivableAmount paymentStatus deliveryStatus")
      .lean();

    const invoiceWiseDues = unpaidOrders.map((o) => {
      const orderDate = new Date(o.orderDate);
      const dueDate = new Date(orderDate.getTime() + 30 * 86400000); // 30-day default payment terms
      const dueAmount = o.receivableAmount != null ? o.receivableAmount : Math.max(0, o.grandTotal - (o.paidAmount || 0));
      return {
        orderId: String(o._id),
        orderNumber: o.orderNumber,
        orderDate,
        dueDate,
        orderTotal: o.grandTotal,
        paidAmount: o.paidAmount || 0,
        dueAmount,
        paymentStatus: o.paymentStatus,
        deliveryStatus: o.deliveryStatus || "pending",
      };
    });

    // 2. Recent verified payments for this dealership
    const payments = await Payment.find({
      customerId: cId,
      dealershipId: dId,
      status: "verified",
    })
      .sort({ date: -1 })
      .limit(10)
      .select("paymentNumber amount paymentMethod date transactionReference")
      .lean();

    const paymentHistory = payments.map((p) => ({
      paymentId: String(p._id),
      paymentNumber: p.paymentNumber,
      amount: p.amount,
      paymentMethod: p.paymentMethod,
      date: p.date,
      reference: p.transactionReference,
    }));

    const lastPayment = paymentHistory.length > 0 ? { date: paymentHistory[0].date, amount: paymentHistory[0].amount } : null;

    // 3. Collection history (both pending and verified) for this dealership
    const collections = await DeliveryCollection.find({
      customerId: cId,
      dealershipId: dId,
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("collectionId amount paymentMethod status collectorRole createdAt notes")
      .lean();

    let pendingCollectionsTotal = 0;
    const collectionHistory = collections.map((c) => {
      if (c.status === "pending_verification") {
        pendingCollectionsTotal += c.amount;
      }
      return {
        collectionId: c.collectionId,
        amount: c.amount,
        paymentMethod: c.paymentMethod,
        status: c.status,
        collectorRole: c.collectorRole || "deliveryman",
        collectedAt: c.createdAt,
        notes: c.notes,
      };
    });

    const outstandingDue = account.currentBalance || 0;
    const creditLimit = account.creditLimit || 0;
    const availableCredit = Math.max(0, creditLimit - outstandingDue);

    return {
      customer: {
        id: String(customer._id),
        customerCode: customer.customerCode,
        name: customer.name,
        shopName: customer.shopName,
        phone: customer.phone,
        address: customer.address,
        status: customer.status,
      },
      dealershipDue: {
        dealershipId: String(dId),
        dealershipName: dealership?.name || "Assigned Dealership",
        outstandingDue,
        creditLimit,
        availableCredit,
        totalInvoiced: account.totalInvoiced || 0,
        totalCollected: account.totalCollected || 0,
      },
      invoiceWiseDues,
      paymentHistory,
      lastPayment,
      collectionHistory,
      pendingCollectionsTotal: Math.round(pendingCollectionsTotal * 100) / 100,
    };
  }
}
