import mongoose from "mongoose";
import type { IAutomationRule } from "@/models/AutomationRule";
import type { DetectorResult } from "./types";
import { InventoryDetector } from "./detectors/InventoryDetector";
import { CustomerDetector } from "./detectors/CustomerDetector";
import { SupplierDetector } from "./detectors/SupplierDetector";
import { SalesDeliveryDetector } from "./detectors/SalesDeliveryDetector";
import { FinancialDetector } from "./detectors/FinancialDetector";
import { OperationalDetector } from "./detectors/OperationalDetector";

export class AutomationDetectionService {
  static async detect(params: {
    rule: IAutomationRule;
    businessId: mongoose.Types.ObjectId;
    dealershipId?: mongoose.Types.ObjectId;
  }): Promise<DetectorResult> {
    const { rule, businessId, dealershipId } = params;

    if (!rule.enabled) {
      return {
        ruleKey: rule.ruleKey,
        category: rule.category,
        status: "DISABLED",
        conditions: [],
        evaluatedCount: 0,
      };
    }

    if (!rule.isConfigured) {
      return {
        ruleKey: rule.ruleKey,
        category: rule.category,
        status: "NOT_CONFIGURED",
        conditions: [],
        evaluatedCount: 0,
        unconfiguredReason: rule.unconfiguredReason || "Domain lacks underlying data source in database schema.",
      };
    }

    switch (rule.category) {
      case "INVENTORY":
        return InventoryDetector.evaluate({ rule, businessId, dealershipId });
      case "CUSTOMER":
        return CustomerDetector.evaluate({ rule, businessId, dealershipId });
      case "SUPPLIER":
        return SupplierDetector.evaluate({ rule, businessId, dealershipId });
      case "SALES":
        return SalesDeliveryDetector.evaluate({ rule, businessId, dealershipId });
      case "FINANCIAL":
        return FinancialDetector.evaluate({ rule, businessId, dealershipId });
      case "OPERATIONAL":
        return OperationalDetector.evaluate({ rule, businessId, dealershipId });
      default:
        return {
          ruleKey: rule.ruleKey,
          category: rule.category,
          status: "NOT_CONFIGURED",
          conditions: [],
          evaluatedCount: 0,
          unconfiguredReason: `Unknown automation category '${rule.category}'.`,
        };
    }
  }
}
