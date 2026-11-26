"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Bell, AlertTriangle, Play, Settings, Activity, RefreshCw, ShieldAlert } from "lucide-react";
import { AlertsList, RulesConfigList, ExecutionHistory, SchedulerControlCard } from "@/components/automation";

export default function AutomationDashboardPage() {
  const [activeTab, setActiveTab] = useState<"alerts" | "rules" | "history">("alerts");
  const [loading, setLoading] = useState<boolean>(true);
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const [loadingRuleKey, setLoadingRuleKey] = useState<string | null>(null);

  const [events, setEvents] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [executions, setExecutions] = useState<any[]>([]);
  const [dealershipId] = useState<string>("all");
  const [schedulerSetting, setSchedulerSetting] = useState<{
    enabled: boolean;
    canToggle: boolean;
    lastToggledAt?: string | null;
    toggledByEmail?: string | null;
    lastExecution?: any;
    nextScheduledExecution?: string | null;
  }>({ enabled: true, canToggle: false });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const dParam = dealershipId !== "all" ? `&dealershipId=${dealershipId}` : "";
      const [eventsRes, rulesRes, execRes, schedRes] = await Promise.all([
        fetch(`/api/v1/automation/events?status=OPEN${dParam}`).then((r) => r.json()),
        fetch(`/api/v1/automation/rules?${dParam}`).then((r) => r.json()),
        fetch("/api/v1/automation/run").then((r) => r.json()),
        fetch("/api/v1/automation/scheduler").then((r) => r.json()),
      ]);

      if (eventsRes?.success) setEvents(eventsRes.data.events || []);
      if (rulesRes?.success) setRules(rulesRes.data || []);
      if (execRes?.success) setExecutions(execRes.data || []);
      if (schedRes?.success) setSchedulerSetting(schedRes.data);
    } catch {
      // Safe fallback
    } finally {
      setLoading(false);
    }
  }, [dealershipId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleEvaluateNow = async () => {
    setEvaluating(true);
    try {
      const res = await fetch("/api/v1/automation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealershipId: dealershipId !== "all" ? dealershipId : undefined }),
      });
      const data = await res.json();
      if (data?.success) await loadData();
    } finally {
      setEvaluating(false);
    }
  };

  const handleToggleScheduler = async (newEnabled: boolean) => {
    try {
      const res = await fetch("/api/v1/automation/scheduler", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newEnabled }),
      });
      const data = await res.json();
      if (data?.success) {
        setSchedulerSetting((prev) => ({ ...prev, enabled: newEnabled, lastToggledAt: new Date().toISOString() }));
        await loadData();
      }
    } catch {
      // Safe fallback
    }
  };

  const handleAction = async (eventId: string, action: "ACKNOWLEDGE" | "RESOLVE" | "DISMISS") => {
    setLoadingActionId(eventId);
    try {
      const res = await fetch(`/api/v1/automation/events/${eventId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data?.success) setEvents((prev) => prev.filter((e) => e._id !== eventId));
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleToggleRule = async (ruleKey: string, enabled: boolean) => {
    setLoadingRuleKey(ruleKey);
    try {
      const res = await fetch("/api/v1/automation/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleKey, enabled, dealershipId: dealershipId !== "all" ? dealershipId : undefined }),
      });
      const data = await res.json();
      if (data?.success) setRules((prev) => prev.map((r) => (r.ruleKey === ruleKey ? { ...r, enabled } : r)));
    } finally {
      setLoadingRuleKey(null);
    }
  };

  const criticalCount = events.filter((e) => e.severity === "CRITICAL").length;
  const activeRulesCount = rules.filter((r) => r.enabled && r.isConfigured).length;
  const lastExec = executions.length > 0 ? executions[0] : null;

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Smart Automation Engine</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">Rule-based operational monitoring, anomaly detection, and decision-support alerts.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadData} disabled={loading} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50 transition shadow-xs" title="Refresh Data">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-primary" : ""}`} />
          </button>
          <button onClick={handleEvaluateNow} disabled={evaluating} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-primary/95 transition disabled:opacity-50">
            <Play className={`h-3.5 w-3.5 ${evaluating ? "animate-spin" : ""}`} />
            {evaluating ? "Evaluating Rules..." : "Evaluate Rules Now"}
          </button>
        </div>
      </div>

      <SchedulerControlCard
        enabled={schedulerSetting.enabled}
        canToggle={schedulerSetting.canToggle}
        lastToggledAt={schedulerSetting.lastToggledAt}
        toggledByEmail={schedulerSetting.toggledByEmail}
        lastExecution={schedulerSetting.lastExecution || lastExec}
        nextScheduledExecution={schedulerSetting.nextScheduledExecution}
        onToggle={handleToggleScheduler}
        loading={loading}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs font-bold text-slate-400 block uppercase">Open Alerts</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">{events.length}</span>
          <span className="text-[11px] text-slate-500">Unresolved operational breaches</span>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50/30 p-4 shadow-xs">
          <span className="text-xs font-bold text-rose-600 block uppercase flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5" />
            Critical Severity
          </span>
          <span className="text-2xl font-black text-rose-700 mt-1 block">{criticalCount}</span>
          <span className="text-[11px] text-rose-500">Requires immediate attention</span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs font-bold text-slate-400 block uppercase">Active Rules</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">{activeRulesCount}</span>
          <span className="text-[11px] text-slate-500">Of {rules.length} monitored conditions</span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs font-bold text-slate-400 block uppercase">Last Execution</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">{lastExec ? lastExec.status : "Idle"}</span>
          <span className="text-[11px] text-slate-500">{lastExec ? `${lastExec.eventsGenerated} alerts detected` : "No runs recorded"}</span>
        </div>
      </div>

      <div className="flex border-b border-slate-200 text-xs font-bold">
        <button onClick={() => setActiveTab("alerts")} className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition ${activeTab === "alerts" ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
          <AlertTriangle className="h-4 w-4" /> Active Alerts ({events.length})
        </button>
        <button onClick={() => setActiveTab("rules")} className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition ${activeTab === "rules" ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
          <Settings className="h-4 w-4" /> Rule Catalog & Configuration ({rules.length})
        </button>
        <button onClick={() => setActiveTab("history")} className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition ${activeTab === "history" ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
          <Activity className="h-4 w-4" /> Execution Logs
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-400">Loading automation dashboard...</div>
      ) : (
        <div>
          {activeTab === "alerts" && <AlertsList events={events} onAction={handleAction} loadingActionId={loadingActionId} />}
          {activeTab === "rules" && <RulesConfigList rules={rules} onToggleRule={handleToggleRule} loadingRuleKey={loadingRuleKey} />}
          {activeTab === "history" && <ExecutionHistory executions={executions} />}
        </div>
      )}
    </div>
  );
}
