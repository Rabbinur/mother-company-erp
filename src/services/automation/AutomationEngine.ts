import mongoose from "mongoose";
import { AutomationExecution } from "@/models/AutomationExecution";
import { AutomationEvent } from "@/models/AutomationEvent";
import { AutomationRuleService } from "./AutomationRuleService";
import { AutomationDetectionService } from "./AutomationDetectionService";
import { AutomationNotificationService } from "./AutomationNotificationService";
import type { EngineRunParams, EngineRunResult, DetectedCondition } from "./types";

export class AutomationEngine {
  static async run(params: EngineRunParams): Promise<EngineRunResult> {
    const { businessId, dealershipId, category, ruleKeys, dryRun = false, triggeredBy = "MANUAL", userId } = params;
    const bId = new mongoose.Types.ObjectId(String(businessId));
    const dId = dealershipId ? new mongoose.Types.ObjectId(String(dealershipId)) : undefined;

    const executionKey = `EXEC-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const startedAt = new Date();

    let executionRecord: any = null;
    if (!dryRun) {
      executionRecord = await AutomationExecution.create({
        businessId: bId,
        executionKey,
        status: "RUNNING",
        triggeredBy,
        startedAt,
        rulesEvaluated: 0,
        eventsGenerated: 0,
        executionErrors: [],
      });
    }

    const rules = await AutomationRuleService.getRules({ businessId: bId, dealershipId: dId, category });
    const targetRules = ruleKeys && ruleKeys.length > 0 ? rules.filter((r) => ruleKeys.includes(r.ruleKey)) : rules;

    const newConditions: DetectedCondition[] = [];
    const errors: Array<{ ruleKey: string; error: string }> = [];
    let rulesEvaluated = 0;

    for (const rule of targetRules) {
      try {
        const detection = await AutomationDetectionService.detect({ rule, businessId: bId, dealershipId: dId });
        rulesEvaluated += 1;

        if (detection.status === "EVALUATED" && detection.conditions.length > 0) {
          for (const condition of detection.conditions) {
            // Deduplication Check: Look for existing OPEN or ACKNOWLEDGED event
            const existing = await AutomationEvent.findOne({
              businessId: bId,
              deduplicationKey: condition.deduplicationKey,
              status: { $in: ["OPEN", "ACKNOWLEDGED"] },
            }).lean();

            if (!existing) {
              newConditions.push(condition);

              if (!dryRun) {
                const createdEvent = await AutomationEvent.create({
                  businessId: bId,
                  dealershipId: condition.dealershipId ? new mongoose.Types.ObjectId(condition.dealershipId) : null,
                  ruleKey: condition.ruleKey,
                  category: condition.category,
                  severity: condition.severity,
                  title: condition.title,
                  message: condition.message,
                  sourceEntityType: condition.sourceEntityType,
                  sourceEntityId: condition.sourceEntityId,
                  deduplicationKey: condition.deduplicationKey,
                  status: "OPEN",
                  detectedAt: new Date(),
                  metadata: condition.metadata,
                });

                // Dispatch notification for critical/high events
                await AutomationNotificationService.dispatchNotification(createdEvent);
              }
            }
          }
        }
      } catch (err: any) {
        errors.push({ ruleKey: rule.ruleKey, error: err?.message || String(err) });
      }
    }

    const completedAt = new Date();
    const status = errors.length > 0 && rulesEvaluated === 0 ? "FAILED" : "COMPLETED";

    if (executionRecord) {
      await AutomationExecution.findByIdAndUpdate(executionRecord._id, {
        $set: {
          status,
          completedAt,
          rulesEvaluated,
          eventsGenerated: newConditions.length,
          executionErrors: errors,
        },
      });
    }

    return {
      executionKey,
      status,
      startedAt,
      completedAt,
      rulesEvaluated,
      eventsGenerated: newConditions.length,
      newEvents: newConditions,
      errors,
    };
  }
}
