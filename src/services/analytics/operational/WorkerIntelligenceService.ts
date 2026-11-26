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

    const workerStatsMap = new Map<string, {
      workerName: string;
      assignmentsCount: number;
      loadingCount: number;
      unloadingCount: number;
      totalQuantityHandled: number;
      totalCompensationEarned: number;
    }>();

    for (const d of dispatches) {
      for (const w of d.workers || []) {
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
            totalQuantityHandled: 0,
            totalCompensationEarned: 0,
          });
        }

        const entry = workerStatsMap.get(nameKey)!;
        entry.assignmentsCount++;
        if (isLoad) entry.loadingCount++;
        if (isUnload) entry.unloadingCount++;
        entry.totalQuantityHandled += w.quantity || 0;
        entry.totalCompensationEarned += w.totalAmount || 0;
      }
    }

    const workerOverview = Array.from(workerStatsMap.values()).map((w) => ({
      workerName: w.workerName,
      assignmentsCount: w.assignmentsCount,
      loadingCount: w.loadingCount,
      unloadingCount: w.unloadingCount,
      totalQuantityHandled: w.totalQuantityHandled,
      totalCompensationEarned: params.canViewCosts ? w.totalCompensationEarned : null,
    }));

    return {
      totalWorkerAssignments,
      loadingTasksCount,
      unloadingTasksCount,
      completedAssignmentsCount,
      pendingAssignmentsCount,
      recordedWorkDuration: "NOT_CONFIGURED", // Shift/attendance duration not tracked in schema
      workerOverview,
    };
  }
}
