import mongoose from "mongoose";
import { AutomationRule } from "@/models/AutomationRule";
import type { IAutomationRule, AutomationCategory } from "@/models/AutomationRule";
import { DEFAULT_AUTOMATION_RULES } from "./defaultRules";

export class AutomationRuleService {
  static async ensureDefaultRules(businessId: string | mongoose.Types.ObjectId): Promise<void> {
    const bId = new mongoose.Types.ObjectId(String(businessId));
    const existing = await AutomationRule.find({ businessId: bId }).lean();
    const existingKeys = new Set(existing.map((r) => r.ruleKey));

    const toInsert = DEFAULT_AUTOMATION_RULES.filter((d) => !existingKeys.has(d.ruleKey)).map((d) => ({
      businessId: bId,
      dealershipId: null,
      ruleKey: d.ruleKey,
      category: d.category,
      name: d.name,
      description: d.description,
      enabled: d.isConfigured, // default to enabled if configured
      severity: d.defaultSeverity,
      configuration: d.defaultConfig,
      isConfigured: d.isConfigured,
      unconfiguredReason: d.unconfiguredReason,
    }));

    if (toInsert.length > 0) {
      await AutomationRule.insertMany(toInsert, { ordered: false }).catch(() => {
        // Safe catch for potential concurrent insertion race
      });
    }
  }

  static async getRules(params: {
    businessId: string | mongoose.Types.ObjectId;
    dealershipId?: string | mongoose.Types.ObjectId;
    category?: AutomationCategory;
  }): Promise<IAutomationRule[]> {
    const { businessId, dealershipId, category } = params;
    await this.ensureDefaultRules(businessId);

    const query: Record<string, any> = { businessId: new mongoose.Types.ObjectId(String(businessId)) };
    if (dealershipId) query.dealershipId = new mongoose.Types.ObjectId(String(dealershipId));
    if (category) query.category = category;

    return AutomationRule.find(query).sort({ category: 1, name: 1 });
  }

  static async updateRule(params: {
    businessId: string | mongoose.Types.ObjectId;
    ruleKey: string;
    dealershipId?: string | mongoose.Types.ObjectId;
    enabled?: boolean;
    severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    configuration?: Record<string, any>;
    userId?: string | mongoose.Types.ObjectId;
  }): Promise<IAutomationRule | null> {
    const { businessId, ruleKey, dealershipId, enabled, severity, configuration, userId } = params;
    const bId = new mongoose.Types.ObjectId(String(businessId));
    const dId = dealershipId ? new mongoose.Types.ObjectId(String(dealershipId)) : null;

    const filter: Record<string, any> = { businessId: bId, ruleKey, dealershipId: dId };
    const updates: Record<string, any> = {};
    if (typeof enabled === "boolean") updates.enabled = enabled;
    if (severity) updates.severity = severity;
    if (configuration) updates.configuration = configuration;
    if (userId) updates.updatedBy = new mongoose.Types.ObjectId(String(userId));

    return AutomationRule.findOneAndUpdate(filter, { $set: updates }, { new: true });
  }
}
