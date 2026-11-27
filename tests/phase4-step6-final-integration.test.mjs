import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import { DeliveryCollectionSyncService } from "@/services/delivery/DeliveryCollectionSyncService";
import { CustomerProfileService } from "@/services/customer/CustomerProfileService";
import { FieldSalesService } from "@/services/FieldSalesService";
import { FreeFirstSmsService } from "@/services/integrations/FreeFirstSmsService";
import { SalesTargetAlertService } from "@/services/analytics/SalesTargetAlertService";
import { DeliveryCollection } from "@/models/DeliveryCollection";
import { Order } from "@/models/Order";
import { Customer } from "@/models/Customer";
import { CustomerDealershipAccount } from "@/models/CustomerDealershipAccount";
import { Payment } from "@/models/Payment";
import { SalesReturn } from "@/models/SalesReturn";
import { Dispatch } from "@/models/Dispatch";
import { Notification } from "@/models/Notification";
import { RateLimit } from "@/models/RateLimit";
import { IntegrationSetting } from "@/models/IntegrationSetting";
import { SalesTarget } from "@/models/SalesTarget";
import { InventoryBalance } from "@/models/InventoryBalance";

describe("Phase 4 Step 6: Final Business Workflow Integration Test Suite", () => {
  beforeEach(() => {
    RateLimit.create = async () => ({});
    RateLimit.deleteOne = async () => ({});
    Notification.create = async () => ({});
  });

  describe("1. Deliveryman Payment Collection & Cross-App Sync", () => {
    it("should record delivery collection with full/partial payments and link order", async () => {
      const mockOrderId = new mongoose.Types.ObjectId();
      const mockCustId = new mongoose.Types.ObjectId();
      const mockDManId = new mongoose.Types.ObjectId();
      const mockDealershipId = new mongoose.Types.ObjectId();

      const origOrderFind = Order.findById;
      const origCustFind = Customer.findById;
      const origColCreate = DeliveryCollection.create;

      Order.findById = async () => ({
        _id: mockOrderId,
        businessId: new mongoose.Types.ObjectId(),
        dealershipId: mockDealershipId,
        customerId: mockCustId,
      });

      Customer.findById = async () => ({
        _id: mockCustId,
        name: "Shopkeeper Rahman",
      });

      DeliveryCollection.create = async (doc) => ({
        ...doc,
        _id: new mongoose.Types.ObjectId(),
        save: async () => {},
      });

      try {
        const col = await DeliveryCollectionSyncService.recordCollection({
          orderId: mockOrderId,
          deliverymanId: mockDManId,
          amount: 2500,
          paymentMethod: "bkash",
          transactionReference: "TRX-BKASH-7788",
          source: "field_sales",
        });

        assert.equal(col.amount, 2500);
        assert.equal(col.paymentMethod, "bkash");
        assert.equal(col.status, "pending_verification");
        assert.equal(col.syncStatus, "SYNCED");
        assert.match(col.collectionId, /^COL-/);
      } finally {
        Order.findById = origOrderFind;
        Customer.findById = origCustFind;
        DeliveryCollection.create = origColCreate;
      }
    });

    it("should prevent deliveryman from self-approving their own deposit reconciliation", async () => {
      const deliverymanId = new mongoose.Types.ObjectId();

      await assert.rejects(
        async () => {
          await DeliveryCollectionSyncService.recordDeliverymanDeposit({
            deliverymanId,
            collectionIds: ["COL-1", "COL-2"],
            depositAmount: 5000,
            depositedToAccountId: new mongoose.Types.ObjectId(),
            reconciledByUserId: deliverymanId, // Self approval!
          });
        },
        /Security Violation: Deliveryman cannot approve their own deposit/
      );
    });

    it("should compute accurate deliveryman cash held and pending reconciliation", async () => {
      const mockDManId = new mongoose.Types.ObjectId();
      const origFind = DeliveryCollection.find;

      DeliveryCollection.find = () => ({
        sort: () => ({
          limit: async () => [
            { collectionId: "C1", amount: 3000, paymentMethod: "cash", status: "verified", syncStatus: "SYNCED", createdAt: new Date() },
            { collectionId: "C2", amount: 2000, paymentMethod: "cash", status: "deposited", syncStatus: "SYNCED", createdAt: new Date() },
            { collectionId: "C3", amount: 1500, paymentMethod: "bkash", status: "reconciled", syncStatus: "SYNCED", createdAt: new Date() },
          ],
        }),
      });

      try {
        const summary = await DeliveryCollectionSyncService.getDeliverymanFinancialSummary(mockDManId);
        assert.equal(summary.totalCollected, 6500);
        assert.equal(summary.totalDeposited, 3500);
        assert.equal(summary.currentCashHeld, 3000);
        assert.equal(summary.pendingReconciliation, 3000);
        assert.equal(summary.recentCollections.length, 3);
      } finally {
        DeliveryCollection.find = origFind;
      }
    });
  });

  describe("2. Complete Customer Profile & Dealership Ledger Isolation", () => {
    it("should isolate separate dealership ledgers and dues without combining them", async () => {
      const mockCustId = new mongoose.Types.ObjectId();
      const origCustFind = Customer.findById;
      const origAccFind = CustomerDealershipAccount.find;
      const origOrderFind = Order.find;
      const origColFind = DeliveryCollection.find;

      Customer.findById = () => ({
        lean: async () => ({
          _id: mockCustId,
          customerCode: "CUST-001",
          shopName: "Madina Store",
          phone: "01711223344",
          currentReceivable: 12000,
        }),
      });

      CustomerDealershipAccount.find = () => ({
        populate: () => ({
          populate: () => ({
            lean: async () => [
              { dealershipId: { _id: "D1", name: "Dhaka Central" }, creditLimit: 20000, currentBalance: 8000, totalInvoiced: 50000, totalCollected: 42000 },
              { dealershipId: { _id: "D2", name: "Chittagong North" }, creditLimit: 15000, currentBalance: 4000, totalInvoiced: 20000, totalCollected: 16000 },
            ],
          }),
        }),
      });

      const emptyFind = () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) });
      const origPaymentFind = Payment.find;
      const origReturnFind = SalesReturn.find;
      const origDispatchFind = Dispatch.find;

      Order.find = emptyFind;
      Payment.find = emptyFind;
      DeliveryCollection.find = emptyFind;
      SalesReturn.find = emptyFind;
      Dispatch.find = emptyFind;

      try {
        const profile = await CustomerProfileService.getCompleteProfile(mockCustId);
        assert.equal(profile.customer.shopName, "Madina Store");
        assert.equal(profile.dealershipAccounts.length, 2);
        // Verify strict isolation: D1 balance = 8000, D2 balance = 4000
        assert.equal(profile.dealershipAccounts[0].currentBalance, 8000);
        assert.equal(profile.dealershipAccounts[1].currentBalance, 4000);

        // Generate CSV export
        const exportRes = await CustomerProfileService.generateCsvExport(mockCustId, "overview");
        assert.match(exportRes.csvContent, /Dhaka Central/);
        assert.match(exportRes.csvContent, /Chittagong North/);
      } finally {
        Customer.findById = origCustFind;
        CustomerDealershipAccount.find = origAccFind;
        Order.find = origOrderFind;
        Payment.find = origPaymentFind;
        DeliveryCollection.find = origColFind;
        SalesReturn.find = origReturnFind;
        Dispatch.find = origDispatchFind;
      }
    });
  });

  describe("3. Field Sales Customer Sync & Deduplication", () => {
    it("should deduplicate existing customer by phone number", async () => {
      const origCustFind = Customer.findOne;
      const origAccFind = CustomerDealershipAccount.findOneAndUpdate;

      Customer.findOne = async () => ({
        _id: new mongoose.Types.ObjectId(),
        customerCode: "CUST-EXISTING",
        phone: "01819998877",
      });

      CustomerDealershipAccount.findOneAndUpdate = async () => ({});

      try {
        const syncResult = await FieldSalesService.syncCustomer({
          name: "Karim Mia",
          shopName: "Karim Variety",
          phone: "01819998877",
          dealershipId: new mongoose.Types.ObjectId(),
          businessId: new mongoose.Types.ObjectId(),
        });

        assert.equal(syncResult.isNew, false);
        assert.equal(syncResult.customerCode, "CUST-EXISTING");
      } finally {
        Customer.findOne = origCustFind;
        CustomerDealershipAccount.findOneAndUpdate = origAccFind;
      }
    });
  });

  describe("4. Free-First SMS Engine & Paid Tier Gating", () => {
    it("should block paid SMS when owner has not explicitly approved paid tier", async () => {
      process.env.FREE_SMS_ENABLED = "false";
      process.env.SMS_API_KEY = "paid_key";
      process.env.SMS_SENDER_ID = "MC_ERP";

      const origSettingFind = IntegrationSetting.findOne;
      IntegrationSetting.findOne = async () => ({
        enabled: true,
        metadata: { paidTierApproved: false },
      });

      try {
        const res = await FreeFirstSmsService.send(
          { recipient: "01700000000", message: "Hello" },
          new mongoose.Types.ObjectId()
        );

        assert.equal(res.success, false);
        assert.equal(res.tierUsed, "BLOCKED_UNAPPROVED");
        assert.match(res.error, /Business Owner approval/);
      } finally {
        IntegrationSetting.findOne = origSettingFind;
      }
    });
  });

  describe("5. Sales Targets & Alerts", () => {
    it("should evaluate sales targets, identify pacing and avoid duplicate alerts", async () => {
      const bId = new mongoose.Types.ObjectId();
      const origTargetFind = SalesTarget.find;
      const origOrderFind = Order.find;

      const mockTarget = {
        _id: new mongoose.Types.ObjectId(),
        title: "Q4 Target",
        scope: "business",
        targetAmount: 100000,
        achievedAmount: 0,
        startDate: new Date(Date.now() - 60 * 86400000), // 60 days ago
        endDate: new Date(Date.now() + 30 * 86400000),  // 30 days ahead (66% elapsed)
        alertHistory: [],
        save: async () => {},
      };

      SalesTarget.find = async () => [mockTarget];
      // Only 20k achieved (< 40% of target at 66% elapsed time => BEHIND_TARGET_PACING)
      Order.find = () => ({ select: () => ({ lean: async () => [{ grandTotal: 20000 }] }) });

      try {
        const results = await SalesTargetAlertService.evaluateSalesTargets(bId);
        assert.equal(results.length, 1);
        assert.equal(results[0].achievedAmount, 20000);
        assert.equal(results[0].achievementPercentage, 20);
        assert.equal(results[0].alertType, "BEHIND_TARGET_PACING");
        assert.equal(results[0].alertSent, true);

        // Second evaluation on same day should deduplicate and not re-send
        const secondResults = await SalesTargetAlertService.evaluateSalesTargets(bId);
        assert.equal(secondResults[0].alertSent, false);
      } finally {
        SalesTarget.find = origTargetFind;
        Order.find = origOrderFind;
      }
    });
  });
});
