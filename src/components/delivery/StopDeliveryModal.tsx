"use client";

import React, { useState } from "react";
import { X, CheckCircle, AlertTriangle, XCircle, DollarSign, Package } from "lucide-react";

interface StopDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  stop: any;
  items: any[];
  dispatchId: string;
  onSuccess: (updatedDispatch: any) => void;
}

export function StopDeliveryModal({
  isOpen,
  onClose,
  stop,
  items,
  dispatchId,
  onSuccess,
}: StopDeliveryModalProps) {
  const [status, setStatus] = useState<"delivered" | "partially_delivered" | "failed" | "rejected">(
    "delivered"
  );
  const [cashCollected, setCashCollected] = useState<number>(0);
  const [failureReason, setFailureReason] = useState("");
  const [notes, setNotes] = useState("");
  const [deliveredItems, setDeliveredItems] = useState<any[]>(
    items.map((it) => ({
      variantId: it.variantId,
      name: it.name,
      loadedQuantity: it.loadedQuantity || it.orderQuantity,
      deliveredQuantity: it.loadedQuantity || it.orderQuantity,
      returnedQuantity: 0,
      damagedQuantity: 0,
      returnReason: "",
      condition: "good",
    }))
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !stop) return null;

  const handleItemChange = (index: number, field: string, val: any) => {
    setDeliveredItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/delivery/dispatches/${dispatchId}/deliveries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stops: [
            {
              orderId: stop.orderId,
              status,
              deliveredItems: deliveredItems.map((di) => ({
                variantId: di.variantId,
                deliveredQuantity: Number(di.deliveredQuantity || 0),
                returnedQuantity: Number(di.returnedQuantity || 0),
                damagedQuantity: Number(di.damagedQuantity || 0),
                returnReason: di.returnReason,
                condition: di.condition,
              })),
              cashCollected: Number(cashCollected || 0),
              failureReason: failureReason.trim() || undefined,
              notes: notes.trim() || undefined,
            },
          ],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to record stop delivery");

      onSuccess(data.data);
      onClose();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-base font-semibold text-foreground">Record Retailer Delivery</h2>
            <p className="text-xs text-muted-foreground">
              {stop.customerName} ({stop.orderNumber})
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-muted-foreground hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-2.5 text-xs text-red-600 bg-red-500/10 border border-red-200 rounded-md">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Delivery Outcome
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStatus("delivered")}
                className={`py-2 px-3 text-xs font-medium rounded-lg border flex items-center justify-center gap-1.5 ${
                  status === "delivered"
                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-600"
                    : "border-border text-foreground hover:bg-muted"
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5" /> Full Delivery
              </button>
              <button
                type="button"
                onClick={() => setStatus("partially_delivered")}
                className={`py-2 px-3 text-xs font-medium rounded-lg border flex items-center justify-center gap-1.5 ${
                  status === "partially_delivered"
                    ? "bg-amber-500/10 border-amber-500 text-amber-600"
                    : "border-border text-foreground hover:bg-muted"
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Partial Delivery
              </button>
              <button
                type="button"
                onClick={() => setStatus("failed")}
                className={`py-2 px-3 text-xs font-medium rounded-lg border flex items-center justify-center gap-1.5 ${
                  status === "failed" || status === "rejected"
                    ? "bg-red-500/10 border-red-500 text-red-600"
                    : "border-border text-foreground hover:bg-muted"
                }`}
              >
                <XCircle className="w-3.5 h-3.5" /> Failed / Rejected
              </button>
            </div>
          </div>

          {status !== "failed" && status !== "rejected" && (
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Delivered & Return Quantities
              </label>
              <div className="border rounded-lg divide-y bg-muted/10 text-xs">
                {deliveredItems.map((item, idx) => (
                  <div key={idx} className="p-3 space-y-2">
                    <div className="flex justify-between font-medium text-foreground">
                      <span>{item.name}</span>
                      <span className="text-muted-foreground">Loaded: {item.loadedQuantity}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground block">Delivered</label>
                        <input
                          type="number"
                          min="0"
                          max={item.loadedQuantity}
                          value={item.deliveredQuantity}
                          onChange={(e) => handleItemChange(idx, "deliveredQuantity", e.target.value)}
                          className="w-full text-xs rounded border p-1 bg-background"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block">Returned</label>
                        <input
                          type="number"
                          min="0"
                          value={item.returnedQuantity}
                          onChange={(e) => handleItemChange(idx, "returnedQuantity", e.target.value)}
                          className="w-full text-xs rounded border p-1 bg-background"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block">Damaged</label>
                        <input
                          type="number"
                          min="0"
                          value={item.damagedQuantity}
                          onChange={(e) => handleItemChange(idx, "damagedQuantity", e.target.value)}
                          className="w-full text-xs rounded border p-1 bg-background"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Cash Collected (৳)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={cashCollected}
                  onChange={(e) => setCashCollected(Number(e.target.value))}
                  className="w-full text-xs rounded-md border border-input bg-background p-2 pr-7 text-foreground font-mono"
                  placeholder="0.00"
                />
                <span className="absolute right-2.5 top-2.5 text-xs text-muted-foreground">৳</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Failure / Return Reason
              </label>
              <input
                type="text"
                value={failureReason}
                onChange={(e) => setFailureReason(e.target.value)}
                className="w-full text-xs rounded-md border border-input bg-background p-2 text-foreground"
                placeholder="e.g. Shop closed, partial reject"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium rounded-md border border-input hover:bg-muted text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? "Recording..." : "Save Delivery Proof"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
