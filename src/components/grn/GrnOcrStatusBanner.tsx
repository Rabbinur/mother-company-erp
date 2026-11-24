"use client";

import React from "react";
import { Sparkles, AlertCircle, CheckCircle2, Info, Loader2 } from "lucide-react";

interface GrnOcrStatusBannerProps {
  ocrStatus: "NOT_RUN" | "PROCESSING" | "COMPLETED" | "FAILED" | "NOT_CONFIGURED";
  confidence?: number;
  provider?: string;
  onTriggerOcr?: () => void;
  isProcessing?: boolean;
  hasDocument?: boolean;
}

export function GrnOcrStatusBanner({
  ocrStatus,
  confidence,
  provider,
  onTriggerOcr,
  isProcessing = false,
  hasDocument = false,
}: GrnOcrStatusBannerProps) {
  if (ocrStatus === "NOT_RUN" && !hasDocument) {
    return (
      <div className="rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 p-3 mb-6">
        <div className="flex items-start gap-2.5">
          <Info className="w-4 h-4 text-zinc-700 dark:text-zinc-300 mt-0.5 shrink-0" />
          <div className="text-xs text-zinc-700 dark:text-zinc-300">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              Manual Entry is the Primary Workflow.
            </span>{" "}
            You can create, review, and confirm GRNs manually without uploading files. Document upload and OCR extraction are optional convenience features.
          </div>
        </div>
      </div>
    );
  }

  if (ocrStatus === "NOT_CONFIGURED") {
    return (
      <div className="rounded border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-3 mb-6">
        <div className="flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="text-xs">
            <span className="font-medium text-amber-900 dark:text-amber-200">
              Live OCR is NOT_CONFIGURED.
            </span>{" "}
            <span className="text-amber-800 dark:text-amber-300">
              No cloud OCR provider credentials are configured. Manual entry and document attachment remain fully functional.
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (ocrStatus === "PROCESSING" || isProcessing) {
    return (
      <div className="rounded border border-purple-200 dark:border-purple-900/40 bg-purple-50/50 dark:bg-purple-950/20 p-3 mb-6">
        <div className="flex items-center gap-2.5">
          <Loader2 className="w-4 h-4 text-purple-600 dark:text-purple-400 animate-spin shrink-0" />
          <div className="text-xs text-purple-900 dark:text-purple-200 font-medium">
            Extracting text and tables from supplier challan document...
          </div>
        </div>
      </div>
    );
  }

  if (ocrStatus === "COMPLETED") {
    const confPercent = Math.round((confidence || 0) * 100);
    const isHigh = confPercent >= 85;

    return (
      <div className="rounded border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 p-3 mb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-medium text-emerald-900 dark:text-emerald-200">
                OCR Extraction Completed
              </div>
              <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
                Lines extracted via {provider || "OCR"}. Please verify extracted values against the physical delivery before confirmation.
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span
              className={`inline-flex items-center px-2 py-0.5 text-xs font-mono font-medium rounded ${
                isHigh
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
              }`}
            >
              {confPercent}% Confidence
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (ocrStatus === "FAILED") {
    return (
      <div className="rounded border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 p-3 mb-6">
        <div className="flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
          <div className="text-xs text-rose-900 dark:text-rose-200">
            <span className="font-medium">OCR Extraction Failed.</span>{" "}
            Unreadable scan or unsupported format. You can continue with manual entry.
          </div>
        </div>
      </div>
    );
  }

  // Not run yet but has document
  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 p-3 mb-6 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0" />
        <span className="text-xs text-zinc-700 dark:text-zinc-300">
          Challan attached. You can optionally scan it with OCR or enter quantities manually.
        </span>
      </div>
      {onTriggerOcr && (
        <button
          onClick={onTriggerOcr}
          disabled={isProcessing}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-colors"
        >
          <Sparkles className="w-3 h-3 text-purple-500" />
          Scan with OCR
        </button>
      )}
    </div>
  );
}
