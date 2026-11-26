"use client";

import React, { useState, useMemo } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { AccountRow } from "./types";

interface CreateJournalModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: AccountRow[];
  onSubmit: (journalData: {
    narration: string;
    sourceType: string;
    postingDate: string;
    lines: Array<{ accountId: string; debit: number; credit: number; memo: string }>;
  }) => Promise<void>;
  isLoading?: boolean;
}

export function CreateJournalModal({
  isOpen,
  onClose,
  accounts,
  onSubmit,
  isLoading = false,
}: CreateJournalModalProps) {
  const [postingDate, setPostingDate] = useState(new Date().toISOString().slice(0, 10));
  const [sourceType, setSourceType] = useState("manual_adjustment");
  const [narration, setNarration] = useState("");
  const [lines, setLines] = useState([
    { accountId: "", debit: 0, credit: 0, memo: "" },
    { accountId: "", debit: 0, credit: 0, memo: "" },
  ]);
  const [formError, setFormError] = useState<string | null>(null);

  const debitSum = useMemo(() => {
    return lines.reduce((acc, l) => acc + (Number(l.debit) || 0), 0);
  }, [lines]);

  const creditSum = useMemo(() => {
    return lines.reduce((acc, l) => acc + (Number(l.credit) || 0), 0);
  }, [lines]);

  const isBalanced = Math.abs(debitSum - creditSum) < 0.01 && debitSum > 0;

  if (!isOpen) return null;

  const handleAddLine = () => {
    setLines([...lines, { accountId: "", debit: 0, credit: 0, memo: "" }]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: string, value: any) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };
    setLines(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!isBalanced) {
      setFormError("Total Debits must equal Total Credits before posting.");
      return;
    }

    const unselected = lines.some((l) => !l.accountId);
    if (unselected) {
      setFormError("Please select an account for every journal line.");
      return;
    }

    try {
      await onSubmit({
        postingDate,
        sourceType,
        narration,
        lines,
      });
      onClose();
    } catch (err: any) {
      setFormError(err.message || "Failed to post journal entry");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-card border border-border shadow-xl space-y-4 max-h-[90vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div>
            <h3 className="font-bold text-foreground text-sm">Post General Ledger Journal</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Strict double-entry validation will be atomically enforced.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {formError && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-600 dark:text-rose-400">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-medium text-foreground block mb-1">Posting Date</label>
              <input
                type="date"
                required
                value={postingDate}
                onChange={(e) => setPostingDate(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-foreground"
              />
            </div>
            <div>
              <label className="font-medium text-foreground block mb-1">Source / Event Type</label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-foreground"
              >
                <option value="manual_adjustment">Manual Adjustment</option>
                <option value="expense">Expense Disbursement</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-medium text-foreground block mb-1">Narration / Memo</label>
            <input
              type="text"
              required
              placeholder="e.g. Month-end depreciation adjustment"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-foreground"
            />
          </div>

          {/* Dynamic Lines */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
                Double-Entry Lines (Min 2)
              </span>
              <button
                type="button"
                onClick={handleAddLine}
                className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Add Line
              </button>
            </div>

            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 items-center bg-muted/30 p-2 rounded-lg border border-border/20"
                >
                  <div className="col-span-5">
                    <select
                      required
                      value={line.accountId}
                      onChange={(e) => handleLineChange(idx, "accountId", e.target.value)}
                      className="w-full rounded border border-input bg-background px-2 py-1 text-xs font-mono text-foreground"
                    >
                      <option value="">Select Account</option>
                      {accounts.map((acc) => (
                        <option key={acc._id} value={acc._id}>
                          {acc.code} - {acc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Debit (৳)"
                      value={line.debit || ""}
                      onChange={(e) => handleLineChange(idx, "debit", parseFloat(e.target.value) || 0)}
                      className="w-full rounded border border-input bg-background px-2 py-1 font-mono text-right text-foreground"
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Credit (৳)"
                      value={line.credit || ""}
                      onChange={(e) => handleLineChange(idx, "credit", parseFloat(e.target.value) || 0)}
                      className="w-full rounded border border-input bg-background px-2 py-1 font-mono text-right text-foreground"
                    />
                  </div>
                  <div className="col-span-1 text-center">
                    {lines.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(idx)}
                        className="text-rose-500 hover:text-rose-700 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Balancing Verification Footer */}
            <div className="flex justify-between items-center p-3 rounded-lg bg-muted/40 font-mono text-xs border border-border/30">
              <span>
                Total Debits: <strong>৳{debitSum.toFixed(2)}</strong>
              </span>
              <span>
                Total Credits: <strong>৳{creditSum.toFixed(2)}</strong>
              </span>
              <span
                className={`font-bold ${
                  isBalanced
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {isBalanced ? "✓ Balanced" : "✕ Out of Balance"}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border/30">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-input px-3.5 py-1.5 font-medium text-foreground hover:bg-muted/50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isBalanced || isLoading}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {isLoading ? "Posting..." : "Post Journal Entry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
