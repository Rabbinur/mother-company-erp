"use client";

import React from "react";
import { Navigation, Compass, DollarSign, Info } from "lucide-react";
import type { VehicleTripData } from "@/services/analytics/operational/types";

interface Props {
  data: VehicleTripData;
}

export function VehicleTripSection({ data }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Navigation className="w-4 h-4 text-primary" /> Vehicle & Trip Intelligence
          </h3>
          <p className="text-xs text-muted-foreground">
            Dispatches, stops per trip, delivered quantities, and verified vehicle expenses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-full bg-muted border border-border font-medium text-muted-foreground flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            Capacity Utilization: <span className="font-semibold text-foreground">NOT_CONFIGURED</span>
          </span>
        </div>
      </div>

      {/* Trip Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Compass className="w-3.5 h-3.5 text-blue-500" /> Total Dispatches/Trips
          </div>
          <div className="text-lg font-bold text-foreground mt-1">{data.totalTrips}</div>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="text-xs text-muted-foreground">Avg Stops per Trip</div>
          <div className="text-lg font-bold text-foreground mt-1">{data.averageStopsPerTrip}</div>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="text-xs text-muted-foreground">Avg Delivered Qty / Trip</div>
          <div className="text-lg font-bold text-foreground mt-1">{data.averageDeliveredQtyPerTrip.toLocaleString()}</div>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="text-xs text-muted-foreground">Avg Trip Duration</div>
          <div className="text-lg font-bold text-foreground mt-1">
            {data.averageTripDurationMinutes !== null ? `${data.averageTripDurationMinutes} mins` : "N/A"}
          </div>
        </div>
      </div>

      {/* Vehicle Activity Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-3 border-b border-border bg-muted/40 font-semibold text-xs text-foreground">
          Vehicle Fleet Activity & Expenses
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/20 text-muted-foreground uppercase text-[10px]">
              <tr>
                <th className="p-2.5">Vehicle</th>
                <th className="p-2.5">Type</th>
                <th className="p-2.5 text-right">Trips</th>
                <th className="p-2.5 text-right">Stops Delivered</th>
                <th className="p-2.5 text-right">Quantity Delivered</th>
                <th className="p-2.5 text-right">Trip Expenses</th>
                <th className="p-2.5 text-center">Capacity Metric</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.vehicleActivity.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-muted-foreground">No vehicle activity records found</td>
                </tr>
              ) : (
                data.vehicleActivity.map((v) => (
                  <tr key={v.vehicleId} className="hover:bg-muted/30">
                    <td className="p-2.5 font-medium text-foreground">{v.registrationNumber}</td>
                    <td className="p-2.5 capitalize text-muted-foreground">{v.vehicleType}</td>
                    <td className="p-2.5 text-right font-semibold">{v.tripsCount}</td>
                    <td className="p-2.5 text-right text-emerald-600 font-medium">{v.stopsDelivered}</td>
                    <td className="p-2.5 text-right">{v.quantityDelivered.toLocaleString()}</td>
                    <td className="p-2.5 text-right font-medium">
                      {v.totalTripExpenses !== null ? `৳${v.totalTripExpenses.toLocaleString()}` : <span className="text-muted-foreground italic">Masked</span>}
                    </td>
                    <td className="p-2.5 text-center">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        {v.capacityUtilization}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
