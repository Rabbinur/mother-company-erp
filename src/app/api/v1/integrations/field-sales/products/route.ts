import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { authenticateFieldSales } from "@/lib/security/field-sales-auth";
import { FieldSalesService } from "@/services/FieldSalesService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const auth = authenticateFieldSales(req);
  if (!auth.authenticated) {
    return unauthorizedResponse(auth.error || "Invalid Field Sales API credentials");
  }

  try {
    await connectDB();
    const catalog = await FieldSalesService.getCatalog();
    return successResponse(catalog, "Field Sales catalog retrieved");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load product catalog";
    return errorResponse(msg, 500);
  }
}
