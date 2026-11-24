"use client";

import React from "react";
import { ShieldAlert } from "lucide-react";

interface LegalEntityGateBannerProps {
  legalName?: string;
}

export function LegalEntityGateBanner({ legalName }: LegalEntityGateBannerProps) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-5 dark:border-amber-900/40 dark:bg-amber-950/20">
      <div className="flex items-start gap-4">
        <ShieldAlert className="h-6 w-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Legal Entity Name Governance Status
          </h3>
          {legalName ? (
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
              Official Registered Legal Name:{" "}
              <span className="font-semibold text-slate-900 dark:text-white">
                {legalName}
              </span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
              <span className="font-semibold">PENDING OWNER DECISION (Gate 1).</span> The official
              legal entity name remains unset until provided by the platform owner. All corporate
              documents and financial exports will display the trade name until Gate 1 sign-off is
              authorized.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
