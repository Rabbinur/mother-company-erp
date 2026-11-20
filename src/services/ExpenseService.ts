import mongoose from "mongoose";
import { Expense, IExpense } from "@/models/Expense";
import { ExpenseCategory } from "@/models/ExpenseCategory";
import { Account } from "@/models/Account";
import { AccountingService } from "./AccountingService";
import { AuditService } from "./AuditService";
import { generateReferenceCode } from "@/lib/utils";

export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: "Rent & Facilities", code: "rent", description: "Warehouse and office rent" },
  { name: "Salaries & Wages", code: "salary", description: "Staff payroll and wages" },
  { name: "Utilities & Internet", code: "utilities", description: "Electricity, water, gas, internet" },
  { name: "Transportation & Freight", code: "transportation", description: "Goods delivery and local transport" },
  { name: "Marketing & Promotions", code: "marketing", description: "Advertising and promotional activities" },
  { name: "Packaging Materials", code: "packaging", description: "Boxes, tape, labels, and wrapping" },
  { name: "Repairs & Maintenance", code: "maintenance", description: "Equipment and office maintenance" },
  { name: "Other Expenses", code: "other", description: "Miscellaneous operational expenses" },
];

export class ExpenseService {
  static async ensureDefaultCategories(): Promise<void> {
    for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
      const exists = await ExpenseCategory.findOne({ code: cat.code });
      if (!exists) {
        await ExpenseCategory.create({ ...cat, status: "active" });
      }
    }
  }

  static async createExpense(params: {
    categoryId: string | mongoose.Types.ObjectId;
    accountId: string | mongoose.Types.ObjectId;
    amount: number;
    payee: string;
    description: string;
    date?: Date;
    receiptAttachment?: string;
    autoApprove?: boolean;
    createdBy?: string | mongoose.Types.ObjectId;
  }): Promise<IExpense> {
    await this.ensureDefaultCategories();

    const cId = new mongoose.Types.ObjectId(String(params.categoryId));
    const aId = new mongoose.Types.ObjectId(String(params.accountId));
    const uId = params.createdBy ? new mongoose.Types.ObjectId(String(params.createdBy)) : undefined;

    const category = await ExpenseCategory.findById(cId);
    if (!category) {
      throw new Error("Expense category not found");
    }

    const account = await Account.findById(aId);
    if (!account) {
      throw new Error("Payment account not found");
    }

    const amount = Number(params.amount);
    if (amount <= 0) {
      throw new Error("Expense amount must be greater than zero");
    }

    const expenseNumber = generateReferenceCode(
      "EXP",
      Math.floor(Math.random() * 9000 + 1000)
    );

    const isApproved = params.autoApprove !== false;
    let journalEntryId: mongoose.Types.ObjectId | undefined;

    if (isApproved) {
      // Double-entry: Debit Operating Expense, Credit Cash/Bank/MFS
      try {
        const opExpAccount = await AccountingService.getAccountBySubType("operating_expense");

        const je = await AccountingService.postJournalEntry({
          referenceType: "expense",
          referenceId: expenseNumber,
          narration: `Expense: ${category.name} - ${params.payee}`,
          lines: [
            {
              accountId: opExpAccount._id as mongoose.Types.ObjectId,
              debit: amount,
              credit: 0,
              description: `${category.name}: ${params.description}`,
            },
            {
              accountId: aId,
              debit: 0,
              credit: amount,
              description: `Payment from ${account.name}`,
            },
          ],
          postedBy: uId,
        });
        journalEntryId = je._id as mongoose.Types.ObjectId;
      } catch (accErr) {
        console.error("[ExpenseService.createExpense] Accounting error:", accErr);
      }
    }

    const expense = await Expense.create({
      expenseNumber,
      categoryId: cId,
      accountId: aId,
      amount,
      date: params.date || new Date(),
      payee: params.payee,
      description: params.description,
      approvalStatus: isApproved ? "approved" : "pending",
      approvedBy: isApproved ? uId : undefined,
      receiptAttachment: params.receiptAttachment,
      journalEntryId,
      createdBy: uId,
    });

    await AuditService.log({
      actorId: uId,
      action: "EXPENSE_CREATED",
      entityType: "expense",
      entityId: String(expense._id),
      afterSnapshot: {
        expenseNumber,
        category: category.name,
        amount,
        payee: params.payee,
      },
    });

    return expense;
  }
}
