import crypto from "crypto";
import mongoose from "mongoose";
import { Payment } from "@/models/Payment";
import { Order } from "@/models/Order";
import { Account } from "@/models/Account";
import { Customer } from "@/models/Customer";
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

    // Idempotency Protection: Check whether transaction already recorded
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

    if (payload.amount <= 0) {
      return {
        success: false,
        verified: true,
        isDuplicate: false,
        status: "FAILED",
        message: "Invalid transaction amount",
      };
    }

    // Resolve Customer & Dealership context
    let targetCustomerId = payload.customerId;
    let targetDealershipId = payload.dealershipId;
    let matchedOrder: any = null;

    if (payload.orderId) {
      matchedOrder = await Order.findById(payload.orderId);
      if (matchedOrder) {
        targetCustomerId = targetCustomerId || String(matchedOrder.customerId);
        targetDealershipId =
          targetDealershipId || String(matchedOrder.dealershipId);
      }
    } else if (payload.referenceNumber) {
      matchedOrder = await Order.findOne({
        orderNumber: payload.referenceNumber,
      });
      if (matchedOrder) {
        targetCustomerId = targetCustomerId || String(matchedOrder.customerId);
        targetDealershipId =
          targetDealershipId || String(matchedOrder.dealershipId);
      }
    }

    if (!targetCustomerId) {
      return {
        success: false,
        verified: true,
        isDuplicate: false,
        status: "FAILED",
        message: "Unable to map webhook transaction to any existing customer",
      };
    }

    // Locate receiving MFS/Bank Account
    let account = payload.accountId
      ? await Account.findById(payload.accountId)
      : null;

    if (!account) {
      // Find default active Cash or Bank/MFS account
      account = await Account.findOne({
        type: "asset",
        subType: { $in: ["bank", "cash"] },
        isActive: true,
      });
    }

    if (!account) {
      return {
        success: false,
        verified: true,
        isDuplicate: false,
        status: "FAILED",
        message: "No receiving asset account configured for payment settlement",
      };
    }

    // Settle Payment & post Double-Entry Journal Entry
    const payment = await PaymentService.recordCustomerPayment({
      customerId: targetCustomerId,
      dealershipId: targetDealershipId,
      accountId: account._id as mongoose.Types.ObjectId,
      amount: payload.amount,
      paymentMethod:
        payload.gateway.toLowerCase().includes("bkash")
          ? "bkash"
          : "bank_transfer",
      transactionReference: payload.transactionId,
      idempotencyKey: `webhook-${payload.transactionId}`,
      notes: `Settled via ${payload.gateway.toUpperCase()} Webhook`,
      allocations: matchedOrder
        ? [
            {
              orderId: matchedOrder._id,
              amount: Math.min(payload.amount, matchedOrder.receivableAmount || payload.amount),
            },
          ]
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
  }
}
