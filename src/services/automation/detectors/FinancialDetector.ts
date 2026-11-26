import mongoose from "mongoose";
import { AccountingPeriod } from "@/models/AccountingPeriod";
import { BankReconciliation } from "@/models/BankReconciliation";
import { TransactionOutcome } from "@/models/TransactionOutcome";
import { CustomerDealershipAccount } from "@/models/CustomerDealershipAccount";
import { SupplierPayable } from "@/models/SupplierPayable";
import type { IAutomationRule } from "@/models/AutomationRule";
import type { DetectorResult, DetectedCondition } from "../types";

export class FinancialDetector {
  static async evaluate(params: {
    rule: IAutomationRule;
    businessId: mongoose.Types.ObjectId;
    dealershipId?: mongoose.Types.ObjectId;
  }): Promise<DetectorResult> {
    const { rule, businessId, dealershipId } = params;
    const ruleKey = rule.ruleKey;
    const config = rule.configuration || {};
    const conditions: DetectedCondition[] = [];
    const now = new Date();

    const baseFilter: Record<string, any> = { businessId };
    if (dealershipId) baseFilter.dealershipId = dealershipId;

    let evaluatedCount = 0;

    if (ruleKey === "ACCOUNTING_PERIOD_CLOSING_SOON") {
      const warnDays = config.warningDays ?? 3;
      const targetDate = new Date(now.getTime() + warnDays * 86400000);

      const periods = await AccountingPeriod.find({
        ...baseFilter,
        status: "OPEN",
        endDate: { $lte: targetDate },
      }).lean();
      evaluatedCount = periods.length;

      for (const p of periods) {
        const daysLeft = Math.ceil((new Date(p.endDate).getTime() - now.getTime()) / 86400000);
        conditions.push({
          ruleKey,
          category: "FINANCIAL",
          severity: rule.severity,
          title: `Accounting Period Closing Soon: ${p.periodName}`,
          message: `Period ${p.periodName} is scheduled to close ${daysLeft <= 0 ? "today" : "in " + daysLeft + " days"} (${new Date(p.endDate).toISOString().split("T")[0]}).`,
          sourceEntityType: "AccountingPeriod",
          sourceEntityId: String(p._id),
          dealershipId: p.dealershipId ? String(p.dealershipId) : undefined,
          deduplicationKey: `${businessId}:${ruleKey}:${p._id}`,
          metadata: { periodId: String(p._id), periodName: p.periodName, endDate: p.endDate, daysLeft },
        });
      }
    } else if (ruleKey === "UNRECONCILED_BANK_DISCREPANCY") {
      const reconciliations = await BankReconciliation.find({
        ...baseFilter,
        $or: [{ status: "DISCREPANCY" }, { discrepancy: { $ne: 0 } }],
      }).lean();
      evaluatedCount = reconciliations.length;

      for (const r of reconciliations) {
        conditions.push({
          ruleKey,
          category: "FINANCIAL",
          severity: "CRITICAL",
          title: `Bank Reconciliation Discrepancy: ${r.accountName} (${r.accountCode})`,
          message: `Bank reconciliation discrepancy of BDT ${Math.abs(r.discrepancy || 0).toLocaleString()} detected between ledger and statement.`,
          sourceEntityType: "BankReconciliation",
          sourceEntityId: String(r._id),
          dealershipId: r.dealershipId ? String(r.dealershipId) : undefined,
          deduplicationKey: `${businessId}:${ruleKey}:${r._id}`,
          metadata: { accountCode: r.accountCode, accountName: r.accountName, discrepancy: r.discrepancy },
        });
      }
    } else if (ruleKey === "OUTSTANDING_PAYABLE_RECEIVABLE_ATTENTION") {
      const threshold = config.thresholdAmount ?? 500000;
      // High value receivables
      const highCust = await CustomerDealershipAccount.find({
        ...baseFilter,
        currentBalance: { $gte: threshold },
      }).lean();
      evaluatedCount += highCust.length;

      for (const c of highCust) {
        conditions.push({
          ruleKey,
          category: "FINANCIAL",
          severity: rule.severity,
          title: `High Outstanding Balance: Customer ${c.customerId}`,
          message: `Customer account carries high balance of BDT ${c.currentBalance.toLocaleString()} (threshold: BDT ${threshold.toLocaleString()}).`,
          sourceEntityType: "CustomerDealershipAccount",
          sourceEntityId: String(c._id),
          dealershipId: c.dealershipId ? String(c.dealershipId) : undefined,
          deduplicationKey: `${businessId}:${ruleKey}:Customer:${c._id}`,
          metadata: { customerId: String(c.customerId), balance: c.currentBalance },
        });
      }

      // High value payables
      const highPayables = await SupplierPayable.find({
        ...baseFilter,
        status: { $in: ["UNPAID", "PARTIALLY_PAID"] },
        outstandingBalance: { $gte: threshold },
      }).lean();
      evaluatedCount += highPayables.length;

      for (const p of highPayables) {
        conditions.push({
          ruleKey,
          category: "FINANCIAL",
          severity: rule.severity,
          title: `High Outstanding Payable: ${p.payableNumber}`,
          message: `Payable ${p.payableNumber} has high unpaid balance of BDT ${p.outstandingBalance.toLocaleString()}.`,
          sourceEntityType: "SupplierPayable",
          sourceEntityId: String(p._id),
          dealershipId: p.dealershipId ? String(p.dealershipId) : undefined,
          deduplicationKey: `${businessId}:${ruleKey}:Payable:${p._id}`,
          metadata: { payableId: String(p._id), payableNumber: p.payableNumber, balance: p.outstandingBalance },
        });
      }
    } else if (ruleKey === "TRANSACTION_OUTCOME_FAILURE") {
      const failures = await TransactionOutcome.find({
        ...baseFilter,
        status: { $in: ["ABORTED", "RECONCILIATION_REQUIRED"] },
      }).lean();
      evaluatedCount = failures.length;

      for (const f of failures) {
        conditions.push({
          ruleKey,
          category: "FINANCIAL",
          severity: "CRITICAL",
          title: `Transaction Failure Requires Review: ${f.operationType}`,
          message: `Operation '${f.operationType}' resulted in '${f.status}' status. Manual review required. Error: ${f.errorMessage || "None"}.`,
          sourceEntityType: "TransactionOutcome",
          sourceEntityId: String(f._id),
          dealershipId: f.dealershipId ? String(f.dealershipId) : undefined,
          deduplicationKey: `${businessId}:${ruleKey}:${f._id}`,
          metadata: { outcomeId: String(f._id), operationType: f.operationType, status: f.status, error: f.errorMessage },
        });
      }
    }

    return {
      ruleKey,
      category: "FINANCIAL",
      status: "EVALUATED",
      conditions,
      evaluatedCount,
    };
  }
}
