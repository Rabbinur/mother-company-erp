import React from "react";
import { IntegrationsManager } from "@/components/integrations/IntegrationsManager";
import { Cpu } from "lucide-react";

export const metadata = {
  title: "External Integrations | Mother Company ERP",
  description:
    "Manage SMS, WhatsApp Business, Payment Gateway, OCR, and Notification Integrations",
};

export default function IntegrationsPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
              External Integrations Hub
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Enterprise connectivity layer for SMS alerts, WhatsApp Business,
            secure payment gateway webhooks, and OCR challan processing.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <IntegrationsManager />
    </div>
  );
}
