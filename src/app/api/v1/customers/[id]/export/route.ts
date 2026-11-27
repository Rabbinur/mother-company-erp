import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { requireAuth } from "@/lib/auth/session";
import { CustomerProfileService } from "@/services/customer/CustomerProfileService";
import {
  errorResponse,
  unauthorizedResponse,
} from "@/lib/utils/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { id } = await params;
  const section = (req.nextUrl.searchParams.get("section") as any) || "all";

  try {
    await connectDB();
    const { filename, csvContent } = await CustomerProfileService.generateCsvExport(id, section);

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to export profile data";
    return errorResponse(msg, 500);
  }
}
