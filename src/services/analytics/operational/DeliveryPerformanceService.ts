import mongoose from "mongoose";
import { Dispatch, type IDispatch } from "@/models/Dispatch";
import type { DeliveryPerformanceData } from "./types";

export class DeliveryPerformanceService {
  static async getDeliveryPerformance(params: {
    businessId: mongoose.Types.ObjectId;
    dealershipId?: mongoose.Types.ObjectId;
    warehouseId?: mongoose.Types.ObjectId;
    vehicleId?: mongoose.Types.ObjectId;
    deliverymanId?: mongoose.Types.ObjectId;
    startDate: Date;
    endDate: Date;
    dealershipMap: Map<string, { name: string; code: string }>;
  }): Promise<DeliveryPerformanceData> {
    const query: any = {
      businessId: params.businessId,
      status: { $ne: "CANCELLED" },
      createdAt: { $gte: params.startDate, $lte: params.endDate },
    };

    if (params.dealershipId) query.dealershipIds = params.dealershipId;
    if (params.warehouseId) query.warehouseId = params.warehouseId;
    if (params.vehicleId) query.vehicleId = params.vehicleId;
    if (params.deliverymanId) query.deliverymanId = params.deliverymanId;

    const dispatches: IDispatch[] = await Dispatch.find(query).lean();

    let totalOrdersAssigned = 0;
    let fulfilledCount = 0;
    let partialCount = 0;
    let pendingCount = 0;
    let failedCount = 0;
    let rejectedCount = 0;
    let cancelledCount = 0;

    let totalLoadedQuantity = 0;
    let totalDeliveredQuantity = 0;
    let totalReturnedQuantity = 0;
    let totalDamagedQuantity = 0;
    let totalUndeliveredQuantity = 0;

    let totalCompletionMs = 0;
    let completedTimedTrips = 0;

    const deliverymanMap = new Map<string, {
      name: string;
      assigned: number;
      delivered: number;
      failed: number;
      rejected: number;
      cancelled: number;
      totalMs: number;
      tripsTimed: number;
    }>();

    const dealershipStatsMap = new Map<string, {
      name: string;
      assigned: number;
      delivered: number;
      returned: number;
      cancelled: number;
    }>();

    for (const d of dispatches) {
      // Dispatch-level route trip duration (from vehicle departure to return/completion)
      if (d.startedAt && d.completedAt) {
        const ms = new Date(d.completedAt).getTime() - new Date(d.startedAt).getTime();
        if (ms > 0) {
          totalCompletionMs += ms;
          completedTimedTrips++;
          if (d.deliverymanId) {
            const dman = deliverymanMap.get(String(d.deliverymanId));
            if (dman) {
              dman.totalMs += ms;
              dman.tripsTimed++;
            }
          }
        }
      }

      const dmanKey = d.deliverymanId ? String(d.deliverymanId) : "Unassigned";
      if (!deliverymanMap.has(dmanKey)) {
        deliverymanMap.set(dmanKey, {
          name: d.deliverymanName || "Unassigned Staff",
          assigned: 0,
          delivered: 0,
          failed: 0,
          rejected: 0,
          cancelled: 0,
          totalMs: 0,
          tripsTimed: 0,
        });
      }
      const dmanEntry = deliverymanMap.get(dmanKey)!;

      // Stop-level tracking
      for (const stop of d.orders || []) {
        if (params.dealershipId && String(stop.dealershipId) !== String(params.dealershipId)) {
          continue;
        }

        totalOrdersAssigned++;
        dmanEntry.assigned++;

        const dId = String(stop.dealershipId);
        if (!dealershipStatsMap.has(dId)) {
          const info = params.dealershipMap.get(dId);
          dealershipStatsMap.set(dId, {
            name: info?.name || "Dealership",
            assigned: 0,
            delivered: 0,
            returned: 0,
            cancelled: 0,
          });
        }
        const dEntry = dealershipStatsMap.get(dId)!;
        dEntry.assigned++;

        const stopStatus = (stop.status || "").toLowerCase();
        if (stopStatus === "delivered") {
          fulfilledCount++;
          dmanEntry.delivered++;
          dEntry.delivered++;
        } else if (stopStatus === "partially_delivered") {
          partialCount++;
        } else if (stopStatus === "pending") {
          pendingCount++;
        } else if (stopStatus === "failed") {
          failedCount++;
          dmanEntry.failed++;
        } else if (stopStatus === "rejected") {
          rejectedCount++;
          dmanEntry.rejected++;
        } else if (stopStatus === "cancelled") {
          // Cancelled orders prior to or at dispatch are not delivery failures
          cancelledCount++;
          dmanEntry.cancelled++;
          dEntry.cancelled++;
        }
      }

      // Cargo quantity accounting
      for (const it of d.items || []) {
        if (params.dealershipId && String(it.dealershipId) !== String(params.dealershipId)) {
          continue;
        }
        totalLoadedQuantity += it.loadedQuantity || 0;
        totalDeliveredQuantity += it.deliveredQuantity || 0;
        totalReturnedQuantity += it.returnedQuantity || 0;
        totalDamagedQuantity += it.damagedQuantity || 0;
        totalUndeliveredQuantity += it.undeliveredQuantity || 0;

        const dId = String(it.dealershipId);
        if (dealershipStatsMap.has(dId)) {
          dealershipStatsMap.get(dId)!.returned += it.returnedQuantity || 0;
        }
      }
    }

    // Success rate denominator: eligible assigned stops excludes cancelled stops
    const eligibleOrdersAssigned = Math.max(0, totalOrdersAssigned - cancelledCount);
    const successRate = eligibleOrdersAssigned > 0
      ? Number(((fulfilledCount / eligibleOrdersAssigned) * 100).toFixed(2))
      : 0;

    const avgTripCompletionHours = completedTimedTrips > 0
      ? Number((totalCompletionMs / completedTimedTrips / (1000 * 60 * 60)).toFixed(2))
      : null;

    const deliverymanPerformance = Array.from(deliverymanMap.entries()).map(([id, st]) => {
      const eligible = Math.max(0, st.assigned - st.cancelled);
      return {
        deliverymanId: id,
        deliverymanName: st.name,
        assignedStops: st.assigned,
        eligibleStops: eligible,
        deliveredStops: st.delivered,
        failedStops: st.failed,
        rejectedStops: st.rejected,
        cancelledStops: st.cancelled,
        successRate: eligible > 0 ? Number(((st.delivered / eligible) * 100).toFixed(2)) : 0,
        avgCompletionHours: st.tripsTimed > 0
          ? Number((st.totalMs / st.tripsTimed / (1000 * 60 * 60)).toFixed(2))
          : null,
      };
    });

    const dealershipPerformance = Array.from(dealershipStatsMap.entries()).map(([id, st]) => {
      const eligible = Math.max(0, st.assigned - st.cancelled);
      return {
        dealershipId: id,
        dealershipName: st.name,
        assignedStops: st.assigned,
        eligibleStops: eligible,
        deliveredStops: st.delivered,
        returnedQuantity: st.returned,
        successRate: eligible > 0 ? Number(((st.delivered / eligible) * 100).toFixed(2)) : 0,
      };
    });

    return {
      totalOrdersAssigned,
      eligibleOrdersAssigned,
      cancelledDeliveriesCount: cancelledCount,
      fulfilledDeliveriesCount: fulfilledCount,
      partiallyFulfilledCount: partialCount,
      pendingDeliveriesCount: pendingCount,
      failedDeliveriesCount: failedCount,
      rejectedDeliveriesCount: rejectedCount,
      deliverySuccessRatePercentage: successRate,
      averageTripCompletionHours: avgTripCompletionHours,
      averageDeliveryCompletionHours: avgTripCompletionHours,
      stopDeliveryDuration: "NOT_CONFIGURED",
      promisedDeadlineCompliance: "NOT_CONFIGURED",
      totalLoadedQuantity,
      totalDeliveredQuantity,
      totalReturnedQuantity,
      totalDamagedQuantity,
      totalUndeliveredQuantity,
      deliverymanPerformance,
      dealershipPerformance,
    };
  }
}
