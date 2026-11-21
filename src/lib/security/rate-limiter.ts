import { RateLimit } from "@/models/RateLimit";
import { connectDB } from "../db/connect";

export async function checkRateLimit(params: {
  key: string;
  maxHits: number;
  windowMs?: number;
  failClosed?: boolean;
}): Promise<{ allowed: boolean; remaining: number }> {
  const windowMs = params.windowMs ?? 60000;
  const windowId = Math.floor(Date.now() / windowMs);
  const expireAt = new Date((windowId + 2) * windowMs);

  await connectDB();

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await RateLimit.findOneAndUpdate(
        { key: params.key, windowId },
        {
          $inc: { hits: 1 },
          $setOnInsert: { expireAt },
        },
        { upsert: true, new: true }
      );

      const allowed = result.hits <= params.maxHits;
      return { allowed, remaining: Math.max(0, params.maxHits - result.hits) };
    } catch (err: any) {
      if (err.code === 11000 && attempt === 0) {
        // Race condition: another concurrent serverless container upserted first!
        // Immediately retry as an atomic update on the existing document.
        continue;
      }
      // Outage behavior
      if (params.failClosed) {
        return { allowed: false, remaining: 0 };
      }
      return { allowed: true, remaining: 1 };
    }
  }
  return { allowed: false, remaining: 0 };
}
