import mongoose from "mongoose";
import { Account } from "@/models/Account";
import { CustomerDealershipAccount } from "@/models/CustomerDealershipAccount";
import { SupplierPayable } from "@/models/SupplierPayable";
import { roundMoney, addMoney, subtractMoney } from "../AccountingService";
import type { FinancialAnalyticsData } from "./types";

export interface FinancialAggregationResult {
  financials: FinancialAnalyticsData;
  totalReceivables: number;
  totalPayables: number;
  totalOperatingExpenses: number;
  netProfit: number | null;
  netProfitMargin: number | null;
  grossMarginPercentage: number;
  custBalanceMap: Map<string, number>;
}

export class FinancialAnalyticsAggregator {
  static async aggregateFinancials(params: {
    businessId: mongoose.Types.ObjectId;
    dealershipId?: mongoose.Types.ObjectId;
    principalCompanyId?: mongoose.Types.ObjectId;
    dealerships: any[];
    dealershipMap: Map<string, { name: string; code: string }>;
    dealershipSalesMap: Map<string, { sales: number; count: number }>;
    currentPeriodGrossSales: number;
    currentPeriodCost: number;
    totalReturnsAmount: number;
    netSales: number;
    grossProfit: number;
  }): Promise<FinancialAggregationResult> {
    const {
      businessId,
      dealershipId,
      principalCompanyId,
      dealerships,
      dealershipMap,
      dealershipSalesMap,
      currentPeriodGrossSales,
      currentPeriodCost,
      totalReturnsAmount,
      netSales,
      grossProfit,
    } = params;

    // 1. Customer Receivables (AR)
    const custAccQuery: Record<string, any> = {
      businessId,
      isDeleted: false,
    };
    if (dealershipId) custAccQuery.dealershipId = dealershipId;

    const customerAccounts = await CustomerDealershipAccount.find(custAccQuery).lean();
    let totalReceivables = 0;
    const custBalanceMap = new Map<string, number>();
    for (const ca of customerAccounts) {
      const bal = ca.currentBalance ?? (ca as any).balance ?? 0;
      if (bal > 0) {
        totalReceivables = addMoney(totalReceivables, bal);
      }
      const cIdStr = String(ca.customerId);
      custBalanceMap.set(cIdStr, addMoney(custBalanceMap.get(cIdStr) || 0, bal));
    }

    // 2. Supplier Payables (AP)
    const payableQuery: Record<string, any> = {
      businessId,
      isCancelled: false,
      status: { $in: ["UNPAID", "PARTIALLY_PAID"] },
    };
    if (dealershipId) payableQuery.dealershipId = dealershipId;
    if (principalCompanyId) payableQuery.principalCompanyId = principalCompanyId;

    const supplierPayables = await SupplierPayable.find(payableQuery).lean();
    let totalPayables = 0;
    for (const sp of supplierPayables) {
      const bal = sp.outstandingBalance ?? (sp as any).currentPayable ?? 0;
      if (bal > 0) {
        totalPayables = addMoney(totalPayables, bal);
      }
    }

    // 3. Operating Expenses & Net Operating Profit (from GL)
    const expenseQuery: Record<string, any> = {
      businessId,
      $or: [
        { category: "EXPENSE" },
        { type: { $in: ["expense", "EXPENSE"] } },
        { code: { $in: ["6010", "6020", "6030", "6040"] } },
      ],
      code: { $ne: "5010" },
    };
    if (dealershipId) expenseQuery.dealershipId = dealershipId;

    const expenseAccounts = await Account.find(expenseQuery).lean();
    let totalOperatingExpenses = 0;
    const operatingExpensesList: Array<{ code: string; name: string; amount: number }> = [];

    for (const exp of expenseAccounts) {
      const b = roundMoney(exp.balance || 0);
      if (b > 0) {
        totalOperatingExpenses = addMoney(totalOperatingExpenses, b);
        operatingExpensesList.push({ code: exp.code, name: exp.name, amount: b });
      }
    }

    const netProfit: number | null = roundMoney(subtractMoney(grossProfit, totalOperatingExpenses));
    const netProfitMargin: number | null = netSales > 0 ? roundMoney((netProfit / netSales) * 100) : 0;
    const grossMarginPercentage = netSales > 0 ? roundMoney((grossProfit / netSales) * 100) : 0;

    // 4. Treasury Balances (Shared vs Operating)
    const treasuryQuery: Record<string, any> = {
      businessId,
      $or: [
        { code: { $in: ["1010", "1020"] } },
        { subType: { $in: ["cash", "bank", "mfs_bkash", "mfs_nagad", "mfs_rocket"] } },
        { isSharedTreasury: true },
        { type: { $in: ["asset", "ASSET"] } },
      ],
    };
    if (dealershipId) {
      treasuryQuery.$or = [
        { dealershipId },
        { isSharedTreasury: true },
        { code: { $in: ["1010", "1020"] } },
      ];
    }

    const treasuryAccounts = await Account.find(treasuryQuery).lean();
    let sharedCash = 0;
    let sharedBank = 0;
    let dshipTreasuryTotal = 0;
    const dshipTreasuryMap = new Map<string, number>();

    for (const tAcc of treasuryAccounts) {
      const b = roundMoney(tAcc.balance || 0);
      const isShared = Boolean(
        (tAcc as any).isSharedTreasury ||
        (tAcc.code === "1010" && (!tAcc.dealershipId || (tAcc as any).isSharedTreasury)) ||
        (tAcc.code === "1020" && (!tAcc.dealershipId || (tAcc as any).isSharedTreasury)) ||
        !tAcc.dealershipId
      );

      if (isShared) {
        if (tAcc.code === "1010" || tAcc.subType === "cash" || (tAcc.name || "").toLowerCase().includes("cash")) {
          sharedCash = addMoney(sharedCash, b);
        } else {
          sharedBank = addMoney(sharedBank, b);
        }
      } else {
        dshipTreasuryTotal = addMoney(dshipTreasuryTotal, b);
        const did = String(tAcc.dealershipId);
        dshipTreasuryMap.set(did, addMoney(dshipTreasuryMap.get(did) || 0, b));
      }
    }

    const sharedTreasuryTotal = addMoney(sharedCash, sharedBank);
    const totalLiquidFunds = addMoney(sharedTreasuryTotal, dshipTreasuryTotal);

    const dealershipTreasuryBreakdown = Array.from(dshipTreasuryMap.entries()).map(([did, bal]) => ({
      dealershipId: did,
      dealershipName: dealershipMap.get(did)?.name || "Local Dealership",
      balance: bal,
    }));

    // 5. Dealership profitability
    const dealershipProfitability = dealerships.map((d) => {
      const did = String(d._id);
      const rev = dealershipSalesMap.get(did)?.sales || 0;
      const cogs = roundMoney(rev * 0.65);
      const gp = Math.max(0, subtractMoney(rev, cogs));
      const gm = rev > 0 ? roundMoney((gp / rev) * 100) : 0;
      return {
        dealershipId: did,
        dealershipName: d.name,
        revenue: rev,
        cogs,
        grossProfit: gp,
        grossMarginPercentage: gm,
      };
    });

    return {
      financials: {
        grossRevenue: currentPeriodGrossSales,
        salesReturns: totalReturnsAmount,
        netRevenue: netSales,
        costOfGoodsSold: currentPeriodCost,
        grossProfit,
        grossMarginPercentage,
        totalOperatingExpenses,
        operatingExpenses: operatingExpensesList,
        netOperatingProfit: netProfit,
        dealershipProfitability,
        treasury: {
          sharedTreasuryCash: sharedCash,
          sharedTreasuryBank: sharedBank,
          sharedTreasuryTotal,
          dealershipOperatingTreasuryTotal: dshipTreasuryTotal,
          dealershipBreakdown: dealershipTreasuryBreakdown,
          totalLiquidFunds,
        },
      },
      totalReceivables,
      totalPayables,
      totalOperatingExpenses,
      netProfit,
      netProfitMargin,
      grossMarginPercentage,
      custBalanceMap,
    };
  }
}
