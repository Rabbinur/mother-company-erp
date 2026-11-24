import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { GoodsReceiptNoteService } from "@/services/GoodsReceiptNoteService";
import { requireAuth } from "@/lib/auth/session";
import {
  successResponse,
  unauthorizedResponse,
  errorResponse,
} from "@/lib/utils/api-response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { id } = await params;
  await connectDB();

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return errorResponse("No file provided in form-data field 'file'", 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const updated = await GoodsReceiptNoteService.attachDocument({
      grnId: id,
      fileBuffer: buffer,
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      actorId: user.userId,
    });

    return successResponse({
      message: "Challan document uploaded successfully",
      document: updated.document,
      status: updated.status,
    });
  } catch (err: any) {
    return errorResponse(err.message || "Failed to upload challan document", 400);
  }
}
