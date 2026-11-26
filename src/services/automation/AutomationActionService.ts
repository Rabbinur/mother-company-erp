import mongoose from "mongoose";
import { AutomationEvent } from "@/models/AutomationEvent";
import type { IAutomationEvent, AutomationEventStatus } from "@/models/AutomationEvent";

export class AutomationActionService {
  static async acknowledgeEvent(params: {
    eventId: string | mongoose.Types.ObjectId;
    businessId: string | mongoose.Types.ObjectId;
    dealershipId?: string | mongoose.Types.ObjectId;
    userId?: string | mongoose.Types.ObjectId;
  }): Promise<IAutomationEvent | null> {
    const { eventId, businessId, dealershipId, userId } = params;
    const filter: Record<string, any> = {
      _id: new mongoose.Types.ObjectId(String(eventId)),
      businessId: new mongoose.Types.ObjectId(String(businessId)),
      status: "OPEN",
    };
    if (dealershipId) {
      filter.$or = [{ dealershipId: new mongoose.Types.ObjectId(String(dealershipId)) }, { dealershipId: null }];
    }

    return AutomationEvent.findOneAndUpdate(
      filter,
      {
        $set: {
          status: "ACKNOWLEDGED",
          acknowledgedAt: new Date(),
          acknowledgedBy: userId ? new mongoose.Types.ObjectId(String(userId)) : undefined,
        },
      },
      { new: true }
    );
  }

  static async resolveEvent(params: {
    eventId: string | mongoose.Types.ObjectId;
    businessId: string | mongoose.Types.ObjectId;
    dealershipId?: string | mongoose.Types.ObjectId;
    userId?: string | mongoose.Types.ObjectId;
  }): Promise<IAutomationEvent | null> {
    const { eventId, businessId, dealershipId, userId } = params;
    const filter: Record<string, any> = {
      _id: new mongoose.Types.ObjectId(String(eventId)),
      businessId: new mongoose.Types.ObjectId(String(businessId)),
      status: { $in: ["OPEN", "ACKNOWLEDGED"] },
    };
    if (dealershipId) {
      filter.$or = [{ dealershipId: new mongoose.Types.ObjectId(String(dealershipId)) }, { dealershipId: null }];
    }

    return AutomationEvent.findOneAndUpdate(
      filter,
      {
        $set: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          resolvedBy: userId ? new mongoose.Types.ObjectId(String(userId)) : undefined,
        },
      },
      { new: true }
    );
  }

  static async dismissEvent(params: {
    eventId: string | mongoose.Types.ObjectId;
    businessId: string | mongoose.Types.ObjectId;
    dealershipId?: string | mongoose.Types.ObjectId;
    userId?: string | mongoose.Types.ObjectId;
  }): Promise<IAutomationEvent | null> {
    const { eventId, businessId, dealershipId, userId } = params;
    const filter: Record<string, any> = {
      _id: new mongoose.Types.ObjectId(String(eventId)),
      businessId: new mongoose.Types.ObjectId(String(businessId)),
      status: { $in: ["OPEN", "ACKNOWLEDGED"] },
    };
    if (dealershipId) {
      filter.$or = [{ dealershipId: new mongoose.Types.ObjectId(String(dealershipId)) }, { dealershipId: null }];
    }

    return AutomationEvent.findOneAndUpdate(
      filter,
      {
        $set: {
          status: "DISMISSED",
          resolvedAt: new Date(),
          resolvedBy: userId ? new mongoose.Types.ObjectId(String(userId)) : undefined,
        },
      },
      { new: true }
    );
  }

  static async getEvents(params: {
    businessId: string | mongoose.Types.ObjectId;
    dealershipId?: string | mongoose.Types.ObjectId;
    status?: AutomationEventStatus;
    category?: string;
    severity?: string;
    limit?: number;
    skip?: number;
  }): Promise<{ events: IAutomationEvent[]; total: number }> {
    const { businessId, dealershipId, status, category, severity, limit = 50, skip = 0 } = params;
    const query: Record<string, any> = { businessId: new mongoose.Types.ObjectId(String(businessId)) };

    if (dealershipId && dealershipId !== "all") {
      query.dealershipId = new mongoose.Types.ObjectId(String(dealershipId));
    }
    if (status) query.status = status;
    if (category && category !== "ALL") query.category = category;
    if (severity && severity !== "ALL") query.severity = severity;

    const [events, total] = await Promise.all([
      AutomationEvent.find(query).sort({ detectedAt: -1 }).skip(skip).limit(limit),
      AutomationEvent.countDocuments(query),
    ]);

    return { events, total };
  }
}
