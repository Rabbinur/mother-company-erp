import mongoose from "mongoose";
import { Dispatch, type IDispatch } from "@/models/Dispatch";
import type { DeliveryReportPayload, DeliveryReportTripItem, DeliveryReportStopItem } from "./types";

export class DeliveryReportService {
  static async getDeliveryReportData(params: {
    businessId: mongoose.Types.ObjectId;
    dealershipId?: mongoose.Types.ObjectId;
    warehouseId?: mongoose.Types.ObjectId;
    vehicleId?: mongoose.Types.ObjectId;
    deliverymanId?: mongoose.Types.ObjectId;
    startDate: Date;
    endDate: Date;
    canViewCosts: boolean;
    dealershipMap: Map<string, { name: string; code: string }>;
  }): Promise<DeliveryReportPayload> {
    const query: any = {
      businessId: params.businessId,
      status: { $ne: "CANCELLED" },
      createdAt: { $gte: params.startDate, $lte: params.endDate },
    };

    if (params.dealershipId) query.dealershipIds = params.dealershipId;
    if (params.warehouseId) query.warehouseId = params.warehouseId;
    if (params.vehicleId) query.vehicleId = params.vehicleId;
    if (params.deliverymanId) query.deliverymanId = params.deliverymanId;

    const dispatches: IDispatch[] = await Dispatch.find(query)
      .sort({ tripDate: -1, createdAt: -1 })
      .lean();

    let totalAssignedStops = 0;
    let fulfilledStops = 0;
    let cancelledStops = 0;
    let totalLoadedQuantity = 0;
    let totalDeliveredQuantity = 0;
    let totalReturnedQuantity = 0;
    let totalUndeliveredQuantity = 0;
    let totalDeliveryExpenses = 0;
    let totalCashCollected = 0;
    let totalTripDurationMinutes = 0;
    let timedTripsCount = 0;

    const trips: DeliveryReportTripItem[] = [];

    for (const d of dispatches) {
      let tripDurationMinutes: number | null = null;
      if (d.startedAt && d.completedAt) {
        const ms = new Date(d.completedAt).getTime() - new Date(d.startedAt).getTime();
        if (ms > 0) {
          tripDurationMinutes = Math.round(ms / (1000 * 60));
          totalTripDurationMinutes += tripDurationMinutes;
          timedTripsCount++;
        }
      }

      const dNames: string[] = [];
      for (const dId of d.dealershipIds || []) {
        const dInfo = params.dealershipMap.get(String(dId));
        if (dInfo) dNames.push(dInfo.name);
      }

      let tripFulfilled = 0;
      let tripPartial = 0;
      let tripFailed = 0;
      let tripRejected = 0;
      let tripCancelled = 0;

      const stops: DeliveryReportStopItem[] = [];
      for (const st of d.orders || []) {
        if (params.dealershipId && String(st.dealershipId) !== String(params.dealershipId)) {
          continue;
        }

        totalAssignedStops++;
        const sStatus = (st.status || "").toLowerCase();

        if (sStatus === "delivered") {
          tripFulfilled++;
          fulfilledStops++;
        } else if (sStatus === "partially_delivered") {
          tripPartial++;
        } else if (sStatus === "failed") {
          tripFailed++;
        } else if (sStatus === "rejected") {
          tripRejected++;
        } else if (sStatus === "cancelled") {
          tripCancelled++;
          cancelledStops++;
        }

        if (st.cashCollected) {
          totalCashCollected += st.cashCollected;
        }

        stops.push({
          stopSequence: st.stopSequence || stops.length + 1,
          orderNumber: st.orderNumber || "N/A",
          customerName: st.customerName || "Customer",
          shopName: st.shopName,
          address: st.address,
          status: st.status || "pending",
          deliveredAt: st.deliveredAt || null,
          failureReason: st.failureReason,
          cashCollected: params.canViewCosts ? (st.cashCollected || 0) : null,
        });
      }

      let tripLoaded = 0;
      let tripDelivered = 0;
      let tripReturned = 0;
      let tripDamaged = 0;
      let tripUndelivered = 0;

      for (const it of d.items || []) {
        if (params.dealershipId && String(it.dealershipId) !== String(params.dealershipId)) {
          continue;
        }
        tripLoaded += it.loadedQuantity || 0;
        tripDelivered += it.deliveredQuantity || 0;
        tripReturned += it.returnedQuantity || 0;
        tripDamaged += it.damagedQuantity || 0;
        tripUndelivered += it.undeliveredQuantity || 0;
      }

      totalLoadedQuantity += tripLoaded;
      totalDeliveredQuantity += tripDelivered;
      totalReturnedQuantity += tripReturned;
      totalUndeliveredQuantity += tripUndelivered;

      // Expenses for this trip
      let tripExpenseAmount = 0;
      for (const exp of d.expenses || []) {
        const amt = exp.amount || 0;
        if (params.dealershipId) {
          if (exp.dealershipAllocations && exp.dealershipAllocations.length > 0) {
            const alloc = exp.dealershipAllocations.find(
              (a) => String(a.dealershipId) === String(params.dealershipId)
            );
            tripExpenseAmount += alloc?.amount || 0;
          } else if (d.dealershipIds && d.dealershipIds.length > 0) {
            tripExpenseAmount += amt / d.dealershipIds.length;
          }
        } else {
          tripExpenseAmount += amt;
        }
      }
      totalDeliveryExpenses += tripExpenseAmount;

      // Reconciliation discrepancy check
      const rec = d.reconciliation;
      const hasVariance = Boolean(
        rec && (
          rec.isStockBalanced === false ||
          (typeof rec.stockVariance === "number" && rec.stockVariance !== 0) ||
          (typeof rec.cashDifference === "number" && rec.cashDifference !== 0)
        )
      );

      trips.push({
        dispatchId: String(d._id),
        dispatchNumber: d.dispatchNumber || "DISPATCH",
        tripDate: d.tripDate || d.createdAt,
        status: d.status,
        vehicleNumber: d.vehicleNumber || "Unassigned Vehicle",
        deliverymanName: d.deliverymanName || "Unassigned Deliveryman",
        startedAt: d.startedAt || null,
        completedAt: d.completedAt || null,
        tripDurationMinutes,
        dealershipNames: dNames,
        totalStops: stops.length,
        fulfilledStops: tripFulfilled,
        partialStops: tripPartial,
        failedStops: tripFailed,
        rejectedStops: tripRejected,
        cancelledStops: tripCancelled,
        loadedQuantity: tripLoaded,
        deliveredQuantity: tripDelivered,
        returnedQuantity: tripReturned,
        damagedQuantity: tripDamaged,
        undeliveredQuantity: tripUndelivered,
        deliveryExpenses: params.canViewCosts ? Number(tripExpenseAmount.toFixed(2)) : null,
        reconciliationDiscrepancy: hasVariance,
        reconciliationNotes: rec?.notes,
        stops,
      });
    }

    const eligibleStops = Math.max(0, totalAssignedStops - cancelledStops);
    const deliverySuccessRate = eligibleStops > 0
      ? Number(((fulfilledStops / eligibleStops) * 100).toFixed(2))
      : 0;

    const avgTripDuration = timedTripsCount > 0
      ? Math.round(totalTripDurationMinutes / timedTripsCount)
      : null;

    return {
      reportTitle: "Delivery & Dispatch Operational Report",
      filterScope: {
        businessId: String(params.businessId),
        dealershipId: params.dealershipId ? String(params.dealershipId) : undefined,
        startDate: params.startDate,
        endDate: params.endDate,
      },
      summary: {
        totalTrips: dispatches.length,
        totalAssignedStops,
        eligibleStops,
        fulfilledStops,
        cancelledStops,
        deliverySuccessRate,
        totalLoadedQuantity,
        totalDeliveredQuantity,
        totalReturnedQuantity,
        totalUndeliveredQuantity,
        totalDeliveryExpenses: params.canViewCosts ? Number(totalDeliveryExpenses.toFixed(2)) : null,
        totalCashCollected: params.canViewCosts ? Number(totalCashCollected.toFixed(2)) : null,
        averageTripDurationMinutes: avgTripDuration,
      },
      trips,
      generatedAt: new Date(),
    };
  }
}
