import mongoose from "mongoose";
import { Dispatch, type IDispatch } from "@/models/Dispatch";
import { Vehicle } from "@/models/Vehicle";
import type { VehicleTripData } from "./types";

export class VehicleTripService {
  static async getVehicleTripData(params: {
    businessId: mongoose.Types.ObjectId;
    dealershipId?: mongoose.Types.ObjectId;
    warehouseId?: mongoose.Types.ObjectId;
    vehicleId?: mongoose.Types.ObjectId;
    startDate: Date;
    endDate: Date;
    canViewCosts: boolean;
  }): Promise<VehicleTripData> {
    const query: any = {
      businessId: params.businessId,
      status: { $ne: "CANCELLED" },
      createdAt: { $gte: params.startDate, $lte: params.endDate },
    };

    if (params.dealershipId) query.dealershipIds = params.dealershipId;
    if (params.warehouseId) query.warehouseId = params.warehouseId;
    if (params.vehicleId) query.vehicleId = params.vehicleId;

    const [dispatches, vehicles] = await Promise.all([
      Dispatch.find(query).lean(),
      Vehicle.find({ businessId: params.businessId }).lean(),
    ]);

    const vehicleMetaMap = new Map<string, { reg: string; type: string; capKg: number }>();
    vehicles.forEach((v) => {
      vehicleMetaMap.set(String(v._id), {
        reg: v.registrationNumber,
        type: v.vehicleType,
        capKg: v.capacityWeightKg || 0,
      });
    });

    const totalTrips = dispatches.length;
    const tripStatusDistribution: Record<string, number> = {};
    let totalStops = 0;
    let totalDeliveredQty = 0;
    let totalTripDurationMs = 0;
    let completedTimedTrips = 0;

    const vehicleStatsMap = new Map<string, {
      registrationNumber: string;
      vehicleType: string;
      tripsCount: number;
      stopsDelivered: number;
      quantityDelivered: number;
      totalTripExpenses: number;
      capacityWeightKg: number;
    }>();

    for (const d of dispatches) {
      tripStatusDistribution[d.status] = (tripStatusDistribution[d.status] || 0) + 1;
      totalStops += (d.orders || []).length;

      let dDeliveredQty = 0;
      for (const it of d.items || []) {
        if (params.dealershipId && String(it.dealershipId) !== String(params.dealershipId)) continue;
        dDeliveredQty += it.deliveredQuantity || 0;
      }
      totalDeliveredQty += dDeliveredQty;

      if (d.startedAt && d.completedAt) {
        const ms = new Date(d.completedAt).getTime() - new Date(d.startedAt).getTime();
        if (ms > 0) {
          totalTripDurationMs += ms;
          completedTimedTrips++;
        }
      }

      // Vehicle activity tracking
      const vKey = d.vehicleId ? String(d.vehicleId) : d.vehicleNumber || "Unassigned";
      if (!vehicleStatsMap.has(vKey)) {
        const meta = d.vehicleId ? vehicleMetaMap.get(String(d.vehicleId)) : null;
        vehicleStatsMap.set(vKey, {
          registrationNumber: meta?.reg || d.vehicleNumber || "Unassigned Vehicle",
          vehicleType: meta?.type || "unknown",
          tripsCount: 0,
          stopsDelivered: 0,
          quantityDelivered: 0,
          totalTripExpenses: 0,
          capacityWeightKg: meta?.capKg || 0,
        });
      }
      const vEntry = vehicleStatsMap.get(vKey)!;
      vEntry.tripsCount++;
      vEntry.quantityDelivered += dDeliveredQty;

      for (const st of d.orders || []) {
        if (st.status === "delivered") vEntry.stopsDelivered++;
      }

      for (const exp of d.expenses || []) {
        vEntry.totalTripExpenses += exp.amount || 0;
      }
    }

    const averageStopsPerTrip = totalTrips > 0
      ? Number((totalStops / totalTrips).toFixed(1))
      : 0;

    const averageDeliveredQtyPerTrip = totalTrips > 0
      ? Number((totalDeliveredQty / totalTrips).toFixed(1))
      : 0;

    const averageTripDurationMinutes = completedTimedTrips > 0
      ? Number((totalTripDurationMs / completedTimedTrips / (1000 * 60)).toFixed(1))
      : null;

    const vehicleActivity = Array.from(vehicleStatsMap.entries()).map(([id, s]) => ({
      vehicleId: id,
      registrationNumber: s.registrationNumber,
      vehicleType: s.vehicleType,
      tripsCount: s.tripsCount,
      stopsDelivered: s.stopsDelivered,
      quantityDelivered: s.quantityDelivered,
      totalTripExpenses: params.canViewCosts ? s.totalTripExpenses : null,
      capacityUtilization: "NOT_CONFIGURED" as const, // Never invent capacity/fuel data
    }));

    return {
      totalTrips,
      tripStatusDistribution,
      averageStopsPerTrip,
      averageDeliveredQtyPerTrip,
      averageTripDurationMinutes,
      vehicleActivity,
    };
  }
}
