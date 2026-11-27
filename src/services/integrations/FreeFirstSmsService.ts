import mongoose from "mongoose";
import { IntegrationSetting } from "@/models/IntegrationSetting";
import { SmsProviderService } from "./SmsProviderService";
import type { ISmsMessage, ISmsSendResult } from "./types";

export class FreeFirstSmsService {
  /**
   * Free-First SMS Dispatch Policy:
   * 1. If genuinely free SMS quota/provider is enabled, route through it.
   * 2. If only paid provider exists, NEVER silently use paid SMS without Business Owner approval.
   * 3. Failures never disrupt ERP business operations.
   */
  static async send(
    msg: ISmsMessage,
    businessId?: string | mongoose.Types.ObjectId
  ): Promise<ISmsSendResult & { tierUsed: "FREE" | "PAID_APPROVED" | "BLOCKED_UNAPPROVED" }> {
    const isFreeEnabled = process.env.FREE_SMS_ENABLED === "true";
    const smsService = SmsProviderService.getInstance();

    if (!smsService.isConfigured()) {
      return {
        success: false,
        recipient: msg.recipient,
        status: "NOT_CONFIGURED",
        error: "SMS credentials not configured on server",
        tierUsed: "BLOCKED_UNAPPROVED",
      };
    }

    // 1. If genuine free quota is active, dispatch safely
    if (isFreeEnabled) {
      const res = await smsService.send(msg);
      return { ...res, tierUsed: "FREE" };
    }

    // 2. Paid Provider Check: Requires explicit Business Owner approval in IntegrationSetting
    let paidApproved = false;
    if (businessId) {
      try {
        const setting = await IntegrationSetting.findOne({
          businessId: new mongoose.Types.ObjectId(String(businessId)),
          providerType: "sms",
        });
        if (setting && setting.enabled && setting.metadata?.paidTierApproved === true) {
          paidApproved = true;
        }
      } catch {
        paidApproved = false;
      }
    }

    if (!paidApproved) {
      return {
        success: false,
        recipient: msg.recipient,
        status: "FAILED",
        error: "Paid SMS tier requires explicit Business Owner approval in Settings before sending.",
        tierUsed: "BLOCKED_UNAPPROVED",
      };
    }

    // 3. Paid tier explicitly authorized by Owner
    const res = await smsService.send(msg);
    return { ...res, tierUsed: "PAID_APPROVED" };
  }
}
