import { RateLimit } from "@/models/RateLimit";
import type {
  IWhatsAppProvider,
  IWhatsAppMessage,
  IWhatsAppSendResult,
} from "./types";
import { SmsProviderService } from "./SmsProviderService";

export class WhatsAppProviderService implements IWhatsAppProvider {
  readonly name = "whatsapp_cloud_api";
  private static instance: WhatsAppProviderService;
  private static processedKeys = new Set<string>();

  static getInstance(): WhatsAppProviderService {
    if (!WhatsAppProviderService.instance) {
      WhatsAppProviderService.instance = new WhatsAppProviderService();
    }
    return WhatsAppProviderService.instance;
  }

  isConfigured(): boolean {
    const token = process.env.WHATSAPP_API_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    return Boolean(token && token.trim() !== "" && phoneId);
  }

  async sendTemplate(msg: IWhatsAppMessage): Promise<IWhatsAppSendResult> {
    const rawNormalized = SmsProviderService.normalizePhoneNumber(msg.recipient);
    // WhatsApp Cloud API recipient format requires digits only without leading '+'
    const recipientDigits = rawNormalized.replace(/^\+/, "");

    if (!recipientDigits || recipientDigits.length < 11) {
      return {
        success: false,
        recipient: msg.recipient,
        status: "FAILED",
        error: "Invalid recipient phone number for WhatsApp",
      };
    }

    // Two-tier Idempotency: Memory (L1 fast-check) + MongoDB RateLimit (L2 durable across Vercel instances)
    if (msg.idempotencyKey) {
      if (WhatsAppProviderService.processedKeys.has(msg.idempotencyKey)) {
        return {
          success: true,
          recipient: recipientDigits,
          messageId: `dedup-${msg.idempotencyKey}`,
          status: "SENT",
        };
      }
      WhatsAppProviderService.processedKeys.add(msg.idempotencyKey);

      try {
        await RateLimit.create({
          key: `idemp:wa:${msg.idempotencyKey}`,
          windowId: 0,
          hits: 1,
          expireAt: new Date(Date.now() + 86400000), // 24-hour durable window
        });
      } catch (err: any) {
        if (err?.code === 11000) {
          return {
            success: true,
            recipient: recipientDigits,
            messageId: `dedup-${msg.idempotencyKey}`,
            status: "SENT",
          };
        }
      }
    }

    if (!this.isConfigured()) {
      return {
        success: false,
        recipient: recipientDigits,
        status: "NOT_CONFIGURED",
        error:
          "WhatsApp Business credentials (WHATSAPP_API_TOKEN/WHATSAPP_PHONE_NUMBER_ID) not configured.",
      };
    }

    try {
      const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      const endpoint = `https://graph.facebook.com/v19.0/${phoneId}/messages`;

      const parametersPayload = (msg.parameters || []).map((p) => ({
        type: "text",
        text: String(p),
      }));

      const bodyPayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipientDigits,
        type: "template",
        template: {
          name: msg.templateName,
          language: {
            code: msg.languageCode || "en_US",
          },
          components:
            parametersPayload.length > 0
              ? [
                  {
                    type: "body",
                    parameters: parametersPayload,
                  },
                ]
              : [],
        },
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
        },
        body: JSON.stringify(bodyPayload),
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "HTTP Error");
        return {
          success: false,
          recipient: recipientDigits,
          status: "FAILED",
          error: `WhatsApp API error (${res.status}): ${errText.slice(0, 120)}`,
        };
      }

      const resJson = await res.json().catch(() => ({}));
      const messageId =
        resJson.messages?.[0]?.id || `wamid-${Date.now()}`;

      return {
        success: true,
        recipient: recipientDigits,
        messageId,
        status: "SENT",
      };
    } catch (err: unknown) {
      const isTimeout = err instanceof Error && err.name === "TimeoutError";
      const message = isTimeout
        ? "WhatsApp gateway request timed out after 5000ms"
        : err instanceof Error
        ? err.message
        : "WhatsApp dispatch error";
      return {
        success: false,
        recipient: recipientDigits,
        status: "FAILED",
        error: message,
      };
    }
  }
}
