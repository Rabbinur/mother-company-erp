import type {
  ISmsProvider,
  ISmsMessage,
  ISmsSendResult,
} from "./types";

export class SmsProviderService implements ISmsProvider {
  readonly name = "sms_gateway";
  private static instance: SmsProviderService;
  private static processedKeys = new Set<string>();

  static getInstance(): SmsProviderService {
    if (!SmsProviderService.instance) {
      SmsProviderService.instance = new SmsProviderService();
    }
    return SmsProviderService.instance;
  }

  isConfigured(): boolean {
    const apiKey = process.env.SMS_API_KEY || process.env.TWILIO_AUTH_TOKEN;
    const senderId =
      process.env.SMS_SENDER_ID || process.env.TWILIO_PHONE_NUMBER;
    return Boolean(apiKey && apiKey.trim() !== "" && senderId);
  }

  static normalizePhoneNumber(phone: string): string {
    const cleaned = phone.replace(/[^0-9+]/g, "");
    if (cleaned.startsWith("+")) return cleaned;
    if (cleaned.startsWith("880")) return `+${cleaned}`;
    if (cleaned.startsWith("01")) return `+88${cleaned}`;
    return cleaned;
  }

  static renderTemplate(
    templateId: string,
    params: Record<string, string | number> = {}
  ): string {
    switch (templateId) {
      case "ORDER_CONFIRMATION":
        return `Order #${params.orderNumber || ""} confirmed. Total: BDT ${params.amount || 0}. Thank you!`;
      case "DELIVERY_DISPATCH":
        return `Delivery #${params.dispatchCode || ""} dispatched with driver ${params.driverName || "assigned"}. Contact: ${params.driverPhone || "N/A"}.`;
      case "PAYMENT_RECEIPT":
        return `Payment received: BDT ${params.amount || 0} (Ref: ${params.paymentNumber || ""}). Remaining balance: BDT ${params.remainingBalance || 0}.`;
      case "LOW_STOCK_ALERT":
        return `ERP Alert: Item ${params.productName || ""} reached low stock (${params.currentStock || 0} left).`;
      default:
        return params.message
          ? String(params.message)
          : `ERP Notification: ${templateId}`;
    }
  }

  async send(msg: ISmsMessage): Promise<ISmsSendResult> {
    const normalizedRecipient = SmsProviderService.normalizePhoneNumber(
      msg.recipient
    );

    if (!normalizedRecipient || normalizedRecipient.length < 8) {
      return {
        success: false,
        recipient: msg.recipient,
        status: "FAILED",
        error: "Invalid recipient phone number",
      };
    }

    if (msg.idempotencyKey) {
      if (SmsProviderService.processedKeys.has(msg.idempotencyKey)) {
        return {
          success: true,
          recipient: normalizedRecipient,
          messageId: `dedup-${msg.idempotencyKey}`,
          status: "SENT",
        };
      }
      SmsProviderService.processedKeys.add(msg.idempotencyKey);
    }

    if (!this.isConfigured()) {
      return {
        success: false,
        recipient: normalizedRecipient,
        status: "NOT_CONFIGURED",
        error:
          "SMS Gateway credentials (SMS_API_KEY/SMS_SENDER_ID) not configured.",
      };
    }

    try {
      const endpoint =
        process.env.SMS_API_URL || "https://api.sms-provider.com/v1/send";
      const messageBody = msg.templateId
        ? SmsProviderService.renderTemplate(msg.templateId, msg.templateParams)
        : msg.message;

      // When configured in production/live, execute HTTP call
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SMS_API_KEY}`,
        },
        body: JSON.stringify({
          sender: process.env.SMS_SENDER_ID,
          recipient: normalizedRecipient,
          text: messageBody,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "HTTP Error");
        return {
          success: false,
          recipient: normalizedRecipient,
          status: "FAILED",
          error: `SMS provider responded with status ${res.status}: ${errorText.slice(0, 100)}`,
        };
      }

      const data = await res.json().catch(() => ({}));
      return {
        success: true,
        recipient: normalizedRecipient,
        messageId: data.messageId || `sms-${Date.now()}`,
        status: "SENT",
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unknown SMS dispatch error";
      return {
        success: false,
        recipient: normalizedRecipient,
        status: "FAILED",
        error: message,
      };
    }
  }
}
