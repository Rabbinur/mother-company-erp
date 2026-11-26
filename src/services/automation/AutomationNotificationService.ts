import mongoose from "mongoose";
import { Notification } from "@/models/Notification";
import type { IAutomationEvent } from "@/models/AutomationEvent";

export class AutomationNotificationService {
  static async dispatchNotification(event: IAutomationEvent): Promise<void> {
    // Only dispatch system notifications for HIGH and CRITICAL alerts
    if (event.severity !== "HIGH" && event.severity !== "CRITICAL") {
      return;
    }

    let notificationType:
      | "low_stock"
      | "out_of_stock"
      | "credit_limit_reached"
      | "system" = "system";

    if (event.ruleKey === "LOW_STOCK") {
      notificationType = "low_stock";
    } else if (event.ruleKey === "STOCKOUT") {
      notificationType = "out_of_stock";
    } else if (event.ruleKey === "CREDIT_LIMIT_EXCEEDED" || event.ruleKey === "CREDIT_UTILIZATION_WARNING") {
      notificationType = "credit_limit_reached";
    }

    try {
      await Notification.create({
        title: `[${event.severity}] ${event.title}`,
        message: event.message,
        type: notificationType,
        targetRole: event.category === "FINANCIAL" ? "accountant" : "manager",
        isRead: false,
        link: `/automation?eventId=${event._id}`,
      });
    } catch {
      // Safe catch: failure to deliver in-app notification must not disrupt automation evaluation
    }
  }
}
