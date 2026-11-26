import mongoose from "mongoose";
import { AutomationEngine } from "./AutomationEngine";
import { Business } from "@/models/Business";
import { AutomationSchedulerSetting } from "@/models/AutomationSchedulerSetting";
import { AutomationExecution } from "@/models/AutomationExecution";
import type { EngineRunResult } from "./types";

export interface ScheduledBatchSummary {
  status: "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED" | "SKIPPED_DISABLED";
  startedAt: Date;
  completedAt: Date;
  totalBusinessesEvaluated: number;
  totalRulesEvaluated: number;
  totalEventsGenerated: number;
  resumptionPending?: boolean;
  businessResults: Array<{
    businessId: string;
    businessName: string;
    status: string;
    rulesEvaluated: number;
    eventsGenerated: number;
    errorsCount: number;
  }>;
  skippedOrFailed: Array<{ businessId: string; reason: string }>;
}

export interface SchedulerSettingView {
  businessId: string;
  enabled: boolean;
  lastToggledAt?: Date | null;
  toggledBy?: string | null;
  toggledByEmail?: string | null;
  lastExecution?: any;
  nextScheduledExecution: Date;
}

export class AutomationSchedulerService {
  static async getSchedulerSetting(
    businessId: string | mongoose.Types.ObjectId
  ): Promise<SchedulerSettingView> {
    const setting = await AutomationSchedulerSetting.findOne({ businessId }).lean();
    const lastExecution = await AutomationExecution.findOne({
      businessId,
      triggeredBy: "SCHEDULED",
    })
      .sort({ startedAt: -1 })
      .lean();

    const now = new Date();
    const nextUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0)
    );

    return {
      businessId: String(businessId),
      enabled: setting ? setting.enabled !== false : true,
      lastToggledAt: setting?.lastToggledAt || null,
      toggledBy: setting?.toggledBy ? String(setting.toggledBy) : null,
      toggledByEmail: setting?.toggledByEmail || null,
      lastExecution: lastExecution || null,
      nextScheduledExecution: nextUtc,
    };
  }

  static async updateSchedulerSetting(params: {
    businessId: string | mongoose.Types.ObjectId;
    enabled: boolean;
    userId?: string | mongoose.Types.ObjectId;
    userEmail?: string;
    reason?: string;
  }) {
    return AutomationSchedulerSetting.findOneAndUpdate(
      { businessId: params.businessId },
      {
        $set: {
          enabled: params.enabled,
          lastToggledAt: new Date(),
          toggledBy: params.userId,
          toggledByEmail: params.userEmail,
          reason: params.reason || (params.enabled ? "Enabled by admin" : "Disabled by admin"),
        },
        $setOnInsert: { businessId: params.businessId },
      },
      { upsert: true, new: true }
    ).lean();
  }

  static async runScheduledEvaluation(params: {
    businessId: string | mongoose.Types.ObjectId;
    dealershipId?: string | mongoose.Types.ObjectId;
  }): Promise<EngineRunResult> {
    const setting = await AutomationSchedulerSetting.findOne({ businessId: params.businessId }).lean();

    if (setting && setting.enabled === false) {
      return {
        executionKey: `SKIPPED_${Date.now()}`,
        status: "SKIPPED_DISABLED" as any,
        startedAt: new Date(),
        completedAt: new Date(),
        rulesEvaluated: 0,
        eventsGenerated: 0,
        newEvents: [],
        errors: [],
      };
    }

    const res = await AutomationEngine.run({
      businessId: params.businessId,
      dealershipId: params.dealershipId,
      triggeredBy: "SCHEDULED",
    });

    await AutomationSchedulerSetting.updateOne(
      { businessId: params.businessId },
      { $set: { lastScheduledRunAt: new Date() } },
      { upsert: true }
    );

    return res;
  }

  static async runScheduledEvaluationForAllBusinesses(options?: {
    maxBusinesses?: number;
    maxDurationMs?: number;
  }): Promise<ScheduledBatchSummary> {
    const startedAt = new Date();
    const maxLimit = options?.maxBusinesses ?? 20;
    const timeBudgetMs = options?.maxDurationMs ?? 48000;

    const allActive = await Business.find({ status: "active", isDeleted: false }).lean();
    const settings = await AutomationSchedulerSetting.find({
      businessId: { $in: allActive.map((b) => b._id) },
    }).lean();

    const settingMap = new Map(settings.map((s) => [String(s.businessId), s]));

    // Prioritize businesses with oldest (or no) lastScheduledRunAt to prevent starvation & ensure clean batch resumption
    allActive.sort((a, b) => {
      const tA = settingMap.get(String(a._id))?.lastScheduledRunAt ? new Date(settingMap.get(String(a._id))!.lastScheduledRunAt!).getTime() : 0;
      const tB = settingMap.get(String(b._id))?.lastScheduledRunAt ? new Date(settingMap.get(String(b._id))!.lastScheduledRunAt!).getTime() : 0;
      return tA - tB;
    });

    const batchSlice = allActive.slice(0, maxLimit);
    const businessResults: ScheduledBatchSummary["businessResults"] = [];
    const skippedOrFailed: ScheduledBatchSummary["skippedOrFailed"] = [];
    let totalRulesEvaluated = 0, totalEventsGenerated = 0, resumptionPending = false;

    for (const biz of batchSlice) {
      if (Date.now() - startedAt.getTime() > timeBudgetMs) {
        resumptionPending = true;
        skippedOrFailed.push({
          businessId: String(biz._id),
          reason: "Serverless execution time budget reached; safely queued for next batch resumption",
        });
        break;
      }

      const bizSetting = settingMap.get(String(biz._id));
      if (bizSetting && bizSetting.enabled === false) {
        skippedOrFailed.push({
          businessId: String(biz._id),
          reason: "Scheduled automation is disabled by business owner (SKIPPED_DISABLED)",
        });
        await AutomationSchedulerSetting.updateOne(
          { businessId: biz._id },
          { $set: { lastScheduledRunAt: new Date() } },
          { upsert: true }
        );
        continue;
      }

      try {
        const res = await this.runScheduledEvaluation({ businessId: biz._id });
        if (res.status === ("SKIPPED_DISABLED" as any)) {
          skippedOrFailed.push({
            businessId: String(biz._id),
            reason: "Scheduled automation is disabled by business owner (SKIPPED_DISABLED)",
          });
          continue;
        }

        totalRulesEvaluated += res.rulesEvaluated;
        totalEventsGenerated += res.eventsGenerated;

        businessResults.push({
          businessId: String(biz._id),
          businessName: biz.name || "Business",
          status: res.status,
          rulesEvaluated: res.rulesEvaluated,
          eventsGenerated: res.eventsGenerated,
          errorsCount: res.errors.length,
        });
      } catch (err: any) {
        skippedOrFailed.push({ businessId: String(biz._id), reason: err?.message || String(err) });
      }
    }

    const completedAt = new Date();
    const hardFailures = skippedOrFailed.filter(
      (s) => !s.reason.includes("(SKIPPED_DISABLED)") && !s.reason.includes("budget reached")
    );
    const allDisabled =
      batchSlice.length > 0 &&
      skippedOrFailed.length === batchSlice.length &&
      hardFailures.length === 0;

    const status: ScheduledBatchSummary["status"] = allDisabled
      ? "SKIPPED_DISABLED"
      : hardFailures.length === 0 && businessResults.length > 0
      ? "SUCCESS"
      : businessResults.length > 0 && hardFailures.length > 0
      ? "PARTIAL_SUCCESS"
      : hardFailures.length > 0
      ? "FAILED"
      : "SUCCESS";

    return {
      status,
      startedAt,
      completedAt,
      totalBusinessesEvaluated: businessResults.length,
      totalRulesEvaluated,
      totalEventsGenerated,
      resumptionPending,
      businessResults,
      skippedOrFailed,
    };
  }
}
