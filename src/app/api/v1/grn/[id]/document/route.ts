import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { connectDB } from "@/lib/db/connect";
import { GoodsReceiptNote } from "@/models/GoodsReceiptNote";
import { requireAuth } from "@/lib/auth/session";
import { unauthorizedResponse, notFoundResponse, forbiddenResponse } from "@/lib/utils/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { id } = await params;
  await connectDB();

  const grn = await GoodsReceiptNote.findById(id).lean();
  if (!grn) return notFoundResponse("GRN not found");

  // Validate tenant authorization: user's business must match
  if (user.role !== "super_admin" && String(grn.businessId) !== String(user.businessId)) {
    return forbiddenResponse("Unauthorized access to document");
  }

  if (!grn.document || !grn.document.path) {
    return notFoundResponse("No document attached to this GRN");
  }

  const absolutePath = path.join(process.cwd(), grn.document.path);
  if (!fs.existsSync(absolutePath)) {
    return notFoundResponse("Document file missing from server storage");
  }

  const fileBuffer = fs.readFileSync(absolutePath);
  const mimeType = grn.document.mimeType || "application/octet-stream";
  const filename = grn.document.originalName || "challan-document";

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": String(fileBuffer.length),
      "Cache-Control": "private, no-cache, no-store, must-revalidate",
    },
  });
}
