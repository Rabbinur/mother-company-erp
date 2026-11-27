import type { IOcrProvider, OcrExtractionResult } from "@/lib/ocr/types";

export type IntegrationProviderType =
  | "sms"
  | "whatsapp"
  | "payment_gateway"
  | "ocr"
  | "notification_hub";

export type IntegrationStatus =
  | "CONFIGURED"
  | "NOT_CONFIGURED"
  | "DISABLED"
  | "ERROR";

export interface ISmsMessage {
  recipient: string; // E.164 or BD standard 017...
  message: string;
  templateId?: string;
  templateParams?: Record<string, string>;
  idempotencyKey?: string;
}

export interface ISmsSendResult {
  success: boolean;
  messageId?: string;
  status: "SENT" | "PENDING" | "FAILED" | "NOT_CONFIGURED";
  error?: string;
  recipient: string;
}

export interface ISmsProvider {
  readonly name: string;
  isConfigured(): boolean;
  send(msg: ISmsMessage): Promise<ISmsSendResult>;
}

export interface IWhatsAppMessage {
  recipient: string;
  templateName: string;
  languageCode?: string;
  parameters?: Array<string | number>;
  idempotencyKey?: string;
}

export interface IWhatsAppSendResult {
  success: boolean;
  messageId?: string;
  status: "SENT" | "PENDING" | "FAILED" | "NOT_CONFIGURED";
  error?: string;
  recipient: string;
}

export interface IWhatsAppProvider {
  readonly name: string;
  isConfigured(): boolean;
  sendTemplate(msg: IWhatsAppMessage): Promise<IWhatsAppSendResult>;
}

export interface IPaymentWebhookPayload {
  gateway: string; // e.g. "bkash", "sslcommerz", "generic"
  eventType: string; // e.g. "payment.success", "payment.failed"
  transactionId: string;
  referenceNumber?: string;
  orderId?: string;
  customerId?: string;
  dealershipId?: string;
  accountId?: string;
  amount: number;
  currency: string;
  status: "SUCCESS" | "FAILED" | "CANCELLED";
  signature?: string;
  timestamp?: string | number;
  rawPayload?: Record<string, unknown>;
}

export interface IPaymentWebhookResult {
  success: boolean;
  verified: boolean;
  isDuplicate: boolean;
  paymentId?: string;
  paymentNumber?: string;
  message: string;
  status:
    | "PROCESSED"
    | "IGNORED"
    | "INVALID_SIGNATURE"
    | "NOT_CONFIGURED"
    | "FAILED";
}

export interface IPaymentGatewayProvider {
  readonly name: string;
  isConfigured(): boolean;
  verifySignature(rawBody: string, signature: string, secret?: string): boolean;
  parseWebhook(
    rawBody: string,
    headers: Record<string, string>
  ): IPaymentWebhookPayload;
}

export type NotificationType =
  | "low_stock"
  | "out_of_stock"
  | "purchase_received"
  | "new_order"
  | "order_cancelled"
  | "payment_received"
  | "credit_limit_reached"
  | "system";

export interface INotificationPayload {
  businessId?: string;
  dealershipId?: string;
  title: string;
  message: string;
  type?: NotificationType;
  targetRole?: string;
  targetUserId?: string;
  recipientPhone?: string;
  link?: string;
  channels?: Array<"in_app" | "sms" | "whatsapp">;
}

export interface INotificationDeliveryResult {
  inAppDelivered: boolean;
  smsDelivered: boolean;
  whatsAppDelivered: boolean;
  errors: string[];
}

export type ProviderConnectionState =
  | "UNTESTED"
  | "VERIFIED"
  | "ERROR"
  | "NOT_CONFIGURED";

export interface IIntegrationProviderSummary {
  type: IntegrationProviderType;
  name: string;
  label: string;
  description: string;
  status: IntegrationStatus;
  connectionState: ProviderConnectionState;
  isConfigured: boolean;
  isEnabled: boolean;
  lastActivityAt?: string;
  lastError?: string;
  safeMetadata: Record<string, unknown>;
}

export type { IOcrProvider, OcrExtractionResult };
