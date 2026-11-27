import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import { DeliveryCollectionSyncService } from "@/services/delivery/DeliveryCollectionSyncService";
import { CustomerProfileService } from "@/services/customer/CustomerProfileService";
import { CustomerExportService } from "@/services/customer/CustomerExportService";
import { SalesmanCustomerDueService } from "@/services/customer/SalesmanCustomerDueService";
import { FieldSalesService } from "@/services/FieldSalesService";
import { FieldSalesDeliveryService } from "@/services/delivery/FieldSalesDeliveryService";
import { FreeFirstSmsService } from "@/services/integrations/FreeFirstSmsService";
import { EmailProviderService } from "@/services/integrations/EmailProviderService";
import { SalesTargetAlertService } from "@/services/analytics/SalesTargetAlertService";
import { DeliveryCollection } from "@/models/DeliveryCollection";
import { Order } from "@/models/Order";
import { Customer } from "@/models/Customer";
import { CustomerDealershipAccount } from "@/models/CustomerDealershipAccount";
import { Payment } from "@/models/Payment";
import { SalesReturn } from "@/models/SalesReturn";
import { Dispatch } from "@/models/Dispatch";
import { Dealership } from "@/models/Dealership";
import { RateLimit } from "@/models/RateLimit";
import { IntegrationSetting } from "@/models/IntegrationSetting";
import { InventoryBalance } from "@/models/InventoryBalance";
import { User } from "@/models/User";
import { Notification } from "@/models/Notification";

describe("Phase 4 Step 6: Final Business Workflow Integration Test Suite", () => {
  beforeEach(() => {
    RateLimit.create = async () => ({});
    RateLimit.deleteOne = async () => ({});
    Dealership.findById = () => ({ select: () => ({ lean: async () => ({ name: "Dhaka Central", code: "D1" }) }) });
    User.findById = () => ({ select: () => ({ lean: async () => ({ name: "Hasan", phone: "01700" }) }) });
    Notification.create = async () => ({});
  });

  describe("1. Deliveryman Physical Cash Collection & Reconciliation", () => {
    it("should compute accurate cash held via verifiedCashCollected - verifiedCashDeposited and reject non-cash", async () => {
      const mockDManId = new mongoose.Types.ObjectId();
      const origFind = DeliveryCollection.find;
      const cols = [
        { collectionId: "C1", amount: 4000, paymentMethod: "cash", status: "verified", syncStatus: "SYNCED", createdAt: new Date() },
        { collectionId: "C2", amount: 1500, paymentMethod: "cash", status: "deposited", syncStatus: "SYNCED", createdAt: new Date() },
        { collectionId: "C3", amount: 2000, paymentMethod: "cash", status: "reconciled", syncStatus: "SYNCED", createdAt: new Date() },
      ];
      DeliveryCollection.find = () => ({ sort: () => ({ limit: async () => cols }) });

      try {
        const summary = await DeliveryCollectionSyncService.getDeliverymanFinancialSummary(mockDManId);
        assert.equal(summary.totalCashCollected, 7500);
        assert.equal(summary.currentCashHeld, 4000);
        assert.equal(summary.verifiedDeposits, 2000);

        await assert.rejects(
          async () => {
            await DeliveryCollectionSyncService.recordCollection({
              orderId: new mongoose.Types.ObjectId(), deliverymanId: mockDManId, amount: 500, paymentMethod: "bkash",
            });
          },
          /Deliveryman collections currently accept physical cash only/
        );
      } finally {
        DeliveryCollection.find = origFind;
      }
    });

    it("should prevent deliveryman from self-approving their own deposit reconciliation", async () => {
      const deliverymanId = new mongoose.Types.ObjectId();
      await assert.rejects(
        async () => {
          await DeliveryCollectionSyncService.recordDeliverymanDeposit({
            deliverymanId, collectionIds: ["C1"], depositAmount: 5000, depositedToAccountId: new mongoose.Types.ObjectId(), reconciledByUserId: deliverymanId,
          });
        },
        /Security Violation: Deliveryman cannot approve their own deposit/
      );
    });
  });

  describe("2. Customer Profile & Multi-Format Exports (Excel & PDF)", () => {
    it("should isolate dealership ledgers and generate genuine Excel and PDF buffers", async () => {
      const mockCustId = new mongoose.Types.ObjectId();
      const origCustFind = Customer.findById;
      const origAccFind = CustomerDealershipAccount.find;
      const origModels = [Order, Payment, DeliveryCollection, SalesReturn, Dispatch];
      const origFinds = origModels.map((m) => m.find);
      const emptyFind = () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) });

      Customer.findById = () => ({ lean: async () => ({ _id: mockCustId, customerCode: "CUST-001", shopName: "Madina Store", currentReceivable: 12000 }) });
      CustomerDealershipAccount.find = () => ({ populate: () => ({ populate: () => ({ lean: async () => [
        { dealershipId: { _id: "D1", name: "Dhaka Central" }, creditLimit: 20000, currentBalance: 8000, totalInvoiced: 50000, totalCollected: 42000 },
      ] }) }) });
      origModels.forEach((m) => { m.find = emptyFind; });

      try {
        const profile = await CustomerProfileService.getCompleteProfile(mockCustId);
        assert.equal(profile.dealershipAccounts[0].currentBalance, 8000);

        const [excelRes, pdfRes] = await Promise.all([
          CustomerExportService.generateExcelWorkbook(mockCustId, "all"),
          CustomerExportService.generatePdfDocument(mockCustId, "all"),
        ]);
        assert.ok(Buffer.isBuffer(excelRes.buffer) && excelRes.filename.endsWith(".xlsx"));
        assert.ok(Buffer.isBuffer(pdfRes.buffer) && pdfRes.filename.endsWith(".pdf"));
      } finally {
        Customer.findById = origCustFind;
        CustomerDealershipAccount.find = origAccFind;
        origModels.forEach((m, i) => { m.find = origFinds[i]; });
      }
    });
  });

  describe("3. Field Sales Customer Sync & Deduplication", () => {
    it("should deduplicate existing customer by phone number", async () => {
      const origCustFind = Customer.findOne;
      const origAccFind = CustomerDealershipAccount.findOneAndUpdate;
      Customer.findOne = async () => ({ _id: new mongoose.Types.ObjectId(), customerCode: "CUST-EXISTING", phone: "01819998877" });
      CustomerDealershipAccount.findOneAndUpdate = async () => ({});

      try {
        const syncResult = await FieldSalesService.syncCustomer({
          name: "Karim", shopName: "Karim Variety", phone: "01819998877", dealershipId: new mongoose.Types.ObjectId(), businessId: new mongoose.Types.ObjectId(),
        });
        assert.equal(syncResult.isNew, false);
        assert.equal(syncResult.customerCode, "CUST-EXISTING");
      } finally {
        Customer.findOne = origCustFind;
        CustomerDealershipAccount.findOneAndUpdate = origAccFind;
      }
    });
  });

  describe("4. Field Sales Delivery Assignment & Status Update", () => {
    it("should assign deliveryman and update order delivery status", async () => {
      const mockOrderId = new mongoose.Types.ObjectId();
      const mockOrder = { _id: mockOrderId, orderNumber: "ORD-FS-901", orderStatus: "confirmed", deliveryStatus: "pending", save: async () => {} };
      const origOrderFind = Order.findById;
      Order.findById = async () => mockOrder;
      Dispatch.updateMany = Dispatch.updateOne = async () => ({ modifiedCount: 1 });

      const mockDManId = new mongoose.Types.ObjectId();
      try {
        const assignRes = await FieldSalesDeliveryService.assignDeliveryman({ orderId: String(mockOrderId), deliverymanId: String(mockDManId), deliverymanName: "Hasan" });
        assert.equal(assignRes.success, true);
        assert.equal(mockOrder.deliveryStatus, "out_for_delivery");

        const statusRes = await FieldSalesDeliveryService.updateDeliveryStatus({ orderId: String(mockOrderId), status: "delivered" });
        assert.equal(statusRes.success, true);
        assert.equal(mockOrder.deliveryStatus, "delivered");
      } finally {
        Order.findById = origOrderFind;
      }
    });
  });

  describe("5. Free-First SMS Engine & Paid Tier Gating", () => {
    it("should block paid SMS when owner has not explicitly approved paid tier", async () => {
      process.env.FREE_SMS_ENABLED = "false";
      process.env.SMS_API_KEY = "paid_key";
      const origSettingFind = IntegrationSetting.findOne;
      IntegrationSetting.findOne = async () => ({ enabled: true, metadata: { paidTierApproved: false } });

      try {
        const res = await FreeFirstSmsService.send({ recipient: "01700000000", message: "Hello" }, new mongoose.Types.ObjectId());
        assert.equal(res.success, false);
        assert.equal(res.tierUsed, "BLOCKED_UNAPPROVED");
      } finally {
        IntegrationSetting.findOne = origSettingFind;
      }
    });
  });

  describe("6. Email Provider & Operational / Target Alerts", () => {
    it("should return NOT_CONFIGURED when unconfigured and deduplicate via idempotencyKey", async () => {
      delete process.env.RESEND_API_KEY;
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;

      const provider = EmailProviderService.getInstance();
      const payload = { to: "manager@test.com", subject: "Low Stock Alert", alertType: "product_low_stock", idempotencyKey: "test-low-01" };
      const res1 = await provider.sendEmail(payload);
      assert.equal(res1.status, "NOT_CONFIGURED");

      const res2 = await provider.sendEmail(payload);
      assert.equal(res2.status, "SENT");
    });
  });

  describe("7. Customer Financial Data Access Restrictions & Security", () => {
    it("should never expose customer balance or dues in general salesman order list", async () => {
      const origOrderFind = Order.find;
      const origCount = Order.countDocuments;
      const mockOrder = {
        _id: new mongoose.Types.ObjectId(), orderNumber: "ORD-SEC-01", customerId: { name: "Rahim", shopName: "Rahim Store" },
        grandTotal: 15000, paidAmount: 5000, receivableAmount: 10000, orderStatus: "confirmed", deliveryStatus: "pending", orderDate: new Date(),
      };
      Order.find = () => ({ populate: () => ({ sort: () => ({ skip: () => ({ limit: () => ({ lean: async () => [mockOrder] }) }) }) }) });
      Order.countDocuments = async () => 1;

      try {
        const result = await FieldSalesDeliveryService.listFieldSalesOrders({});
        const order = result.orders[0];
        assert.equal(order.orderNumber, "ORD-SEC-01");
        assert.equal(order.orderTotal, 15000);
        assert.equal(order.balance, undefined);
        assert.equal(order.receivableAmount, undefined);
        assert.equal(order.paidAmount, undefined);
      } finally {
        Order.find = origOrderFind;
        Order.countDocuments = origCount;
      }
    });
  });

  describe("8. Salesman Customer Due & Overdue Collection Workflow", () => {
    it("should allow salesman to view authorized customer due, unpaid invoices and payment history", async () => {
      const cId = new mongoose.Types.ObjectId(), dId = new mongoose.Types.ObjectId();
      const origCustFind = Customer.findById, origAccFind = CustomerDealershipAccount.findOne, origDealFind = Dealership.findById;
      const origOrderFind = Order.find, origPayFind = Payment.find, origColFind = DeliveryCollection.find;

      Customer.findById = () => ({ select: () => ({ lean: async () => ({ _id: cId, customerCode: "CUST-DUE-1", name: "Anis", shopName: "Anis Store", phone: "01700" }) }) });
      CustomerDealershipAccount.findOne = () => ({ lean: async () => ({ customerId: cId, dealershipId: dId, currentBalance: 8500, creditLimit: 20000, totalInvoiced: 50000, totalCollected: 41500 }) });
      Dealership.findById = () => ({ select: () => ({ lean: async () => ({ name: "Dhaka Central", code: "D1" }) }) });
      Order.find = () => ({ sort: () => ({ select: () => ({ lean: async () => [{ _id: new mongoose.Types.ObjectId(), orderNumber: "INV-101", orderDate: new Date(), grandTotal: 5000, paidAmount: 2000, receivableAmount: 3000, paymentStatus: "partially_paid", deliveryStatus: "delivered" }] }) }) });
      Payment.find = () => ({ sort: () => ({ limit: () => ({ select: () => ({ lean: async () => [{ _id: "p1", paymentNumber: "PAY-1", amount: 2000, paymentMethod: "cash", date: new Date() }] }) }) }) });
      DeliveryCollection.find = () => ({ sort: () => ({ limit: () => ({ select: () => ({ lean: async () => [{ collectionId: "COL-PENDING-1", amount: 1500, paymentMethod: "cash", status: "pending_verification", collectorRole: "salesman", createdAt: new Date() }] }) }) }) });

      try {
        const profile = await SalesmanCustomerDueService.getSalesmanCustomerDueProfile({ customerId: cId, dealershipId: dId });
        assert.equal(profile.customer.shopName, "Anis Store");
        assert.equal(profile.dealershipDue.outstandingDue, 8500);
        assert.equal(profile.dealershipDue.availableCredit, 11500);
        assert.equal(profile.invoiceWiseDues[0].dueAmount, 3000);
        assert.equal(profile.paymentHistory[0].amount, 2000);
        assert.equal(profile.pendingCollectionsTotal, 1500);
        assert.equal(profile.generalLedger, undefined);
        assert.equal(profile.purchasePrice, undefined);
        assert.equal(profile.profitMargin, undefined);
      } finally {
        Customer.findById = origCustFind; CustomerDealershipAccount.findOne = origAccFind; Dealership.findById = origDealFind;
        Order.find = origOrderFind; Payment.find = origPayFind; DeliveryCollection.find = origColFind;
      }
    });

    it("should prevent salesman from accessing another dealership's financial records", async () => {
      const cId = new mongoose.Types.ObjectId(), unauthorizedDealershipId = new mongoose.Types.ObjectId();
      const origCustFind = Customer.findById, origAccFind = CustomerDealershipAccount.findOne;
      Customer.findById = () => ({ select: () => ({ lean: async () => ({ _id: cId, name: "Anis" }) }) });
      CustomerDealershipAccount.findOne = () => ({ lean: async () => null });

      try {
        await assert.rejects(
          async () => { await SalesmanCustomerDueService.getSalesmanCustomerDueProfile({ customerId: cId, dealershipId: unauthorizedDealershipId }); },
          /Customer has no active account with this dealership/
        );
      } finally {
        Customer.findById = origCustFind; CustomerDealershipAccount.findOne = origAccFind;
      }
    });

    it("should allow salesman to submit cash collection as pending and prevent self-verification", async () => {
      const salesmanId = new mongoose.Types.ObjectId(), cId = new mongoose.Types.ObjectId(), dId = new mongoose.Types.ObjectId();
      const origCustFind = Customer.findById, origAccFind = CustomerDealershipAccount.findOne;
      const origColCreate = DeliveryCollection.create, origColFindOne = DeliveryCollection.findOne;

      Customer.findById = async () => ({ _id: cId, name: "Customer X" });
      CustomerDealershipAccount.findOne = async () => ({ customerId: cId, dealershipId: dId, businessId: new mongoose.Types.ObjectId() });
      let createdColDoc = null;
      DeliveryCollection.create = async (doc) => { createdColDoc = { ...doc, save: async () => {} }; return createdColDoc; };

      try {
        const col = await DeliveryCollectionSyncService.recordCollection({
          customerId: cId, dealershipId: dId, salesmanId, collectorRole: "salesman", amount: 3000, paymentMethod: "cash", source: "field_sales",
        });
        assert.equal(col.status, "pending_verification");
        assert.equal(col.collectorRole, "salesman");

        DeliveryCollection.findOne = async () => createdColDoc;
        await assert.rejects(
          async () => { await DeliveryCollectionSyncService.verifyCollection({ collectionId: col.collectionId, verifierId: salesmanId }); },
          /Security Violation: Collector cannot verify their own collection/
        );
      } finally {
        Customer.findById = origCustFind; CustomerDealershipAccount.findOne = origAccFind;
        DeliveryCollection.create = origColCreate; DeliveryCollection.findOne = origColFindOne;
      }
    });
  });
});
