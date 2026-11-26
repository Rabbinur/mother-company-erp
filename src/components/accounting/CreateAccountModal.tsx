"use client";

import React, { useState } from "react";
import { X, BookOpen } from "lucide-react";

interface CreateAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (accountData: {
    code: string;
    name: string;
    category: string;
    subType: string;
    normalBalance: string;
    description: string;
  }) => Promise<void>;
  isLoading?: boolean;
}

export function CreateAccountModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: CreateAccountModalProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("ASSET");
  const [subType, setSubType] = useState("current_asset");
  const [normalBalance, setNormalBalance] = useState("DEBIT");
  const [description, setDescription] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await onSubmit({
        code,
        name,
        category,
        subType,
        normalBalance,
        description,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create account");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-xl space-y-4 p-5">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-emerald-600" />
            <h3 className="font-bold text-foreground text-sm">Add Chart of Accounts Account</h3>
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

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-medium text-foreground block mb-1">Account Code</label>
              <input
                type="text"
                required
                placeholder="e.g. 1030"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-1.5 font-mono text-foreground"
              />
            </div>
            <div>
              <label className="font-medium text-foreground block mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-foreground"
              >
                <option value="ASSET">ASSET</option>
                <option value="LIABILITY">LIABILITY</option>
                <option value="EQUITY">EQUITY</option>
                <option value="REVENUE">REVENUE</option>
                <option value="EXPENSE">EXPENSE</option>
                <option value="CONTRA_REVENUE">CONTRA_REVENUE</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-medium text-foreground block mb-1">Account Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Petty Cash Dhaka Warehouse"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-medium text-foreground block mb-1">Normal Balance</label>
              <select
                value={normalBalance}
                onChange={(e) => setNormalBalance(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-foreground"
              >
                <option value="DEBIT">DEBIT</option>
                <option value="CREDIT">CREDIT</option>
              </select>
            </div>
            <div>
              <label className="font-medium text-foreground block mb-1">Sub-Type</label>
              <input
                type="text"
                value={subType}
                onChange={(e) => setSubType(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-foreground font-mono"
              />
            </div>
          </div>

          <div>
            <label className="font-medium text-foreground block mb-1">Description (Optional)</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Purpose or scope of this ledger account"
              className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-foreground"
            />
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
              disabled={isLoading}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {isLoading ? "Saving..." : "Save Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
