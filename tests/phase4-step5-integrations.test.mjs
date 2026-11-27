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
import { RateLimit } from "@/models/RateLimit";

describe("Phase 4 Step 5: External Integrations Test Suite", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    [
      "SMS_API_KEY", "SMS_SENDER_ID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER",
      "WHATSAPP_API_TOKEN", "WHATSAPP_PHONE_NUMBER_ID",
      "PAYMENT_GATEWAY_KEY", "PAYMENT_GATEWAY_SECRET",
      "OCR_API_KEY", "GOOGLE_VISION_KEY",
    ].forEach((k) => delete process.env[k]);

    // Avoid unbuffered Mongoose 10s timeout during isolated unit test runs
    RateLimit.create = async () => ({});
    RateLimit.deleteOne = async () => ({});
  });

  describe("1. SMS Provider Service", () => {
    it("should normalize Bangladesh and international phone numbers", () => {
      assert.equal(SmsProviderService.normalizePhoneNumber("01712345678"), "+8801712345678");
      assert.equal(SmsProviderService.normalizePhoneNumber("8801812345678"), "+8801812345678");
      assert.equal(SmsProviderService.normalizePhoneNumber("+8801912345678"), "+8801912345678");
    });

    it("should render ERP notification templates accurately", () => {
      const orderMsg = SmsProviderService.renderTemplate("ORDER_CONFIRMATION", { orderNumber: "ORD-101", amount: 2500 });
      assert.match(orderMsg, /Order #ORD-101 confirmed/);
      assert.match(orderMsg, /BDT 2500/);

      const payMsg = SmsProviderService.renderTemplate("PAYMENT_RECEIPT", { paymentNumber: "RCT-202", amount: 1500 });
      assert.match(payMsg, /Payment received: BDT 1500/);
    });

    it("should return NOT_CONFIGURED when credentials are missing", async () => {
      const sms = SmsProviderService.getInstance();
      assert.equal(sms.isConfigured(), false);
      const res = await sms.send({ recipient: "01712345678", message: "Test" });
      assert.equal(res.success, false);
      assert.equal(res.status, "NOT_CONFIGURED");
    });

    it("should deduplicate sends with identical idempotencyKey", async () => {
      const sms = SmsProviderService.getInstance();
      const key = `test-key-${Date.now()}`;
      await sms.send({ recipient: "01712345678", message: "Hi", idempotencyKey: key });
      const dupe = await sms.send({ recipient: "01712345678", message: "Hi duplicate", idempotencyKey: key });
      assert.equal(dupe.success, true);
      assert.equal(dupe.status, "SENT");
      assert.equal(dupe.messageId, `dedup-${key}`);
    });
  });

  describe("2. WhatsApp Business Messaging", () => {
    it("should return NOT_CONFIGURED when Meta Cloud credentials are missing", async () => {
      const wa = WhatsAppProviderService.getInstance();
      assert.equal(wa.isConfigured(), false);
      const res = await wa.sendTemplate({ recipient: "+8801712345678", templateName: "order_dispatch" });
      assert.equal(res.success, false);
      assert.equal(res.status, "NOT_CONFIGURED");
    });

    it("should deduplicate WhatsApp dispatches with idempotency key", async () => {
      const wa = WhatsAppProviderService.getInstance();
      const key = `wa-key-${Date.now()}`;
      await wa.sendTemplate({ recipient: "01712345678", templateName: "order_status", idempotencyKey: key });
      const dupe = await wa.sendTemplate({ recipient: "01712345678", templateName: "order_status", idempotencyKey: key });
      assert.equal(dupe.success, true);
      assert.equal(dupe.messageId, `dedup-${key}`);
    });
  });

  describe("3. Payment Gateway Webhook & Timing-Safe Verification", () => {
    it("should perform timing-safe HMAC signature verification", () => {
      const secret = "secret_webhook_key_12345";
      const rawPayload = JSON.stringify({ transactionId: "TRX-789", amount: 5000 });
      const validSig = crypto.createHmac("sha256", secret).update(rawPayload, "utf8").digest("hex");
      const pg = PaymentGatewayService.getInstance();

      assert.equal(pg.verifySignature(rawPayload, validSig, secret), true);
      assert.equal(pg.verifySignature(JSON.stringify({ transactionId: "TRX-789", amount: 99 }), validSig, secret), false);
      assert.equal(pg.verifySignature(rawPayload, "invalidhexsignature12345", secret), false);
      assert.equal(pg.verifySignature(rawPayload, "", secret), false);
    });

    it("should reject duplicate callbacks idempotently without modifying ledger", async () => {
      const pg = PaymentGatewayService.getInstance();
      const mockTrxId = `TRX-DUP-${Date.now()}`;

      const origFindOne = Payment.findOne;
      Payment.findOne = async () => ({ _id: new mongoose.Types.ObjectId(), paymentNumber: "RCT-01", transactionReference: mockTrxId });

      try {
        const result = await pg.processWebhook({
          gateway: "bkash", eventType: "payment.success", transactionId: mockTrxId, amount: 1500, currency: "BDT", status: "SUCCESS",
        });
        assert.equal(result.success, true);
        assert.equal(result.isDuplicate, true);
        assert.equal(result.status, "IGNORED");
      } finally {
        Payment.findOne = origFindOne;
      }
    });

    it("should prevent concurrent webhook duplicate settlement via atomic database lock", async () => {
      const pg = PaymentGatewayService.getInstance();
      const origRateLimitCreate = RateLimit.create;

      RateLimit.create = async () => {
        const err = new Error("E11000 duplicate key error");
        err.code = 11000;
        throw err;
      };

      try {
        const res = await pg.processWebhook({
          gateway: "bkash", eventType: "payment.success", transactionId: "TRX-CONCURRENT", amount: 2500, currency: "BDT", status: "SUCCESS",
        });
        assert.equal(res.success, true);
        assert.equal(res.isDuplicate, true);
        assert.equal(res.status, "IGNORED");
      } finally {
        RateLimit.create = origRateLimitCreate;
      }
    });

    it("should reject non-BDT currency and invalid amount before settlement", async () => {
      const pg = PaymentGatewayService.getInstance();
      const origFind = Payment.findOne;
      Payment.findOne = async () => null;

      try {
        const currRes = await pg.processWebhook({
          gateway: "sslcommerz", eventType: "payment.success", transactionId: "TRX-USD", amount: 100, currency: "USD", status: "SUCCESS",
        });
        assert.equal(currRes.success, false);
        assert.match(currRes.message, /Unsupported currency/);

        const amtRes = await pg.processWebhook({
          gateway: "sslcommerz", eventType: "payment.success", transactionId: "TRX-NEG", amount: -50, currency: "BDT", status: "SUCCESS",
        });
        assert.equal(amtRes.success, false);
        assert.match(amtRes.message, /Invalid payment amount/);
      } finally {
        Payment.findOne = origFind;
      }
    });
  });

  describe("4. OCR Provider & Manual Fallback", () => {
    it("should return NOT_CONFIGURED and promote manual entry fallback when unconfigured", async () => {
      const ocr = OcrIntegrationService.getInstance();
      assert.equal(ocr.isConfigured(), false);
      const result = await ocr.extractFromFile(Buffer.from("dummy"), "application/pdf");
      assert.equal(result.isConfigured, false);
      assert.equal(result.status, "NOT_CONFIGURED");
      assert.match(result.errorMessage, /manual challan entry/);
    });
  });

  describe("5. External Notification Dispatcher Resilience", () => {
    it("should never throw even if external providers fail", async () => {
      const origCreate = Notification.create;
      let inAppCreated = false;
      Notification.create = async () => { inAppCreated = true; return {}; };

      try {
        const res = await ExternalNotificationDispatcher.dispatch({
          title: "System Alert", message: "Checkpoint ok", recipientPhone: "01712345678", channels: ["in_app", "sms", "whatsapp"],
        });
        assert.equal(inAppCreated, true);
        assert.equal(res.inAppDelivered, true);
        assert.equal(res.smsDelivered, false);
        assert.equal(res.whatsAppDelivered, false);
        assert.ok(res.errors.length > 0);
      } finally {
        Notification.create = origCreate;
      }
    });
  });

  describe("6. Provider Status & Credential Masking", () => {
    it("should distinguish configured from live verified and mask credentials", async () => {
      process.env.PAYMENT_GATEWAY_SECRET = "super_confidential_secret_key";
      process.env.PAYMENT_GATEWAY_KEY = "pg_key_123";
      process.env.SMS_API_KEY = "confidential_sms_token";
      process.env.SMS_SENDER_ID = "MC_ERP";
      process.env.WHATSAPP_API_TOKEN = "confidential_meta_token";
      process.env.WHATSAPP_PHONE_NUMBER_ID = "123456789";

      const origFind = IntegrationSetting.find;
      IntegrationSetting.find = async () => [];

      try {
        const dummyBusinessId = new mongoose.Types.ObjectId();
        const overview = await IntegrationManagerService.getProvidersOverview(dummyBusinessId);

        assert.equal(overview.length, 5);
        const sms = overview.find((p) => p.type === "sms");
        assert.equal(sms?.status, "CONFIGURED");
        assert.equal(sms?.connectionState, "UNTESTED");

        const ocr = overview.find((p) => p.type === "ocr");
        assert.equal(ocr?.status, "NOT_CONFIGURED");
        assert.equal(ocr?.connectionState, "NOT_CONFIGURED");

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
