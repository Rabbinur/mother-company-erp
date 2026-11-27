import crypto from "crypto";
import mongoose from "mongoose";
import { Payment } from "@/models/Payment";
import { Order } from "@/models/Order";
import { Account } from "@/models/Account";
import { Customer } from "@/models/Customer";
import { RateLimit } from "@/models/RateLimit";
import { PaymentService } from "@/services/PaymentService";
import type {
  IPaymentGatewayProvider,
  IPaymentWebhookPayload,
  IPaymentWebhookResult,
} from "./types";

export class PaymentGatewayService implements IPaymentGatewayProvider {
  readonly name = "payment_gateway";
  private static instance: PaymentGatewayService;

  static getInstance(): PaymentGatewayService {
    if (!PaymentGatewayService.instance) {
      PaymentGatewayService.instance = new PaymentGatewayService();
    }
    return PaymentGatewayService.instance;
  }

  isConfigured(): boolean {
    const key = process.env.PAYMENT_GATEWAY_KEY;
    const secret = process.env.PAYMENT_GATEWAY_SECRET;
    return Boolean(key && key.trim() !== "" && secret && secret.trim() !== "");
  }

  /**
   * Timing-safe verification of webhook HMAC signature
   */
  verifySignature(
    rawBody: string,
    signature: string,
    secretOverride?: string
  ): boolean {
    const secret = secretOverride || process.env.PAYMENT_GATEWAY_SECRET;
    if (!secret || !signature) return false;

    try {
      const computedHex = crypto
        .createHmac("sha256", secret)
        .update(rawBody, "utf8")
        .digest("hex");

      const signatureBuf = Buffer.from(signature.trim().toLowerCase(), "hex");
      const computedBuf = Buffer.from(computedHex.toLowerCase(), "hex");

      if (signatureBuf.length !== computedBuf.length) {
        return false;
      }

      return crypto.timingSafeEqual(signatureBuf, computedBuf);
    } catch {
      return false;
    }
  }

  parseWebhook(
    rawBody: string,
    headers: Record<string, string>
  ): IPaymentWebhookPayload {
    const parsed = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
    const signature =
      headers["x-signature"] ||
      headers["x-webhook-signature"] ||
      parsed.signature ||
      "";

    return {
      gateway: parsed.gateway || "generic",
      eventType: parsed.eventType || parsed.event || "payment.success",
      transactionId:
        parsed.transactionId || parsed.trxId || parsed.paymentID || "",
      referenceNumber: parsed.referenceNumber || parsed.orderNumber,
      orderId: parsed.orderId,
      customerId: parsed.customerId,
      dealershipId: parsed.dealershipId,
      accountId: parsed.accountId,
      amount: Number(parsed.amount || 0),
      currency: parsed.currency || "BDT",
      status:
        String(parsed.status).toUpperCase() === "SUCCESS" ||
        String(parsed.status).toUpperCase() === "COMPLETED"
          ? "SUCCESS"
          : "FAILED",
      signature,
      timestamp: parsed.timestamp || Date.now(),
      rawPayload: parsed,
    };
  }

  async processWebhook(
    payload: IPaymentWebhookPayload,
    businessId?: string
  ): Promise<IPaymentWebhookResult> {
    if (!payload.transactionId) {
      return {
        success: false,
        verified: false,
        isDuplicate: false,
        status: "FAILED",
        message: "Missing transaction identifier in webhook payload",
      };
    }

    // 1. Atomic Database Idempotency Lock (prevents concurrent race conditions across instances)
    const lockKey = `payment_webhook_lock:${payload.transactionId}`;
    let lockAcquired = false;
    try {
      await RateLimit.create({
        key: lockKey,
        windowId: 0,
        hits: 1,
        expireAt: new Date(Date.now() + 10 * 60 * 1000), // 10-minute lock window
      });
      lockAcquired = true;
    } catch (err: any) {
      if (err?.code === 11000) {
        return {
          success: true,
          verified: true,
          isDuplicate: true,
          status: "IGNORED",
          message: "Transaction already processed or currently being processed",
        };
      }
    }

    const releaseLock = async () => {
      if (lockAcquired) {
        await RateLimit.deleteOne({ key: lockKey, windowId: 0 }).catch(() => {});
      }
    };

    // 2. Double-check persisted Payment collection
    const existingPayment = await Payment.findOne({
      $or: [
        { transactionReference: payload.transactionId },
        { idempotencyKey: `webhook-${payload.transactionId}` },
      ],
    });

    if (existingPayment) {
      return {
        success: true,
        verified: true,
        isDuplicate: true,
        paymentId: String(existingPayment._id),
        paymentNumber: existingPayment.paymentNumber,
        status: "IGNORED",
        message: "Transaction already processed and settled in ledger",
      };
    }

    if (payload.status !== "SUCCESS") {
      return {
        success: true,
        verified: true,
        isDuplicate: false,
        status: "IGNORED",
        message: `Ignoring non-success payment state: ${payload.status}`,
      };
    }

    const amount = Number(payload.amount);
    if (!amount || amount <= 0 || !Number.isFinite(amount)) {
      await releaseLock();
      return { success: false, verified: true, isDuplicate: false, status: "FAILED", message: "Invalid payment amount" };
    }

    if (payload.currency && payload.currency.trim().toUpperCase() !== "BDT") {
      await releaseLock();
      return { success: false, verified: true, isDuplicate: false, status: "FAILED", message: "Unsupported currency. Only BDT is supported." };
    }

    // 3. Resolve & validate Order, Customer & Dealership ownership
    let targetCustomerId = payload.customerId;
    let targetDealershipId = payload.dealershipId;
    let matchedOrder: any = null;

    if (payload.orderId || payload.referenceNumber) {
      matchedOrder = payload.orderId
        ? await Order.findById(payload.orderId)
        : await Order.findOne({ orderNumber: payload.referenceNumber });

      if (matchedOrder) {
        if (matchedOrder.orderStatus === "cancelled") {
          await releaseLock();
          return { success: false, verified: true, isDuplicate: false, status: "FAILED", message: "Cannot apply payment to cancelled order" };
        }

        if (matchedOrder.paymentStatus === "paid" && (matchedOrder.receivableAmount || 0) <= 0) {
          return { success: true, verified: true, isDuplicate: true, status: "IGNORED", message: "Order is already fully paid" };
        }

        if (payload.dealershipId && String(matchedOrder.dealershipId) !== String(payload.dealershipId)) {
          await releaseLock();
          return { success: false, verified: true, isDuplicate: false, status: "FAILED", message: "Dealership ownership mismatch" };
        }

        if (businessId && matchedOrder.businessId && String(matchedOrder.businessId) !== String(businessId)) {
          await releaseLock();
          return { success: false, verified: true, isDuplicate: false, status: "FAILED", message: "Business context mismatch" };
        }

        targetCustomerId = targetCustomerId || String(matchedOrder.customerId);
        targetDealershipId = targetDealershipId || String(matchedOrder.dealershipId);
      }
    }

    if (!targetCustomerId) {
      await releaseLock();
      return { success: false, verified: true, isDuplicate: false, status: "FAILED", message: "Unable to map webhook transaction to any existing customer" };
    }

    const customer = await Customer.findById(targetCustomerId);
    if (!customer) {
      await releaseLock();
      return { success: false, verified: true, isDuplicate: false, status: "FAILED", message: "Customer account not found" };
    }

    // 4. Locate receiving Asset Account
    let account = payload.accountId ? await Account.findById(payload.accountId) : null;
    if (!account) {
      account = await Account.findOne({ type: "asset", subType: { $in: ["bank", "cash"] }, isActive: true });
    }

    if (!account) {
      await releaseLock();
      return { success: false, verified: true, isDuplicate: false, status: "FAILED", message: "No receiving asset account configured for payment settlement" };
    }

    // 5. Atomic Double-Entry Settlement
    try {
      const payment = await PaymentService.recordCustomerPayment({
        customerId: targetCustomerId,
        dealershipId: targetDealershipId,
        accountId: account._id as mongoose.Types.ObjectId,
        amount,
        paymentMethod: payload.gateway.toLowerCase().includes("bkash") ? "bkash" : "bank_transfer",
        transactionReference: payload.transactionId,
        idempotencyKey: `webhook-${payload.transactionId}`,
        notes: `Settled via ${payload.gateway.toUpperCase()} Webhook`,
        allocations: matchedOrder
          ? [{ orderId: matchedOrder._id, amount: Math.min(amount, matchedOrder.receivableAmount || amount) }]
          : undefined,
      });

      return {
        success: true,
        verified: true,
        isDuplicate: false,
        paymentId: String(payment._id),
        paymentNumber: payment.paymentNumber,
        status: "PROCESSED",
        message: `Payment ${payment.paymentNumber} recorded and journal posted`,
      };
    } catch (settleErr: any) {
      await releaseLock();
      return {
        success: false,
        verified: true,
        isDuplicate: false,
        status: "FAILED",
        message: `Payment settlement failed: ${settleErr?.message || "Unknown error"}`,
      };
    }
  }
}
