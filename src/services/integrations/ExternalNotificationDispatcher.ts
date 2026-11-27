import mongoose from "mongoose";
import { Notification } from "@/models/Notification";
import { IntegrationSetting } from "@/models/IntegrationSetting";
import { SmsProviderService } from "./SmsProviderService";
import { WhatsAppProviderService } from "./WhatsAppProviderService";
import type {
  INotificationPayload,
  INotificationDeliveryResult,
} from "./types";

export class ExternalNotificationDispatcher {
  /**
   * Resilient, non-blocking notification dispatch across configured channels.
   * Core ERP operations must NEVER fail if external SMS or WhatsApp fails.
   */
  static async dispatch(
    payload: INotificationPayload
  ): Promise<INotificationDeliveryResult> {
    const result: INotificationDeliveryResult = {
      inAppDelivered: false,
      smsDelivered: false,
      whatsAppDelivered: false,
      errors: [],
    };

    const requestedChannels = payload.channels || ["in_app"];

    // 1. In-App Notification (Internal DB record)
    if (requestedChannels.includes("in_app")) {
      try {
        const notifType = payload.type || "system";
        await Notification.create({
          title: payload.title,
          message: payload.message,
          type: notifType,
          targetRole: payload.targetRole,
          targetUserId: payload.targetUserId
            ? new mongoose.Types.ObjectId(String(payload.targetUserId))
            : undefined,
          link: payload.link,
          isRead: false,
        });
        result.inAppDelivered = true;
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : "In-app notification creation failed";
        result.errors.push(`In-App Error: ${msg}`);
      }
    }

    // 2. Fetch business enablement for SMS and WhatsApp
    let smsEnabled = true;
    let whatsAppEnabled = true;

    if (payload.businessId) {
      try {
        const bId = new mongoose.Types.ObjectId(String(payload.businessId));
        const settings = await IntegrationSetting.find({
          businessId: bId,
          providerType: { $in: ["sms", "whatsapp"] },
        });

        for (const s of settings) {
          if (s.providerType === "sms" && !s.enabled) smsEnabled = false;
          if (s.providerType === "whatsapp" && !s.enabled)
            whatsAppEnabled = false;
        }
      } catch {
        // Safe catch: defaults to provider credential check
      }
    }

    // 3. External Channels in parallel without blocking parent flow
    const externalPromises: Promise<void>[] = [];

    // SMS Dispatch
    if (requestedChannels.includes("sms") && smsEnabled && payload.recipientPhone) {
      externalPromises.push(
        (async () => {
          try {
            const smsService = SmsProviderService.getInstance();
            const res = await smsService.send({
              recipient: payload.recipientPhone!,
              message: `${payload.title}: ${payload.message}`,
              idempotencyKey: `notif-${Date.now()}-${Math.random()}`,
            });
            if (res.success) {
              result.smsDelivered = true;
            } else {
              result.errors.push(`SMS: ${res.error || res.status}`);
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "SMS dispatch error";
            result.errors.push(`SMS Exception: ${msg}`);
          }
        })()
      );
    }

    // WhatsApp Dispatch
    if (
      requestedChannels.includes("whatsapp") &&
      whatsAppEnabled &&
      payload.recipientPhone
    ) {
      externalPromises.push(
        (async () => {
          try {
            const waService = WhatsAppProviderService.getInstance();
            const res = await waService.sendTemplate({
              recipient: payload.recipientPhone!,
              templateName: "general_notification",
              parameters: [payload.title, payload.message],
              idempotencyKey: `wa-notif-${Date.now()}-${Math.random()}`,
            });
            if (res.success) {
              result.whatsAppDelivered = true;
            } else {
              result.errors.push(`WhatsApp: ${res.error || res.status}`);
            }
          } catch (err: unknown) {
            const msg =
              err instanceof Error ? err.message : "WhatsApp dispatch error";
            result.errors.push(`WhatsApp Exception: ${msg}`);
          }
        })()
      );
    }

    // Await all external dispatches safely with Promise.allSettled
    if (externalPromises.length > 0) {
      await Promise.allSettled(externalPromises);
    }

    return result;
  }
}
