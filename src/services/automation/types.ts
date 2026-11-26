import mongoose from "mongoose";
import type { AutomationCategory, AutomationSeverity } from "@/models/AutomationRule";
import type { AutomationEventStatus } from "@/models/AutomationEvent";
import type { AutomationTriggerSource, AutomationExecutionStatus } from "@/models/AutomationExecution";

export type { AutomationCategory, AutomationSeverity, AutomationEventStatus, AutomationTriggerSource, AutomationExecutionStatus };

export interface DetectedCondition {
  ruleKey: string;
  category: AutomationCategory;
  severity: AutomationSeverity;
  title: string;
  message: string;
  sourceEntityType: string;
  sourceEntityId?: string;
  dealershipId?: string;
  deduplicationKey: string;
  metadata?: Record<string, any>;
}

export interface DetectorResult {
  ruleKey: string;
  category: AutomationCategory;
  status: "CONFIGURED" | "NOT_CONFIGURED" | "DISABLED" | "EVALUATED";
  conditions: DetectedCondition[];
  evaluatedCount: number;
  unconfiguredReason?: string;
}

export interface RuleDefinition {
  ruleKey: string;
  category: AutomationCategory;
  name: string;
  description: string;
  defaultSeverity: AutomationSeverity;
  defaultConfig: Record<string, any>;
  isConfigured: boolean;
  unconfiguredReason?: string;
}

export interface EngineRunParams {
  businessId: string | mongoose.Types.ObjectId;
  dealershipId?: string | mongoose.Types.ObjectId;
  category?: AutomationCategory;
  ruleKeys?: string[];
  dryRun?: boolean;
  triggeredBy?: AutomationTriggerSource;
  userId?: string | mongoose.Types.ObjectId;
}

export interface EngineRunResult {
  executionKey: string;
  status: AutomationExecutionStatus;
  startedAt: Date;
  completedAt: Date;
  rulesEvaluated: number;
  eventsGenerated: number;
  newEvents: DetectedCondition[];
  errors: Array<{ ruleKey: string; error: string }>;
}
