"use client";

import React, { useState } from "react";
import { X, RotateCcw } from "lucide-react";
import { JournalEntryRow } from "./types";

interface ReverseJournalModalProps {
  journal: JournalEntryRow | null;
  onClose: () => void;
  onConfirm: (journalId: string, reason: string) => Promise<void>;
  isLoading?: boolean;
}

export function ReverseJournalModal({
  journal,
  onClose,
  onConfirm,
  isLoading = false,
}: ReverseJournalModalProps) {
  const [reason, setReason] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!journal) return null;

  const handleConfirm = async () => {
    setErrorMsg(null);
    try {
      await onConfirm(journal._id, reason || "Reversal adjustment");
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to reverse journal entry");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-xl space-y-4 p-5">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-rose-600" />
            <h3 className="font-bold text-foreground text-sm">Reverse Journal Entry</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-600 dark:text-rose-400">
            {errorMsg}
          </div>
        )}

        <div className="space-y-2 text-xs text-muted-foreground">
          <p>
            This action creates an exact inverse journal entry swapping all debits and credits, restores account balances, and marks original entry{" "}
            <strong className="text-foreground font-mono">
              {journal.journalNumber || journal.entryNumber}
            </strong>{" "}
            as <strong className="text-rose-600">VOIDED</strong>.
          </p>

          <div className="bg-muted/40 p-2.5 rounded-lg font-mono text-[11px] text-foreground">
            <div>Narration: {journal.narration || journal.description}</div>
            <div>Amount: ৳{Number(journal.debitsTotal || 0).toFixed(2)}</div>
          </div>
        </div>

        <div>
          <label className="font-medium text-foreground block mb-1 text-xs">
            Reason for Reversal
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Duplicate entry, invoiced in error"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-border/30 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-input px-3.5 py-1.5 font-medium text-foreground hover:bg-muted/50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            className="rounded-lg bg-rose-600 px-4 py-1.5 font-semibold text-white hover:bg-rose-700 transition disabled:opacity-50"
          >
            {isLoading ? "Reversing..." : "Confirm Reversal"}
          </button>
        </div>
      </div>
    </div>
  );
}
