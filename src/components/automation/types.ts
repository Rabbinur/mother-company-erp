import type { IAutomationEvent } from "@/models/AutomationEvent";
import type { IAutomationRule } from "@/models/AutomationRule";
import type { IAutomationExecution } from "@/models/AutomationExecution";

export interface AutomationDashboardData {
  openCount: number;
  criticalCount: number;
  activeRulesCount: number;
  lastExecution?: IAutomationExecution | null;
  events: IAutomationEvent[];
  rules: IAutomationRule[];
  executions: IAutomationExecution[];
}
