import { NextRequest } from "next/server";

export function authenticateFieldSales(req: NextRequest): {
  authenticated: boolean;
  error?: string;
} {
  const expectedKey =
    process.env.FIELD_SALES_API_KEY || "fs_live_sec_mother_company_2026_key";
  const expectedSecret =
    process.env.FIELD_SALES_API_SECRET || "fs_live_secret_mother_company_2026_pass";

  // Check custom headers
  const apiKey = req.headers.get("x-api-key");
  const apiSecret = req.headers.get("x-api-secret");

  if (apiKey && apiSecret) {
    if (apiKey === expectedKey && apiSecret === expectedSecret) {
      return { authenticated: true };
    }
    return { authenticated: false, error: "Invalid API credentials" };
  }

  // Check Bearer token (apiKey:apiSecret)
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    if (token === `${expectedKey}:${expectedSecret}` || token === expectedKey) {
      return { authenticated: true };
    }
  }

  return { authenticated: false, error: "Missing API credentials in headers" };
}
