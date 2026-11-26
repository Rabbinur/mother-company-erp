"use client";

import React from "react";
import { AlertTriangle, AlertCircle, Info, Lightbulb, CheckCircle2 } from "lucide-react";
import type { OperationalRecommendation } from "@/services/analytics/operational/types";

interface Props {
  recommendations: OperationalRecommendation[];
}

export function BottlenecksRecommendationsSection({ recommendations }: Props) {
  if (recommendations.length === 0) {
    return (
      <div className="p-6 rounded-xl border border-border bg-emerald-50/30 dark:bg-emerald-950/20 text-center space-y-1">
        <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
        <h4 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
          Optimal Operations Detected
        </h4>
        <p className="text-xs text-emerald-700 dark:text-emerald-300">
          No active delivery, warehouse, or cost anomalies detected across verified operational records.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-foreground">
          Operational Bottlenecks & Recommendations ({recommendations.length})
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {recommendations.map((rec) => {
          const isCrit = rec.type === "critical";
          const isWarn = rec.type === "warning";
          const borderClass = isCrit
            ? "border-rose-200 bg-rose-50/30 dark:border-rose-900/50 dark:bg-rose-950/20"
            : isWarn
            ? "border-amber-200 bg-amber-50/30 dark:border-amber-900/50 dark:bg-amber-950/20"
            : "border-blue-200 bg-blue-50/30 dark:border-blue-900/50 dark:bg-blue-950/20";

          const iconClass = isCrit
            ? "text-rose-600"
            : isWarn
            ? "text-amber-600"
            : "text-blue-600";

          const Icon = isCrit ? AlertCircle : isWarn ? AlertTriangle : Info;

          return (
            <div key={rec.id} className={`p-4 rounded-xl border ${borderClass} space-y-2`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 shrink-0 ${iconClass}`} />
                  <span className="text-xs font-semibold text-foreground">{rec.issue}</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider bg-background/80 text-muted-foreground border border-border">
                  {rec.domain}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Evidence:</span> {rec.supportingMetric}
              </div>
              <div className="text-xs text-primary font-medium bg-background/60 p-2 rounded-lg border border-border/60">
                Action: {rec.suggestedAction}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
