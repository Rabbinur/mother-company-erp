"use client";

import React from "react";
import { ShieldAlert, Check, X, AlertCircle } from "lucide-react";

interface RulesConfigListProps {
  rules: any[];
  onToggleRule: (ruleKey: string, enabled: boolean) => Promise<void>;
  loadingRuleKey?: string | null;
}

export function RulesConfigList({ rules, onToggleRule, loadingRuleKey }: RulesConfigListProps) {
  const categories = ["INVENTORY", "CUSTOMER", "SUPPLIER", "SALES", "FINANCIAL", "OPERATIONAL"];

  return (
    <div className="space-y-6">
      {categories.map((cat) => {
        const catRules = rules.filter((r) => r.category === cat);
        if (catRules.length === 0) return null;

        return (
          <div key={cat} className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">{cat} Automation Rules</h3>
            <div className="divide-y divide-slate-100">
              {catRules.map((rule) => (
                <div key={rule.ruleKey} className="py-3 flex items-start justify-between gap-4 first:pt-0 last:pb-0">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">{rule.name}</span>
                      <span className="text-[10px] font-mono text-slate-400">({rule.ruleKey})</span>
                      {!rule.isConfigured ? (
                        <span className="rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5 text-[9px] font-bold text-rose-700 flex items-center gap-1">
                          <AlertCircle className="h-2.5 w-2.5" />
                          NOT_CONFIGURED
                        </span>
                      ) : (
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                          {rule.severity}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{rule.description}</p>
                    {!rule.isConfigured && rule.unconfiguredReason && (
                      <p className="text-[11px] text-rose-600 italic">Notice: {rule.unconfiguredReason}</p>
                    )}
                  </div>

                  {/* Toggle */}
                  <div className="shrink-0">
                    <button
                      disabled={!rule.isConfigured || loadingRuleKey === rule.ruleKey}
                      onClick={() => onToggleRule(rule.ruleKey, !rule.enabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-40 ${
                        rule.enabled && rule.isConfigured ? "bg-primary" : "bg-slate-200"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          rule.enabled && rule.isConfigured ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
