import { RateLimit } from "@/models/RateLimit";
import mongoose from "mongoose";

export interface IEmailMessage {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  alertType?:
    | "product_low_stock"
    | "product_out_of_stock"
    | "sales_target_behind"
    | "sales_target_achieved"
    | "sales_target_exceeded"
    | "pending_delivery_reconciliation"
    | "general";
  idempotencyKey?: string;
}

export interface IEmailSendResult {
  success: boolean;
  messageId?: string;
  status: "SENT" | "PENDING" | "FAILED" | "NOT_CONFIGURED";
  error?: string;
  recipients: string[];
}

export class EmailProviderService {
  private static instance: EmailProviderService;
  private static processedKeys = new Set<string>();

  static getInstance(): EmailProviderService {
    if (!EmailProviderService.instance) {
      EmailProviderService.instance = new EmailProviderService();
    }
    return EmailProviderService.instance;
  }

  isConfigured(): boolean {
    const resendKey = process.env.RESEND_API_KEY;
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    return Boolean(
      (resendKey && resendKey.trim() !== "") ||
        (smtpHost && smtpHost.trim() !== "" && smtpUser)
    );
  }

  async sendEmail(msg: IEmailMessage): Promise<IEmailSendResult> {
    const recipients = Array.isArray(msg.to) ? msg.to : [msg.to];
    const validRecipients = recipients.filter((r) => typeof r === "string" && r.includes("@"));

    if (validRecipients.length === 0) {
      return {
        success: false,
        recipients,
        status: "FAILED",
        error: "No valid recipient email addresses provided",
      };
    }

    // Two-tier Idempotency: Memory (L1 fast-check) + MongoDB RateLimit (L2 durable across Vercel instances)
    if (msg.idempotencyKey) {
      if (EmailProviderService.processedKeys.has(msg.idempotencyKey)) {
        return {
          success: true,
          recipients: validRecipients,
          messageId: `dedup-${msg.idempotencyKey}`,
          status: "SENT",
        };
      }
      EmailProviderService.processedKeys.add(msg.idempotencyKey);

      if (mongoose.connection.readyState === 1) {
        try {
          await RateLimit.create({
            key: `idemp:email:${msg.idempotencyKey}`,
            windowId: 0,
            hits: 1,
            expireAt: new Date(Date.now() + 86400000), // 24h
          });
        } catch (err: any) {
          if (err?.code === 11000) {
            return {
              success: true,
              recipients: validRecipients,
              messageId: `dedup-${msg.idempotencyKey}`,
              status: "SENT",
            };
          }
        }
      }
    }

    if (!this.isConfigured()) {
      return {
        success: false,
        recipients: validRecipients,
        status: "NOT_CONFIGURED",
        error: "Email provider credentials (RESEND_API_KEY / SMTP_*) not configured on server",
      };
    }

    // In unit test or sandbox environments without live external network, do not send real emails
    if (process.env.NODE_ENV === "test") {
      return {
        success: true,
        recipients: validRecipients,
        messageId: `test-email-${Date.now()}`,
        status: "SENT",
      };
    }

    try {
      const fromEmail = process.env.SMTP_FROM || "notifications@mother-company-erp.com";
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: validRecipients,
          subject: msg.subject,
          html: msg.html || `<p>${msg.text || msg.subject}</p>`,
          text: msg.text || msg.subject,
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "HTTP Error");
        return {
          success: false,
          recipients: validRecipients,
          status: "FAILED",
          error: `Email provider error (${res.status}): ${errText.slice(0, 100)}`,
        };
      }

      const resData = await res.json().catch(() => ({}));
      return {
        success: true,
        recipients: validRecipients,
        messageId: resData.id || `email-${Date.now()}`,
        status: "SENT",
      };
    } catch (err: unknown) {
      const isTimeout = err instanceof Error && err.name === "TimeoutError";
      const message = isTimeout
        ? "Email provider request timed out after 5000ms"
        : err instanceof Error
        ? err.message
        : "Email dispatch failed";
      return {
        success: false,
        recipients: validRecipients,
        status: "FAILED",
        error: message,
      };
    }
  }
}
