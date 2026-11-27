"use client";

import React, { useState, useEffect } from "react";
import {
  MessageSquare,
  Phone,
  CreditCard,
  ScanText,
  Bell,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Power,
  Send,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import type { IIntegrationProviderSummary } from "@/services/integrations/types";

const PROVIDER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  sms: MessageSquare,
  whatsapp: Phone,
  payment_gateway: CreditCard,
  ocr: ScanText,
  notification_hub: Bell,
};

export function IntegrationsManager() {
  const [providers, setProviders] = useState<IIntegrationProviderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [testModalProvider, setTestModalProvider] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testFeedback, setTestFeedback] = useState<string | null>(null);

  const fetchProviders = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/integrations/status");
      const data = await res.json();
      if (res.ok && data.success) {
        setProviders(data.data.providers || []);
        setCanManage(Boolean(data.data.canManage));
      }
    } catch {
      // safe fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleToggle = async (provider: IIntegrationProviderSummary) => {
    if (!canManage) return;
    const nextState = !provider.isEnabled;
    const confirmMsg = nextState
      ? `Enable ${provider.label}? Outbound external calls will be activated.`
      : `Disable ${provider.label}? System will fall back to internal ERP handling.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setToggling(provider.type);
      const res = await fetch("/api/v1/integrations/status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerType: provider.type,
          enabled: nextState,
        }),
      });
      if (res.ok) {
        await fetchProviders();
      }
    } finally {
      setToggling(null);
    }
  };

  const handleSendTest = async () => {
    if (!testPhone || !testModalProvider) return;
    try {
      setTestSending(true);
      setTestFeedback(null);
      const res = await fetch("/api/v1/integrations/test-dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: testModalProvider === "whatsapp" ? "whatsapp" : "sms",
          recipientPhone: testPhone,
          title: "ERP Live Integration Test",
          message: "External integration channel test verified successfully.",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestFeedback("Test dispatch sent successfully!");
        setTimeout(() => {
          setTestModalProvider(null);
          setTestFeedback(null);
        }, 1800);
      } else {
        setTestFeedback(`Test failed: ${data.message || "Unknown error"}`);
      }
    } catch {
      setTestFeedback("Network error sending test dispatch");
    } finally {
      setTestSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Security Banner */}
      <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/80 p-4 text-xs text-slate-300">
        <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-400" />
        <p>
          Credentials (API keys, secrets, access tokens) are managed securely in
          server environment variables. The browser interface displays status
          indicators and operational toggles with strictly zero secret exposure.
        </p>
      </div>

      {/* Provider Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {providers.map((p) => {
          const Icon = PROVIDER_ICONS[p.type] || Bell;
          const isTogglingThis = toggling === p.type;

          return (
            <div
              key={p.type}
              className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-slate-200">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-medium text-slate-100">{p.label}</h3>
                      <p className="text-xs text-slate-400">{p.description}</p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                      p.status === "CONFIGURED"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : p.status === "DISABLED"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : p.status === "ERROR"
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        : "bg-slate-800 text-slate-400 border border-slate-700"
                    }`}
                  >
                    {p.status === "CONFIGURED" && <CheckCircle2 className="h-3 w-3" />}
                    {p.status === "DISABLED" && <Power className="h-3 w-3" />}
                    {p.status === "ERROR" && <XCircle className="h-3 w-3" />}
                    {p.status === "NOT_CONFIGURED" && <AlertTriangle className="h-3 w-3" />}
                    {p.status}
                  </span>
                </div>

                {/* Metadata details */}
                <div className="mt-4 rounded-lg bg-slate-950/40 p-3 text-xs text-slate-400">
                  {Object.entries(p.safeMetadata).map(([k, v]) => (
                    <div key={k} className="flex justify-between py-0.5">
                      <span className="capitalize">{k.replace(/([A-Z])/g, " $1")}:</span>
                      <span className="font-mono text-slate-300">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Controls */}
              <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3">
                <div className="flex items-center gap-2">
                  {(p.type === "sms" || p.type === "whatsapp") && (
                    <button
                      type="button"
                      disabled={!p.isConfigured}
                      onClick={() => setTestModalProvider(p.type)}
                      className="inline-flex items-center gap-1 rounded bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-40"
                    >
                      <Send className="h-3 w-3" /> Test
                    </button>
                  )}
                </div>

                {canManage && (
                  <button
                    type="button"
                    disabled={isTogglingThis || !p.isConfigured}
                    onClick={() => handleToggle(p)}
                    className={`inline-flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition ${
                      p.isEnabled
                        ? "bg-rose-950/60 text-rose-300 hover:bg-rose-900 border border-rose-800"
                        : "bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900 border border-emerald-800"
                    } disabled:opacity-40`}
                  >
                    {isTogglingThis ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <Power className="h-3 w-3" />
                    )}
                    {p.isEnabled ? "Disable" : "Enable"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Test Modal */}
      {testModalProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
            <h4 className="font-semibold text-slate-100">
              Test {testModalProvider.toUpperCase()} Dispatch
            </h4>
            <p className="mt-1 text-xs text-slate-400">
              Send a test notification to verify delivery without affecting ERP data.
            </p>

            <input
              type="text"
              placeholder="+8801700000000"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              className="mt-3 w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100"
            />

            {testFeedback && (
              <p className="mt-2 text-xs text-emerald-400">{testFeedback}</p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTestModalProvider(null)}
                className="rounded bg-slate-800 px-3 py-1.5 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={testSending || !testPhone}
                onClick={handleSendTest}
                className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                {testSending ? "Sending..." : "Send Test"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
