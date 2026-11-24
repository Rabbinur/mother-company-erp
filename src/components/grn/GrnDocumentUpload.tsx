"use client";

import React, { useState, useRef } from "react";
import { Upload, FileText, Image as ImageIcon, ExternalLink, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface GrnDocumentUploadProps {
  grnId?: string;
  document?: {
    originalName: string;
    mimeType: string;
    size: number;
    path: string;
    uploadedAt: string | Date;
  };
  onUploadSuccess?: () => void;
  disabled?: boolean;
}

export function GrnDocumentUpload({
  grnId,
  document,
  onUploadSuccess,
  disabled = false,
}: GrnDocumentUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !grnId) return;

    // Validate type
    const validMimes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!validMimes.includes(file.type)) {
      setError("Please select a PDF, PNG, JPG or WEBP document");
      return;
    }

    // Validate size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setError("File exceeds 10MB limit");
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/v1/grn/${grnId}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to upload file");
      }

      if (onUploadSuccess) onUploadSuccess();
    } catch (err: any) {
      setError(err.message || "Upload error");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const isPdf = document?.mimeType === "application/pdf";
  const formattedSize = document ? `${(document.size / 1024).toFixed(1)} KB` : "";

  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 mb-6">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-850 mb-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
            Challan Document Attachment (Optional)
          </h3>
          <p className="text-xs text-zinc-700 dark:text-zinc-300">
            Upload supplier physical delivery slip or invoice scan (PDF, PNG, JPG).
          </p>
        </div>
        {document && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-mono">
            <CheckCircle className="w-3.5 h-3.5" /> Attached
          </span>
        )}
      </div>

      {document ? (
        <div className="flex items-center justify-between p-3 rounded bg-zinc-50 dark:bg-zinc-850/60 border border-zinc-200/80 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400">
              {isPdf ? <FileText className="w-5 h-5 text-red-500" /> : <ImageIcon className="w-5 h-5 text-blue-500" />}
            </div>
            <div>
              <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100 max-w-[280px] sm:max-w-md truncate">
                {document.originalName}
              </div>
              <div className="text-xs font-mono text-zinc-700 dark:text-zinc-300">
                {formattedSize} • {new Date(document.uploadedAt).toLocaleDateString()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {grnId && (
              <a
                href={`/api/v1/grn/${grnId}/document`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" /> View
              </a>
            )}
            {!disabled && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-2.5 py-1 text-xs font-medium rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-colors disabled:opacity-50"
              >
                Replace
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          onClick={() => !disabled && fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center p-6 rounded border border-dashed transition-colors cursor-pointer ${
            disabled
              ? "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 opacity-60 cursor-not-allowed"
              : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-900/20"
          }`}
        >
          {isUploading ? (
            <div className="flex flex-center flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
              <span className="text-xs font-mono text-zinc-500">Uploading document...</span>
            </div>
          ) : (
            <>
              <Upload className="w-6 h-6 text-zinc-400 dark:text-zinc-500 mb-2" />
              <div className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                Click to attach challan scan or PDF
              </div>
              <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                Max 10MB • Multi-page PDF, PNG, JPG
              </div>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-1.5 mt-2 text-xs text-rose-600 dark:text-rose-400 font-mono">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || isUploading}
      />
    </div>
  );
}
