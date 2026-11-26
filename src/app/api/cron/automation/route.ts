import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { AutomationSchedulerService } from "@/services/automation/AutomationSchedulerService";
import { AutomationSchedulerSetting } from "@/models/AutomationSchedulerSetting";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60 seconds bounded execution limit for serverless cron

/**
 * Validates the Vercel Cron Authorization header in constant time.
 * Returns true only if CRON_SECRET is configured on the server and matches exactly.
 */
export function validateCronSecret(authHeader: string | null): { valid: boolean; error?: string; status: number } {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.trim() === "") {
    return { valid: false, error: "CRON_SECRET is not configured on the server", status: 500 };
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { valid: false, error: "Missing or malformed Authorization header", status: 401 };
  }

  const token = authHeader.substring(7).trim();
  const tokenBuf = Buffer.from(token);
  const secretBuf = Buffer.from(secret);

  if (tokenBuf.length !== secretBuf.length) {
    return { valid: false, error: "Unauthorized scheduler request", status: 401 };
  }

  const match = crypto.timingSafeEqual(tokenBuf, secretBuf);
  if (!match) {
    return { valid: false, error: "Unauthorized scheduler request", status: 401 };
  }

  return { valid: true, status: 200 };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const auth = validateCronSecret(authHeader);

  if (!auth.valid) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    );
  }

  try {
    await connectDB();
    const searchParams = req.nextUrl.searchParams;
    const specificBusinessId = searchParams.get("businessId");
    const startTime = Date.now();

    if (specificBusinessId) {
      // Check setting before starting scheduled evaluation
      const setting = await AutomationSchedulerSetting.findOne({
        businessId: specificBusinessId,
      }).lean();

      if (setting && setting.enabled === false) {
        return NextResponse.json({
          success: true,
          status: "SKIPPED_DISABLED",
          scheduledAt: new Date(),
          businessesEvaluated: 0,
          rulesEvaluated: 0,
          alertsDetected: 0,
          message: "Scheduled automation is disabled for this business",
          durationMs: Date.now() - startTime,
        });
      }

      const singleRun = await AutomationSchedulerService.runScheduledEvaluation({
        businessId: specificBusinessId,
      });

      return NextResponse.json({
        success: singleRun.status !== "FAILED",
        status: singleRun.status,
        scheduledAt: singleRun.startedAt,
        businessesEvaluated: singleRun.status === ("SKIPPED_DISABLED" as any) ? 0 : 1,
        rulesEvaluated: singleRun.rulesEvaluated,
        alertsDetected: singleRun.eventsGenerated,
        durationMs: Date.now() - startTime,
        message:
          singleRun.status === ("SKIPPED_DISABLED" as any)
            ? "Scheduled automation is disabled for this business"
            : undefined,
      });
    }

    const batchSummary = await AutomationSchedulerService.runScheduledEvaluationForAllBusinesses({
      maxBusinesses: 20, // bounded batch limit to respect function execution window
    });

    return NextResponse.json({
      success: batchSummary.status !== "FAILED",
      status: batchSummary.status,
      scheduledAt: batchSummary.startedAt,
      businessesEvaluated: batchSummary.totalBusinessesEvaluated,
      rulesEvaluated: batchSummary.totalRulesEvaluated,
      alertsDetected: batchSummary.totalEventsGenerated,
      skippedOrLockedCount: batchSummary.skippedOrFailed.length,
      resumptionPending: batchSummary.resumptionPending || false,
      durationMs: Date.now() - startTime,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: "Scheduled automation execution failed" },
      { status: 500 }
    );
  }
}
