import mongoose from "mongoose";
import { AutomationEngine } from "./AutomationEngine";
import type { EngineRunResult } from "./types";

export class AutomationSchedulerService {
  static async runScheduledEvaluation(params: {
    businessId: string | mongoose.Types.ObjectId;
    dealershipId?: string | mongoose.Types.ObjectId;
  }): Promise<EngineRunResult> {
    return AutomationEngine.run({
      businessId: params.businessId,
      dealershipId: params.dealershipId,
      triggeredBy: "SCHEDULED",
    });
  }
}
