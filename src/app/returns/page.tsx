"use client";

import React, { useState, useEffect } from "react";
import { ReturnsHeader } from "@/components/returns/ReturnsHeader";
import { ReturnsKpiCards } from "@/components/returns/ReturnsKpiCards";
import { SalesReturnTable, SalesReturnSummary } from "@/components/returns/SalesReturnTable";
import { PurchaseReturnTable, PurchaseReturnSummary } from "@/components/returns/PurchaseReturnTable";
import { ClaimTable, ClaimSummary } from "@/components/returns/ClaimTable";
import { CreateSalesReturnModal } from "@/components/returns/CreateSalesReturnModal";
import { InspectReturnModal } from "@/components/returns/InspectReturnModal";
import { ProcessRefundModal } from "@/components/returns/ProcessRefundModal";
import { CreateClaimModal } from "@/components/returns/CreateClaimModal";

export default function ReturnsDashboardPage() {
  const [activeTab, setActiveTab] = useState<"sales" | "purchases" | "claims">("sales");
  const [salesReturns, setSalesReturns] = useState<SalesReturnSummary[]>([]);
  const [purchaseReturns, setPurchaseReturns] = useState<PurchaseReturnSummary[]>([]);
  const [claims, setClaims] = useState<ClaimSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Modals state
  const [isCreateSalesModalOpen, setIsCreateSalesModalOpen] = useState(false);
  const [isCreateClaimModalOpen, setIsCreateClaimModalOpen] = useState(false);
  const [inspectReturn, setInspectReturn] = useState<SalesReturnSummary | null>(null);
  const [refundReturn, setRefundReturn] = useState<SalesReturnSummary | null>(null);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      if (activeTab === "sales") {
        const res = await fetch("/api/v1/returns/sales");
        const json = await res.json();
        if (json.success) setSalesReturns(json.data || []);
      } else if (activeTab === "purchases") {
        const res = await fetch("/api/v1/returns/purchases");
        const json = await res.json();
        if (json.success) setPurchaseReturns(json.data || []);
      } else {
        const res = await fetch("/api/v1/claims");
        const json = await res.json();
        if (json.success) setClaims(json.data || []);
      }
    } catch (err) {
      console.error("Failed to load returns data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  // KPIs calculation
  const pendingInspections = salesReturns.filter(
    (r) => r.status === "REQUESTED" || r.status === "UNDER_INSPECTION"
  ).length;
  const approvedRestocked = salesReturns.filter(
    (r) => r.status === "APPROVED" || r.status === "RESTOCKED"
  ).length;
  const pendingRefunds = salesReturns.filter(
    (r) => (r.status === "APPROVED" || r.status === "RESTOCKED") && r.refundStatus === "PENDING"
  ).length;
  const activeClaimsCount = claims.filter(
    (c) => c.status === "SUBMITTED" || c.status === "UNDER_REVIEW" || c.status === "APPROVED"
  ).length;

  const handleDispatchPurchaseReturn = async (ret: PurchaseReturnSummary) => {
    if (!confirm(`Dispatch inventory for supplier return ${ret.returnNumber}?`)) return;
    try {
      const res = await fetch(`/api/v1/returns/purchases/${ret._id}/dispatch`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) alert(json.message || "Failed to dispatch return");
      else fetchData();
    } catch (err: any) {
      alert(err.message || "Dispatch error");
    }
  };

  const handleSettlePurchaseReturn = async (ret: PurchaseReturnSummary) => {
    const amountStr = prompt(
      `Enter settled credit amount for ${ret.returnNumber}:`,
      String(ret.totalDebitAmount)
    );
    if (!amountStr) return;
    try {
      const res = await fetch(`/api/v1/returns/purchases/${ret._id}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settledAmount: Number(amountStr),
          creditNoteNumber: "CN-AUTO-" + Date.now(),
        }),
      });
      const json = await res.json();
      if (!res.ok) alert(json.message || "Failed to settle return");
      else fetchData();
    } catch (err: any) {
      alert(err.message || "Settlement error");
    }
  };

  const handleApproveClaim = async (claim: ClaimSummary) => {
    const amountStr = prompt(
      `Enter approved amount for claim ${claim.claimNumber}:`,
      String(claim.claimedAmount)
    );
    if (!amountStr) return;
    try {
      const res = await fetch(`/api/v1/claims/${claim._id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvedAmount: Number(amountStr) }),
      });
      const json = await res.json();
      if (!res.ok) alert(json.message || "Failed to approve claim");
      else fetchData();
    } catch (err: any) {
      alert(err.message || "Approval error");
    }
  };

  const handleSettleClaim = async (claim: ClaimSummary) => {
    const amountStr = prompt(
      `Enter settled settlement payout for ${claim.claimNumber}:`,
      String(claim.approvedAmount || claim.claimedAmount)
    );
    if (!amountStr) return;
    try {
      const res = await fetch(`/api/v1/claims/${claim._id}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settledAmount: Number(amountStr) }),
      });
      const json = await res.json();
      if (!res.ok) alert(json.message || "Failed to settle claim");
      else fetchData();
    } catch (err: any) {
      alert(err.message || "Settlement error");
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <ReturnsHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onNewSalesReturnClick={() => setIsCreateSalesModalOpen(true)}
        onNewClaimClick={() => setIsCreateClaimModalOpen(true)}
        onRefresh={fetchData}
        isLoading={isLoading}
      />

      <ReturnsKpiCards
        pendingInspectionCount={pendingInspections}
        approvedRestockedCount={approvedRestocked}
        pendingRefundCount={pendingRefunds}
        activeClaimsCount={activeClaimsCount}
      />

      {activeTab === "sales" && (
        <SalesReturnTable
          returns={salesReturns}
          isLoading={isLoading}
          onInspect={(ret) => setInspectReturn(ret)}
          onRefund={(ret) => setRefundReturn(ret)}
        />
      )}

      {activeTab === "purchases" && (
        <PurchaseReturnTable
          returns={purchaseReturns}
          isLoading={isLoading}
          onDispatch={handleDispatchPurchaseReturn}
          onSettle={handleSettlePurchaseReturn}
        />
      )}

      {activeTab === "claims" && (
        <ClaimTable
          claims={claims}
          isLoading={isLoading}
          onApprove={handleApproveClaim}
          onSettle={handleSettleClaim}
        />
      )}

      <CreateSalesReturnModal
        isOpen={isCreateSalesModalOpen}
        onClose={() => setIsCreateSalesModalOpen(false)}
        onSuccess={fetchData}
      />

      <CreateClaimModal
        isOpen={isCreateClaimModalOpen}
        onClose={() => setIsCreateClaimModalOpen(false)}
        onSuccess={fetchData}
      />

      {inspectReturn && (
        <InspectReturnModal
          isOpen={!!inspectReturn}
          onClose={() => setInspectReturn(null)}
          onSuccess={fetchData}
          returnId={inspectReturn._id}
          returnNumber={inspectReturn.returnNumber}
        />
      )}

      {refundReturn && (
        <ProcessRefundModal
          isOpen={!!refundReturn}
          onClose={() => setRefundReturn(null)}
          onSuccess={fetchData}
          returnId={refundReturn._id}
          returnNumber={refundReturn.returnNumber}
          maxRefundAmount={refundReturn.netRefundAmount ?? refundReturn.totalReturnedAmount}
        />
      )}
    </div>
  );
}
