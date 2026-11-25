"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  RotateCcw,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Package,
  DollarSign,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { InspectReturnModal } from "@/components/returns/InspectReturnModal";
import { ProcessRefundModal } from "@/components/returns/ProcessRefundModal";

export default function SalesReturnDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [returnData, setReturnData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isInspectOpen, setIsInspectOpen] = useState(false);
  const [isRefundOpen, setIsRefundOpen] = useState(false);

  const fetchDetail = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const res = await fetch(`/api/v1/returns/sales/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to load return details");
      setReturnData(json.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 text-center text-sm text-muted-foreground">
        Loading return details...
      </div>
    );
  }

  if (error || !returnData) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-lg text-center">
        <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive mb-4">
          {error || "Sales return not found"}
        </div>
        <Link
          href="/returns"
          className="inline-flex items-center gap-2 text-xs font-medium text-foreground hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Returns
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between border-b border-border/40 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/returns"
            className="p-2 rounded-lg border border-input hover:bg-muted text-muted-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {returnData.returnNumber}
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold border bg-primary/10 text-primary border-primary/20">
                {returnData.status}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Customer sales return & inspection workbench
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(returnData.status === "REQUESTED" || returnData.status === "UNDER_INSPECTION") && (
            <button
              onClick={() => setIsInspectOpen(true)}
              className="px-3.5 py-2 text-xs font-semibold rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-xs"
            >
              Inspect & Restock
            </button>
          )}

          {(returnData.status === "APPROVED" || returnData.status === "RESTOCKED") &&
            returnData.refundStatus === "PENDING" && (
              <button
                onClick={() => setIsRefundOpen(true)}
                className="px-3.5 py-2 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
              >
                Issue Credit / Refund
              </button>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-border/50 bg-card text-card-foreground shadow-xs">
          <span className="text-xs text-muted-foreground">Original Order Reference</span>
          <div className="text-sm font-semibold mt-1 text-foreground">
            {returnData.orderNumber || String(returnData.orderId)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Created: {format(new Date(returnData.createdAt), "MMM d, yyyy HH:mm")}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border/50 bg-card text-card-foreground shadow-xs">
          <span className="text-xs text-muted-foreground">Financial Settlement Status</span>
          <div className="text-sm font-semibold mt-1 text-foreground capitalize">
            {returnData.refundStatus?.replace(/_/g, " ") || "Pending"}
          </div>
          <div className="text-xs text-muted-foreground mt-1 font-mono">
            {returnData.refundReference ? `Ref: ${returnData.refundReference}` : "Awaiting settlement"}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border/50 bg-card text-card-foreground shadow-xs">
          <span className="text-xs text-muted-foreground">Approved Refund Amount</span>
          <div className="text-lg font-bold text-foreground mt-1">
            {formatCurrency(returnData.netRefundAmount ?? returnData.totalReturnedAmount)}
          </div>
          <div className="text-xs text-emerald-600 mt-0.5">
            Restocked Value: {formatCurrency(returnData.restockedAmount || 0)}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/50 bg-card text-card-foreground shadow-xs">
        <div className="border-b border-border/40 px-4 py-3 bg-muted/40 font-semibold text-xs text-foreground flex items-center gap-2">
          <Package className="w-4 h-4 text-primary" />
          Returned Items & Physical Inspection
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border/40 bg-muted/20 text-[11px] font-semibold uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Product Item</th>
                <th className="px-4 py-3 text-center">Qty</th>
                <th className="px-4 py-3 text-right">Unit Price</th>
                <th className="px-4 py-3">Classification</th>
                <th className="px-4 py-3">Condition Notes</th>
                <th className="px-4 py-3 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {returnData.items?.map((item: any, idx: number) => (
                <tr key={idx} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {item.productId?.name || item.productName || "Product"}
                  </td>
                  <td className="px-4 py-3 text-center font-mono">{item.quantity}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatCurrency(item.unitPrice)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-medium bg-muted border">
                      {item.classification || "PENDING"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-[11px]">
                    {item.conditionNotes || "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold font-mono text-foreground">
                    {formatCurrency(item.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isInspectOpen && (
        <InspectReturnModal
          isOpen={isInspectOpen}
          onClose={() => setIsInspectOpen(false)}
          onSuccess={fetchDetail}
          returnId={returnData._id}
          returnNumber={returnData.returnNumber}
        />
      )}

      {isRefundOpen && (
        <ProcessRefundModal
          isOpen={isRefundOpen}
          onClose={() => setIsRefundOpen(false)}
          onSuccess={fetchDetail}
          returnId={returnData._id}
          returnNumber={returnData.returnNumber}
          maxRefundAmount={returnData.netRefundAmount ?? returnData.totalReturnedAmount}
        />
      )}
    </div>
  );
}
