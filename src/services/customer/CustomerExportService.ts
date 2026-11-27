import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { CustomerProfileService } from "./CustomerProfileService";
import mongoose from "mongoose";

export class CustomerExportService {
  /**
   * Generate genuine Excel (.xlsx) workbook for customer profile section
   */
  static async generateExcelWorkbook(
    customerId: string | mongoose.Types.ObjectId,
    section: "overview" | "orders" | "payments" | "dues" | "returns" | "all" = "all"
  ): Promise<{ filename: string; buffer: Buffer }> {
    const profile = await CustomerProfileService.getCompleteProfile(customerId);
    const wb = XLSX.utils.book_new();

    // 1. Overview & Dealership Dues
    if (section === "overview" || section === "dues" || section === "all") {
      const duesData = profile.dealershipAccounts.map((da) => ({
        "Dealership Name": da.dealershipName,
        "Credit Limit (BDT)": da.creditLimit,
        "Current Balance Due (BDT)": da.currentBalance,
        "Total Invoiced (BDT)": da.totalInvoiced,
        "Total Collected (BDT)": da.totalCollected,
        "Assigned Salesman": da.salesmanName,
        Status: da.status,
      }));
      const wsDues = XLSX.utils.json_to_sheet(duesData);
      XLSX.utils.book_append_sheet(wb, wsDues, "Dealership Accounts");
    }

    // 2. Orders & Products
    if (section === "orders" || section === "all") {
      const ordersData = profile.ordersSummary.recentOrders.map((o) => ({
        "Order Number": o.orderNumber,
        "Grand Total (BDT)": o.grandTotal,
        "Paid Amount (BDT)": o.paidAmount,
        "Order Status": o.orderStatus,
        "Payment Status": o.paymentStatus,
        Date: new Date(o.createdAt).toLocaleDateString(),
      }));
      const wsOrders = XLSX.utils.json_to_sheet(ordersData);
      XLSX.utils.book_append_sheet(wb, wsOrders, "Orders History");
    }

    // 3. Payments & Collections
    if (section === "payments" || section === "all") {
      const paymentsData = profile.paymentsSummary.recentPayments.map((p) => ({
        "Payment Number": p.paymentNumber,
        "Amount (BDT)": p.amount,
        Method: p.paymentMethod,
        Status: p.status,
        Date: new Date(p.date).toLocaleDateString(),
      }));
      const wsPayments = XLSX.utils.json_to_sheet(paymentsData);
      XLSX.utils.book_append_sheet(wb, wsPayments, "Payments");
    }

    // 4. Returns & Claims
    if (section === "returns" || section === "all") {
      const returnsData = profile.returnsSummary.recentReturns.map((r) => ({
        "Return Number": r.returnNumber,
        "Refund Credit (BDT)": r.refundAmount,
        Status: r.status,
        Date: new Date(r.createdAt).toLocaleDateString(),
      }));
      const wsReturns = XLSX.utils.json_to_sheet(returnsData);
      XLSX.utils.book_append_sheet(wb, wsReturns, "Returns");
    }

    const rawBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const buffer = Buffer.isBuffer(rawBuffer) ? rawBuffer : Buffer.from(rawBuffer);

    return {
      filename: `customer-${profile.customer.customerCode}-${section}.xlsx`,
      buffer,
    };
  }

  /**
   * Generate genuine PDF document for customer profile section
   */
  static async generatePdfDocument(
    customerId: string | mongoose.Types.ObjectId,
    section: "overview" | "orders" | "payments" | "dues" | "returns" | "all" = "all"
  ): Promise<{ filename: string; buffer: Buffer }> {
    const profile = await CustomerProfileService.getCompleteProfile(customerId);
    const doc = new jsPDF();

    // Header
    doc.setFontSize(16);
    doc.text("CUSTOMER PROFILE STATEMENT", 14, 20);
    doc.setFontSize(10);
    doc.text(`Customer Code: ${profile.customer.customerCode}`, 14, 28);
    doc.text(`Shop Name: ${profile.customer.shopName}`, 14, 34);
    doc.text(`Phone: ${profile.customer.phone}`, 14, 40);
    doc.text(`Total Due: BDT ${profile.customer.currentReceivable || 0}`, 14, 46);

    let currentY = 56;

    // Dealership Dues
    if (section === "overview" || section === "dues" || section === "all") {
      doc.setFontSize(12);
      doc.text("Dealership Accounts & Outstanding Dues (Strict Isolation):", 14, currentY);
      currentY += 8;
      doc.setFontSize(9);
      profile.dealershipAccounts.forEach((da) => {
        doc.text(
          `${da.dealershipName} | Credit Limit: BDT ${da.creditLimit} | Balance Due: BDT ${da.currentBalance} | Rep: ${da.salesmanName}`,
          14,
          currentY
        );
        currentY += 6;
      });
      currentY += 4;
    }

    // Orders
    if (section === "orders" || section === "all") {
      doc.setFontSize(12);
      doc.text(`Recent Orders (${profile.ordersSummary.totalOrders}):`, 14, currentY);
      currentY += 8;
      doc.setFontSize(9);
      profile.ordersSummary.recentOrders.slice(0, 8).forEach((o) => {
        doc.text(
          `${o.orderNumber} | Total: BDT ${o.grandTotal} | Paid: BDT ${o.paidAmount} | Status: ${o.orderStatus}`,
          14,
          currentY
        );
        currentY += 6;
      });
      currentY += 4;
    }

    // Payments
    if (section === "payments" || section === "all") {
      doc.setFontSize(12);
      doc.text("Recent Payments & Collections:", 14, currentY);
      currentY += 8;
      doc.setFontSize(9);
      profile.paymentsSummary.recentPayments.slice(0, 6).forEach((p) => {
        doc.text(`${p.paymentNumber} | BDT ${p.amount} | ${p.paymentMethod} | ${p.status}`, 14, currentY);
        currentY += 6;
      });
    }

    const pdfArrayBuffer = doc.output("arraybuffer");
    const buffer = Buffer.from(pdfArrayBuffer);

    return {
      filename: `customer-${profile.customer.customerCode}-${section}.pdf`,
      buffer,
    };
  }
}
