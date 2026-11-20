import { AuditLog } from "@/models/AuditLog";
import mongoose from "mongoose";

export interface LogParams {
  actorId?: string | mongoose.Types.ObjectId;
  actorEmail?: string;
  actorName?: string;
  action: string;
  entityType: string;
  entityId?: string;
  beforeSnapshot?: Record<string, unknown>;
  afterSnapshot?: Record<string, unknown>;
  source?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

export class AuditService {
  static async log(params: LogParams): Promise<void> {
    try {
      await AuditLog.create({
        actorId: params.actorId
          ? new mongoose.Types.ObjectId(String(params.actorId))
          : undefined,
        actorEmail: params.actorEmail,
        actorName: params.actorName,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        beforeSnapshot: params.beforeSnapshot,
        afterSnapshot: params.afterSnapshot,
        source: params.source || "dashboard",
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        requestId: params.requestId,
      });
    } catch (err) {
      // Do not let audit log failure crash the primary business transaction
      console.error("[AuditService.log] Failed to write audit record:", err);
    }
  }
}
