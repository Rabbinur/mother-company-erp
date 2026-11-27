import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";

import { SmsProviderService } from "@/services/integrations/SmsProviderService";
import { WhatsAppProviderService } from "@/services/integrations/WhatsAppProviderService";
import { PaymentGatewayService } from "@/services/integrations/PaymentGatewayService";
import { OcrIntegrationService } from "@/services/integrations/OcrIntegrationService";
import { ExternalNotificationDispatcher } from "@/services/integrations/ExternalNotificationDispatcher";
import { IntegrationManagerService } from "@/services/integrations/IntegrationManagerService";
import { Payment } from "@/models/Payment";
import { Notification } from "@/models/Notification";
import { IntegrationSetting } from "@/models/IntegrationSetting";

describe("Phase 4 Step 5: External Integrations Test Suite", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.SMS_API_KEY;
    delete process.env.SMS_SENDER_ID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;
    delete process.env.WHATSAPP_API_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.PAYMENT_GATEWAY_KEY;
    delete process.env.PAYMENT_GATEWAY_SECRET;
    delete process.env.OCR_API_KEY;
    delete process.env.GOOGLE_VISION_KEY;
  });

  describe("1. SMS Provider Service", () => {
    it("should normalize Bangladesh and international phone numbers", () => {
      assert.equal(SmsProviderService.normalizePhoneNumber("01712345678"), "+8801712345678");
      assert.equal(SmsProviderService.normalizePhoneNumber("8801812345678"), "+8801812345678");
      assert.equal(SmsProviderService.normalizePhoneNumber("+8801912345678"), "+8801912345678");
    });

    it("should render ERP notification templates accurately", () => {
      const orderMsg = SmsProviderService.renderTemplate("ORDER_CONFIRMATION", {
        orderNumber: "ORD-101",
        amount: 2500,
      });
      assert.match(orderMsg, /Order #ORD-101 confirmed/);
      assert.match(orderMsg, /BDT 2500/);

      const payMsg = SmsProviderService.renderTemplate("PAYMENT_RECEIPT", {
        paymentNumber: "RCT-202",
        amount: 1500,
        remainingBalance: 500,
      });
      assert.match(payMsg, /Payment received: BDT 1500/);
    });

    it("should return NOT_CONFIGURED when credentials are missing", async () => {
      const sms = SmsProviderService.getInstance();
      assert.equal(sms.isConfigured(), false);

      const res = await sms.send({
        recipient: "01712345678",
        message: "Test message",
      });
      assert.equal(res.success, false);
      assert.equal(res.status, "NOT_CONFIGURED");
    });

    it("should deduplicate sends with identical idempotencyKey", async () => {
      const sms = SmsProviderService.getInstance();
      const key = `test-key-${Date.now()}`;

      // First call (without credentials) marks key
      await sms.send({ recipient: "01712345678", message: "Hi", idempotencyKey: key });

      // Second call returns cached success
      const secondRes = await sms.send({
        recipient: "01712345678",
        message: "Hi duplicate",
        idempotencyKey: key,
      });
      assert.equal(secondRes.success, true);
      assert.equal(secondRes.status, "SENT");
      assert.equal(secondRes.messageId, `dedup-${key}`);
    });
  });

  describe("2. WhatsApp Business Messaging", () => {
    it("should return NOT_CONFIGURED when Meta Cloud credentials are missing", async () => {
      const wa = WhatsAppProviderService.getInstance();
      assert.equal(wa.isConfigured(), false);

      const res = await wa.sendTemplate({
        recipient: "+8801712345678",
        templateName: "order_dispatch",
      });
      assert.equal(res.success, false);
      assert.equal(res.status, "NOT_CONFIGURED");
    });

    it("should deduplicate WhatsApp dispatches with idempotency key", async () => {
      const wa = WhatsAppProviderService.getInstance();
      const key = `wa-key-${Date.now()}`;

      await wa.sendTemplate({
        recipient: "01712345678",
        templateName: "order_status",
        idempotencyKey: key,
      });

      const dupe = await wa.sendTemplate({
        recipient: "01712345678",
        templateName: "order_status",
        idempotencyKey: key,
      });
      assert.equal(dupe.success, true);
      assert.equal(dupe.messageId, `dedup-${key}`);
    });
  });

  describe("3. Payment Gateway Webhook & Timing-Safe Verification", () => {
    it("should perform timing-safe HMAC signature verification", () => {
      const secret = "secret_webhook_key_12345";
      const rawPayload = JSON.stringify({ transactionId: "TRX-789", amount: 5000 });
      const validSignature = crypto.createHmac("sha256", secret).update(rawPayload, "utf8").digest("hex");

      const pg = PaymentGatewayService.getInstance();

      // Valid signature
      assert.equal(pg.verifySignature(rawPayload, validSignature, secret), true);

      // Tampered payload
      const tampered = JSON.stringify({ transactionId: "TRX-789", amount: 999999 });
      assert.equal(pg.verifySignature(tampered, validSignature, secret), false);

      // Wrong signature
      assert.equal(pg.verifySignature(rawPayload, "invalidhexsignature12345", secret), false);

      // Missing signature
      assert.equal(pg.verifySignature(rawPayload, "", secret), false);
    });

    it("should reject duplicate callbacks idempotently without modifying ledger", async () => {
      const pg = PaymentGatewayService.getInstance();
      const mockTrxId = `TRX-DUP-${Date.now()}`;

      // Mock existing payment in DB
      const origFindOne = Payment.findOne;
      Payment.findOne = async () => ({
        _id: new mongoose.Types.ObjectId(),
        paymentNumber: "RCT-EXISTING-01",
        transactionReference: mockTrxId,
      });

      try {
        const result = await pg.processWebhook({
          gateway: "bkash",
          eventType: "payment.success",
          transactionId: mockTrxId,
          amount: 1500,
          currency: "BDT",
          status: "SUCCESS",
        });

        assert.equal(result.success, true);
        assert.equal(result.verified, true);
        assert.equal(result.isDuplicate, true);
        assert.equal(result.status, "IGNORED");
        assert.match(result.message, /already processed/);
      } finally {
        Payment.findOne = origFindOne;
      }
    });
  });

  describe("4. OCR Provider & Manual Fallback", () => {
    it("should return NOT_CONFIGURED and promote manual entry fallback when unconfigured", async () => {
      const ocr = OcrIntegrationService.getInstance();
      assert.equal(ocr.isConfigured(), false);

      const result = await ocr.extractFromFile(Buffer.from("dummy-invoice"), "application/pdf");
      assert.equal(result.isConfigured, false);
      assert.equal(result.status, "NOT_CONFIGURED");
      assert.match(result.errorMessage, /manual challan entry/);
      assert.equal(result.lineItems.length, 0);
    });
  });

  describe("5. External Notification Dispatcher Resilience", () => {
    it("should never throw even if external providers fail", async () => {
      const origCreate = Notification.create;
      let inAppCreated = false;
      Notification.create = async () => {
        inAppCreated = true;
        return {};
      };

      try {
        const res = await ExternalNotificationDispatcher.dispatch({
          title: "System Alert",
          message: "Database checkpoint finished",
          type: "system",
          recipientPhone: "01712345678",
          channels: ["in_app", "sms", "whatsapp"],
        });

        assert.equal(inAppCreated, true);
        assert.equal(res.inAppDelivered, true);
        // SMS & WhatsApp fail gracefully with NOT_CONFIGURED without throwing
        assert.equal(res.smsDelivered, false);
        assert.equal(res.whatsAppDelivered, false);
        assert.ok(res.errors.length > 0);
      } finally {
        Notification.create = origCreate;
      }
    });
  });

  describe("6. Integration Manager & Credential Masking", () => {
    it("should return 5 provider summaries with zero exposed secrets", async () => {
      process.env.PAYMENT_GATEWAY_SECRET = "super_confidential_secret_key";
      process.env.SMS_API_KEY = "confidential_sms_token";
      process.env.WHATSAPP_API_TOKEN = "confidential_meta_token";

      const origFind = IntegrationSetting.find;
      IntegrationSetting.find = async () => [];

      try {
        const dummyBusinessId = new mongoose.Types.ObjectId();
        const overview = await IntegrationManagerService.getProvidersOverview(dummyBusinessId);

        assert.equal(overview.length, 5);
        const types = overview.map((p) => p.type);
        assert.ok(types.includes("sms"));
        assert.ok(types.includes("whatsapp"));
        assert.ok(types.includes("payment_gateway"));
        assert.ok(types.includes("ocr"));
        assert.ok(types.includes("notification_hub"));

        // Verify zero secret leakage
        const stringified = JSON.stringify(overview);
        assert.equal(stringified.includes("super_confidential_secret_key"), false);
        assert.equal(stringified.includes("confidential_sms_token"), false);
        assert.equal(stringified.includes("confidential_meta_token"), false);
      } finally {
        IntegrationSetting.find = origFind;
      }
    });
  });
});
