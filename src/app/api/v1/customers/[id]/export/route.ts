import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { requireAuth } from "@/lib/auth/session";
import { CustomerProfileService } from "@/services/customer/CustomerProfileService";
import { CustomerExportService } from "@/services/customer/CustomerExportService";
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

  // STRICT SECURITY: Financial export statements cannot be accessed by sales staff or deliverymen
  if (user.role === "sales_staff" || user.role === "salesman" || user.role === "deliveryman") {
    return errorResponse("Forbidden: Financial statements cannot be exported by sales or delivery staff", 403);
  }

  const { id } = await params;
  const section = (req.nextUrl.searchParams.get("section") as any) || "all";
  const format = req.nextUrl.searchParams.get("format") || "csv";

  try {
    await connectDB();

    if (format === "xlsx" || format === "excel") {
      const { filename, buffer } = await CustomerExportService.generateExcelWorkbook(id, section);
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    if (format === "pdf") {
      const { filename, buffer } = await CustomerExportService.generatePdfDocument(id, section);
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

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
