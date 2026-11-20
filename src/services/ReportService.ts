import { Order } from "@/models/Order";
import { Purchase } from "@/models/Purchase";
import { Product } from "@/models/Product";
import { Customer } from "@/models/Customer";
import { Vendor } from "@/models/Vendor";
import { InventoryBalance } from "@/models/InventoryBalance";
import { ProductVariant } from "@/models/ProductVariant";
import { AccountingService } from "./AccountingService";

export interface DashboardKPIs {
  totalProducts: number;
  activeProducts: number;
  totalCustomers: number;
  totalVendors: number;
  totalSalesOrders: number;
  totalSalesAmount: number;
  totalPurchasesAmount: number;
  grossProfit: number;
  netProfit: number;
  totalInventoryValuation: number;
  totalReceivables: number;
  totalPayables: number;
  pendingOrdersCount: number;
  unpaidOrdersAmount: number;
}

export class ReportService {
  /**
   * Calculate live real-database KPIs for the dashboard
   */
  static async getDashboardKPIs(filter?: string): Promise<DashboardKPIs> {
    const totalProducts = await Product.countDocuments();
    const activeProducts = await Product.countDocuments({ status: "active" });
    const totalCustomers = await Customer.countDocuments({ status: "active" });
    const totalVendors = await Vendor.countDocuments({ status: "active" });

    // Orders stats
    const orderStats = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$grandTotal" },
          orderCount: { $sum: 1 },
          pendingCount: {
            $sum: {
              $cond: [{ $in: ["$orderStatus", ["draft", "confirmed", "processing"]] }, 1, 0],
            },
          },
          unpaidTotal: { $sum: "$receivableAmount" },
        },
      },
    ]);

    // Purchase stats
    const purchaseStats = await Purchase.aggregate([
      {
        $group: {
          _id: null,
          totalPurchases: { $sum: "$grandTotal" },
        },
      },
    ]);

    // Receivables from customers
    const custReceivables = await Customer.aggregate([
      { $group: { _id: null, totalReceivables: { $sum: "$currentReceivable" } } },
    ]);

    // Payables to vendors
    const vendPayables = await Vendor.aggregate([
      { $group: { _id: null, totalPayables: { $sum: "$currentPayable" } } },
    ]);

    // Inventory Valuation (sum of onHandQuantity * purchasePrice for each variant)
    const balances = await InventoryBalance.find({ onHandQuantity: { $gt: 0 } }).lean();
    let totalInventoryValuation = 0;
    for (const b of balances) {
      const v = await ProductVariant.findById(b.variantId).lean();
      if (v) {
        totalInventoryValuation += b.onHandQuantity * v.purchasePrice;
      }
    }

    // P&L
    const pl = await AccountingService.getProfitAndLoss();

    return {
      totalProducts,
      activeProducts,
      totalCustomers,
      totalVendors,
      totalSalesOrders: orderStats[0]?.orderCount || 0,
      totalSalesAmount: orderStats[0]?.totalSales || 0,
      totalPurchasesAmount: purchaseStats[0]?.totalPurchases || 0,
      grossProfit: pl.grossProfit,
      netProfit: pl.netProfit,
      totalInventoryValuation: Math.round(totalInventoryValuation * 100) / 100,
      totalReceivables: custReceivables[0]?.totalReceivables || 0,
      totalPayables: vendPayables[0]?.totalPayables || 0,
      pendingOrdersCount: orderStats[0]?.pendingCount || 0,
      unpaidOrdersAmount: orderStats[0]?.unpaidTotal || 0,
    };
  }

  /**
   * Monthly Sales & Purchases Trend for Charts
   */
  static async getMonthlyTrends(): Promise<
    Array<{
      month: string;
      sales: number;
      purchases: number;
      profit: number;
    }>
  > {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);

    const salesByMonth = await Order.aggregate([
      { $match: { orderDate: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$orderDate" } },
          totalSales: { $sum: "$grandTotal" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const purchasesByMonth = await Purchase.aggregate([
      { $match: { orderDate: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$orderDate" } },
          totalPurchases: { $sum: "$grandTotal" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const monthMap: Record<
      string,
      { sales: number; purchases: number; profit: number }
    > = {};

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      const monthName = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      monthMap[key] = { sales: 0, purchases: 0, profit: 0 };
    }

    for (const s of salesByMonth) {
      if (monthMap[s._id]) {
        monthMap[s._id].sales = s.totalSales;
        monthMap[s._id].profit = Math.round(s.totalSales * 0.22); // estimated gross profit
      }
    }

    for (const p of purchasesByMonth) {
      if (monthMap[p._id]) {
        monthMap[p._id].purchases = p.totalPurchases;
      }
    }

    return Object.entries(monthMap).map(([key, val]) => {
      const [year, month] = key.split("-");
      const d = new Date(parseInt(year), parseInt(month) - 1, 1);
      const label = d.toLocaleDateString("en-US", { month: "short" });
      return {
        month: label,
        sales: val.sales,
        purchases: val.purchases,
        profit: val.profit,
      };
    });
  }

  /**
   * Top Selling Products
   */
  static async getTopProducts(limit = 5): Promise<
    Array<{
      name: string;
      sku: string;
      quantitySold: number;
      revenue: number;
    }>
  > {
    const top = await Order.aggregate([
      { $match: { orderStatus: { $in: ["confirmed", "processing", "fulfilled", "delivered"] } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.variantId",
          name: { $first: "$items.name" },
          sku: { $first: "$items.sku" },
          quantitySold: { $sum: "$items.quantity" },
          revenue: { $sum: "$items.subtotal" },
        },
      },
      { $sort: { quantitySold: -1 } },
      { $limit: limit },
    ]);

    return top.map((t) => ({
      name: t.name,
      sku: t.sku,
      quantitySold: t.quantitySold,
      revenue: t.revenue,
    }));
  }
}
