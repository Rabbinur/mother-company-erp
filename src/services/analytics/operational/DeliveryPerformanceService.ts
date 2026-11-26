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
      totalMs: number;
      tripsTimed: number;
    }>();

    const dealershipStatsMap = new Map<string, {
      name: string;
      assigned: number;
      delivered: number;
      returned: number;
    }>();

    for (const d of dispatches) {
      // Dispatches completion duration
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
          });
        }
        const dEntry = dealershipStatsMap.get(dId)!;
        dEntry.assigned++;

        if (stop.status === "delivered") {
          fulfilledCount++;
          dmanEntry.delivered++;
          dEntry.delivered++;
        } else if (stop.status === "partially_delivered") {
          partialCount++;
        } else if (stop.status === "pending") {
          pendingCount++;
        } else if (stop.status === "failed") {
          failedCount++;
          dmanEntry.failed++;
        } else if (stop.status === "rejected") {
          rejectedCount++;
          dmanEntry.rejected++;
        }
      }

      // Quantity tracking
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

    const successRate = totalOrdersAssigned > 0
      ? Number(((fulfilledCount / totalOrdersAssigned) * 100).toFixed(2))
      : 0;

    const avgCompletionHours = completedTimedTrips > 0
      ? Number((totalCompletionMs / completedTimedTrips / (1000 * 60 * 60)).toFixed(2))
      : null;

    const deliverymanPerformance = Array.from(deliverymanMap.entries()).map(([id, st]) => ({
      deliverymanId: id,
      deliverymanName: st.name,
      assignedStops: st.assigned,
      deliveredStops: st.delivered,
      failedStops: st.failed,
      rejectedStops: st.rejected,
      successRate: st.assigned > 0 ? Number(((st.delivered / st.assigned) * 100).toFixed(2)) : 0,
      avgCompletionHours: st.tripsTimed > 0
        ? Number((st.totalMs / st.tripsTimed / (1000 * 60 * 60)).toFixed(2))
        : null,
    }));

    const dealershipPerformance = Array.from(dealershipStatsMap.entries()).map(([id, st]) => ({
      dealershipId: id,
      dealershipName: st.name,
      assignedStops: st.assigned,
      deliveredStops: st.delivered,
      returnedQuantity: st.returned,
      successRate: st.assigned > 0 ? Number(((st.delivered / st.assigned) * 100).toFixed(2)) : 0,
    }));

    return {
      totalOrdersAssigned,
      fulfilledDeliveriesCount: fulfilledCount,
      partiallyFulfilledCount: partialCount,
      pendingDeliveriesCount: pendingCount,
      failedDeliveriesCount: failedCount,
      rejectedDeliveriesCount: rejectedCount,
      deliverySuccessRatePercentage: successRate,
      averageDeliveryCompletionHours: avgCompletionHours,
      promisedDeadlineCompliance: "NOT_CONFIGURED", // Explicitly unconfigured as no promised deadline model exists
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
