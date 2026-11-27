import mongoose from "mongoose";
import { IntegrationSetting } from "@/models/IntegrationSetting";
import { SmsProviderService } from "./SmsProviderService";
import { WhatsAppProviderService } from "./WhatsAppProviderService";
import { PaymentGatewayService } from "./PaymentGatewayService";
import { OcrIntegrationService } from "./OcrIntegrationService";
import type {
  IIntegrationProviderSummary,
  IntegrationProviderType,
  IntegrationStatus,
} from "./types";

export class IntegrationManagerService {
  /**
   * Return comprehensive overview of all 5 integration providers.
   * ZERO CREDENTIAL EXPOSURE: Strips all API keys, tokens, and secrets.
   */
  static async getProvidersOverview(
    businessId: string | mongoose.Types.ObjectId
  ): Promise<IIntegrationProviderSummary[]> {
    const bId = new mongoose.Types.ObjectId(String(businessId));
    let persistedSettings: any[] = [];
    try {
      persistedSettings = await IntegrationSetting.find({ businessId: bId });
    } catch {
      persistedSettings = [];
    }
    const settingMap = new Map<string, any>();
    persistedSettings.forEach((s) => settingMap.set(s.providerType, s));

    const smsProvider = SmsProviderService.getInstance();
    const waProvider = WhatsAppProviderService.getInstance();
    const paymentProvider = PaymentGatewayService.getInstance();
    const ocrProvider = OcrIntegrationService.getInstance();

    const providers: Array<{
      type: IntegrationProviderType;
      name: string;
      label: string;
      description: string;
      isConfigured: boolean;
      safeMeta: Record<string, unknown>;
    }> = [
      {
        type: "sms",
        name: smsProvider.name,
        label: "SMS Gateway",
        description:
          "Transactional SMS alerts for customer orders, dispatches, and balance reminders.",
        isConfigured: smsProvider.isConfigured(),
        safeMeta: {
          senderId: process.env.SMS_SENDER_ID || "Not configured",
          apiEndpoint: process.env.SMS_API_URL ? "Configured" : "Default",
        },
      },
      {
        type: "whatsapp",
        name: waProvider.name,
        label: "WhatsApp Business API",
        description:
          "Meta Cloud API integration for interactive dispatch tracking and invoices.",
        isConfigured: waProvider.isConfigured(),
        safeMeta: {
          phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "Not configured",
        },
      },
      {
        type: "payment_gateway",
        name: paymentProvider.name,
        label: "Payment Gateway",
        description:
          "Secure webhook-verified payment settlements (bKash / Bank / SSLCommerz).",
        isConfigured: paymentProvider.isConfigured(),
        safeMeta: {
          webhookUrl: "/api/v1/integrations/payment/webhook",
          signatureAlgorithm: "HMAC-SHA256 (timing-safe)",
        },
      },
      {
        type: "ocr",
        name: ocrProvider.name,
        label: "Invoice & Challan OCR",
        description:
          "Automated challan scanning with advisory staging and manual entry fallback.",
        isConfigured: ocrProvider.isConfigured(),
        safeMeta: {
          endpoint: process.env.OCR_ENDPOINT ? "Custom" : "Cloud Vision",
          guarantee: "Non-destructive; no auto-verification of inventory",
        },
      },
      {
        type: "notification_hub",
        name: "external_notification_dispatcher",
        label: "External Notifications Hub",
        description:
          "Multi-channel dispatcher bridging internal ERP alerts to SMS and WhatsApp.",
        isConfigured: smsProvider.isConfigured() || waProvider.isConfigured(),
        safeMeta: {
          channels: ["in_app", "sms", "whatsapp"],
          faultTolerance: "Non-blocking safe delivery",
        },
      },
    ];

    return providers.map((p) => {
      const setting = settingMap.get(p.type);
      const isEnabled = setting ? Boolean(setting.enabled) : p.isConfigured;

      let status: IntegrationStatus = "NOT_CONFIGURED";
      if (!p.isConfigured) {
        status = "NOT_CONFIGURED";
      } else if (!isEnabled) {
        status = "DISABLED";
      } else if (setting?.lastError) {
        status = "ERROR";
      } else {
        status = "CONFIGURED";
      }

      return {
        type: p.type,
        name: p.name,
        label: p.label,
        description: p.description,
        status,
        isConfigured: p.isConfigured,
        isEnabled,
        lastActivityAt: setting?.lastActivityAt?.toISOString(),
        lastError: setting?.lastError,
        safeMetadata: p.safeMeta,
      };
    });
  }

  /**
   * Toggle enabled/disabled state for an integration provider
   */
  static async toggleProvider(params: {
    businessId: string | mongoose.Types.ObjectId;
    providerType: IntegrationProviderType;
    enabled: boolean;
    actorId?: string | mongoose.Types.ObjectId;
    actorEmail?: string;
  }): Promise<any> {
    const bId = new mongoose.Types.ObjectId(String(params.businessId));
    const actId = params.actorId
      ? new mongoose.Types.ObjectId(String(params.actorId))
      : undefined;

    const setting = await IntegrationSetting.findOneAndUpdate(
      { businessId: bId, providerType: params.providerType },
      {
        $set: {
          enabled: params.enabled,
          status: params.enabled ? "CONFIGURED" : "DISABLED",
          updatedBy: actId,
          updatedByEmail: params.actorEmail,
          lastActivityAt: new Date(),
        },
        $setOnInsert: {
          businessId: bId,
          providerType: params.providerType,
          providerName: params.providerType,
        },
      },
      { upsert: true, new: true }
    );

    return setting;
  }
}
