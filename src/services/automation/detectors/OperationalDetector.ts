import mongoose from "mongoose";
import { Dispatch } from "@/models/Dispatch";
import { Expense } from "@/models/Expense";
import { SupportTicket } from "@/models/SupportTicket";
import type { IAutomationRule } from "@/models/AutomationRule";
import type { DetectorResult, DetectedCondition } from "../types";

export class OperationalDetector {
  static async evaluate(params: {
    rule: IAutomationRule;
    businessId: mongoose.Types.ObjectId;
    dealershipId?: mongoose.Types.ObjectId;
  }): Promise<DetectorResult> {
    const { rule, businessId, dealershipId } = params;
    const ruleKey = rule.ruleKey;
    const conditions: DetectedCondition[] = [];

    // F.1: Employee Attendance Reconciliation -> Return NOT_CONFIGURED
    if (ruleKey === "EMPLOYEE_ATTENDANCE_RECONCILIATION") {
      return {
        ruleKey,
        category: "OPERATIONAL",
        status: "NOT_CONFIGURED",
        conditions: [],
        evaluatedCount: 0,
        unconfiguredReason: "No employee attendance or work-log model exists in the database schema.",
      };
    }

    const baseFilter: Record<string, any> = { businessId };
    if (dealershipId) baseFilter.dealershipId = dealershipId;
    let evaluatedCount = 0;

    if (ruleKey === "DELIVERY_EXPENSE_SETTLEMENT_PENDING") {
      // Check dispatches with pending expense reimbursement claims
      const dispatches = await Dispatch.find({
        ...baseFilter,
        "expenses.reimbursementStatus": "pending_claim",
      }).lean();
      evaluatedCount += dispatches.length;

      for (const disp of dispatches) {
        const pendingClaims = (disp.expenses || []).filter((e: any) => e.reimbursementStatus === "pending_claim");
        const totalClaim = pendingClaims.reduce((acc: number, e: any) => acc + (e.claimAmount || 0), 0);
        const dId = disp.dealershipIds && disp.dealershipIds.length > 0 ? String(disp.dealershipIds[0]) : undefined;
        conditions.push({
          ruleKey,
          category: "OPERATIONAL",
          severity: rule.severity,
          title: `Pending Delivery Expense Claim: ${disp.dispatchNumber}`,
          message: `Dispatch ${disp.dispatchNumber} has BDT ${totalClaim.toLocaleString()} in pending expense reimbursement claims.`,
          sourceEntityType: "Dispatch",
          sourceEntityId: String(disp._id),
          dealershipId: dId,
          deduplicationKey: `${businessId}:${ruleKey}:${disp._id}`,
          metadata: { dispatchId: String(disp._id), totalClaim, count: pendingClaims.length },
        });
      }

      // Also check general Expense records with approvalStatus === "pending"
      const pendingExpenses = await Expense.find({
        ...baseFilter,
        approvalStatus: "pending",
      }).lean();
      evaluatedCount += pendingExpenses.length;

      for (const exp of pendingExpenses) {
        conditions.push({
          ruleKey,
          category: "OPERATIONAL",
          severity: rule.severity,
          title: `Pending Expense Approval: ${exp.expenseNumber}`,
          message: `Expense ${exp.expenseNumber} of BDT ${(exp.amount || 0).toLocaleString()} for '${exp.payee}' is pending management approval.`,
          sourceEntityType: "Expense",
          sourceEntityId: String(exp._id),
          deduplicationKey: `${businessId}:${ruleKey}:${exp._id}`,
          metadata: { expenseId: String(exp._id), expenseNumber: exp.expenseNumber, amount: exp.amount, payee: exp.payee },
        });
      }
    } else if (ruleKey === "UNRESOLVED_SUPPORT_TICKET") {
      const tickets = await SupportTicket.find({
        ...baseFilter,
        status: "pending",
      }).lean();
      evaluatedCount = tickets.length;

      for (const t of tickets) {
        conditions.push({
          ruleKey,
          category: "OPERATIONAL",
          severity: rule.severity,
          title: `Pending Support Ticket: #${t.ticketId}`,
          message: `Support ticket #${t.ticketId} ('${t.reason}') requires administrative review and resolution.`,
          sourceEntityType: "SupportTicket",
          sourceEntityId: String(t._id),
          deduplicationKey: `${businessId}:${ruleKey}:${t._id}`,
          metadata: { ticketId: t.ticketId, reason: t.reason },
        });
      }
    } else if (ruleKey === "MANUAL_BUSINESS_TASK") {
      // Informational placeholder rule for user-defined task reminders
      evaluatedCount = 1;
    }

    return {
      ruleKey,
      category: "OPERATIONAL",
      status: "EVALUATED",
      conditions,
      evaluatedCount,
    };
  }
}
