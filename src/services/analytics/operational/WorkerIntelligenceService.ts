import mongoose from "mongoose";
import { Dispatch, type IDispatch } from "@/models/Dispatch";
import type { WorkerIntelligenceData } from "./types";

export class WorkerIntelligenceService {
  static async getWorkerIntelligence(params: {
    businessId: mongoose.Types.ObjectId;
    dealershipId?: mongoose.Types.ObjectId;
    warehouseId?: mongoose.Types.ObjectId;
    workerId?: string;
    startDate: Date;
    endDate: Date;
    canViewCosts: boolean;
  }): Promise<WorkerIntelligenceData> {
    const query: any = {
      businessId: params.businessId,
      status: { $ne: "CANCELLED" },
      createdAt: { $gte: params.startDate, $lte: params.endDate },
    };

    if (params.dealershipId) query.dealershipIds = params.dealershipId;
    if (params.warehouseId) query.warehouseId = params.warehouseId;

    const dispatches = await Dispatch.find(query).lean();

    let totalWorkerAssignments = 0;
    let loadingTasksCount = 0;
    let unloadingTasksCount = 0;
    let completedAssignmentsCount = 0;
    let pendingAssignmentsCount = 0;
    let totalUniqueCargoHandled = 0;

    const workerStatsMap = new Map<string, {
      workerName: string;
      assignmentsCount: number;
      loadingCount: number;
      unloadingCount: number;
      recordedQuantity: number;
      hasMissingQuantity: boolean;
      totalCompensationEarned: number;
    }>();

    for (const d of dispatches) {
      const assignedWorkers = d.workers || [];
      if (assignedWorkers.length > 0) {
        // Unique dispatch physical cargo handled (not multiplied per worker)
        let dCargo = 0;
        for (const it of d.items || []) {
          if (params.dealershipId && String(it.dealershipId) !== String(params.dealershipId)) continue;
          dCargo += (it.deliveredQuantity || it.loadedQuantity || 0);
        }
        totalUniqueCargoHandled += dCargo;
      }

      for (const w of assignedWorkers) {
        if (params.workerId && w.workerName !== params.workerId && w.workerPhone !== params.workerId) {
          continue;
        }

        totalWorkerAssignments++;

        const isLoad = w.activity === "loading" || w.activity === "both";
        const isUnload = w.activity === "unloading" || w.activity === "both";
        if (isLoad) loadingTasksCount++;
        if (isUnload) unloadingTasksCount++;

        const isCompleted = w.paymentStatus === "paid" || d.status === "DELIVERED";
        if (isCompleted) {
          completedAssignmentsCount++;
        } else {
          pendingAssignmentsCount++;
        }

        const nameKey = w.workerName || "Unassigned Worker";
        if (!workerStatsMap.has(nameKey)) {
          workerStatsMap.set(nameKey, {
            workerName: nameKey,
            assignmentsCount: 0,
            loadingCount: 0,
            unloadingCount: 0,
            recordedQuantity: 0,
            hasMissingQuantity: false,
            totalCompensationEarned: 0,
          });
        }

        const entry = workerStatsMap.get(nameKey)!;
        entry.assignmentsCount++;
        if (isLoad) entry.loadingCount++;
        if (isUnload) entry.unloadingCount++;
        entry.totalCompensationEarned += w.totalAmount || 0;

        // Individual worker quantity tracking: only record if genuine quantity is recorded on worker record
        if (typeof w.quantity === "number" && !isNaN(w.quantity) && w.quantity >= 0) {
          entry.recordedQuantity += w.quantity;
        } else {
          // If individual worker quantity is unavailable, do NOT invent an artificial allocation
          entry.hasMissingQuantity = true;
        }
      }
    }

    const workerOverview = Array.from(workerStatsMap.values()).map((w) => {
      // If individual worker quantities were not recorded, report NOT_CONFIGURED
      const totalQuantityHandled: number | "NOT_CONFIGURED" =
        w.hasMissingQuantity && w.recordedQuantity === 0
          ? "NOT_CONFIGURED"
          : w.recordedQuantity;

      return {
        workerName: w.workerName,
        assignmentsCount: w.assignmentsCount,
        loadingCount: w.loadingCount,
        unloadingCount: w.unloadingCount,
        totalQuantityHandled,
        totalCompensationEarned: params.canViewCosts ? w.totalCompensationEarned : null,
      };
    });

    return {
      totalWorkerAssignments,
      totalUniqueCargoHandled,
      loadingTasksCount,
      unloadingTasksCount,
      completedAssignmentsCount,
      pendingAssignmentsCount,
      recordedWorkDuration: "NOT_CONFIGURED",
      workerOverview,
    };
  }
}
