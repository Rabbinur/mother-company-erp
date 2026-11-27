import mongoose from "mongoose";
import { Customer } from "@/models/Customer";
import { CustomerDealershipAccount } from "@/models/CustomerDealershipAccount";
import { Order } from "@/models/Order";
import { Payment } from "@/models/Payment";
import { DeliveryCollection } from "@/models/DeliveryCollection";
import { Dealership } from "@/models/Dealership";

export function parsePaymentTermsDays(terms: any): number | null {
  if (terms == null) return null;
  if (typeof terms === "number" && !isNaN(terms) && terms >= 0) return Math.round(terms);
  if (typeof terms === "string") {
    const trimmed = terms.trim().toLowerCase();
    if (trimmed === "immediate" || trimmed === "cash" || trimmed === "net_0" || trimmed === "net0") return 0;
    const match = trimmed.match(/net[-_]?(\d+)/i);
    if (match) return parseInt(match[1], 10);
    const parsed = parseInt(trimmed, 10);
    if (!isNaN(parsed) && parsed >= 0) return parsed;
  }
  return null;
}

export function getDhakaEndOfDay(date: Date): Date {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dateStr = formatter.format(date);
  return new Date(`${dateStr}T23:59:59.999+06:00`);
}

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
    totalOverdue?: number;
    configuredPaymentTermsDays?: number;
  };
  invoiceWiseDues: Array<{
    orderId: string;
    orderNumber: string;
    orderDate: Date;
    dueDate: Date;
    termsDays: number;
    orderTotal: number;
    paidAmount: number;
    dueAmount: number;
    paymentStatus: string;
    deliveryStatus: string;
    isOverdue: boolean;
    overdueDays: number;
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
    canViewCredit?: boolean;
    asOfDate?: Date;
  }): Promise<SalesmanCustomerDueProfile> {
    const cId = new mongoose.Types.ObjectId(String(params.customerId));
    const dId = new mongoose.Types.ObjectId(String(params.dealershipId));

    const [customer, account, dealership] = await Promise.all([
      Customer.findById(cId).select("customerCode name shopName phone address status paymentTerms paymentTermsDays creditDays").lean(),
      CustomerDealershipAccount.findOne({ customerId: cId, dealershipId: dId, isDeleted: false }).lean(),
      Dealership.findById(dId).select("name code paymentTerms paymentTermsDays defaultPaymentTermsDays").lean(),
    ]);

    if (!customer) throw new Error("Customer record not found");
    if (!account) throw new Error("Customer has no active account with this dealership");

    // 1. Resolve configured payment terms with strict precedence
    const customerTerms = parsePaymentTermsDays(
      (account as any)?.paymentTermsDays ??
      (account as any)?.paymentTerms ??
      (account as any)?.creditDays ??
      (customer as any)?.paymentTermsDays ??
      (customer as any)?.paymentTerms ??
      (customer as any)?.creditDays
    );

    const dealershipTerms = parsePaymentTermsDays(
      (dealership as any)?.paymentTermsDays ??
      (dealership as any)?.paymentTerms ??
      (dealership as any)?.defaultPaymentTermsDays
    );

    const defaultTermsDays = customerTerms ?? dealershipTerms ?? 30;

    // 2. Invoice-wise unpaid amount and due date (strictly for this dealership & customer)
    const unpaidOrders = await Order.find({
      customerId: cId,
      dealershipId: dId,
      orderStatus: { $in: ["confirmed", "processing", "fulfilled", "delivered"] },
      paymentStatus: { $in: ["unpaid", "partially_paid"] },
    })
      .sort({ orderDate: -1 })
      .select("orderNumber orderDate grandTotal paidAmount receivableAmount paymentStatus deliveryStatus dueDate paymentTerms paymentTermsDays")
      .lean();

    const now = params.asOfDate || new Date();
    let totalOverdue = 0;

    const invoiceWiseDues = unpaidOrders.map((o: any) => {
      const orderDate = new Date(o.orderDate);
      const orderTerms = parsePaymentTermsDays(o.paymentTermsDays ?? o.paymentTerms);
      const termsDays = orderTerms ?? defaultTermsDays;

      let dueDate: Date;
      if (o.dueDate && !isNaN(new Date(o.dueDate).getTime())) {
        dueDate = new Date(o.dueDate);
      } else {
        dueDate = new Date(orderDate.getTime() + termsDays * 86400000);
      }

      const dueAmount = o.receivableAmount != null ? o.receivableAmount : Math.max(0, o.grandTotal - (o.paidAmount || 0));

      const dhakaEndOfDueDay = getDhakaEndOfDay(dueDate);
      const isOverdue = dueAmount > 0 && now.getTime() > dhakaEndOfDueDay.getTime();
      const overdueDays = isOverdue
        ? Math.max(1, Math.ceil((now.getTime() - dhakaEndOfDueDay.getTime()) / 86400000))
        : 0;

      if (isOverdue) {
        totalOverdue += dueAmount;
      }

      return {
        orderId: String(o._id),
        orderNumber: o.orderNumber,
        orderDate,
        dueDate,
        termsDays,
        orderTotal: o.grandTotal,
        paidAmount: o.paidAmount || 0,
        dueAmount,
        paymentStatus: o.paymentStatus,
        deliveryStatus: o.deliveryStatus || "pending",
        isOverdue,
        overdueDays,
      };
    });

    // 3. Recent verified payments for this dealership
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

    // 4. Collection history (both pending and verified) for this dealership
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
    const canViewCredit = params.canViewCredit !== false;
    const rawCreditLimit = account.creditLimit || 0;
    const creditLimit = canViewCredit ? rawCreditLimit : 0;
    const availableCredit = canViewCredit ? Math.max(0, creditLimit - outstandingDue) : 0;

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
        totalOverdue: Math.round(totalOverdue * 100) / 100,
        configuredPaymentTermsDays: defaultTermsDays,
      },
      invoiceWiseDues,
      paymentHistory,
      lastPayment,
      collectionHistory,
      pendingCollectionsTotal: Math.round(pendingCollectionsTotal * 100) / 100,
    };
  }
}
