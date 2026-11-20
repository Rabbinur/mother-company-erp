import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Notification } from "@/models/Notification";
import { getSessionUser } from "@/lib/auth/session";
import {
  successResponse,
  unauthorizedResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return unauthorizedResponse();

  await connectDB();
  const notifications = await Notification.find({
    $or: [
      { targetUserId: session.userId },
      { targetRole: session.role },
      { targetRole: { $exists: false } },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  return successResponse(notifications);
}

export async function PUT(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return unauthorizedResponse();

  await connectDB();
  const body = await req.json().catch(() => ({}));
  const { id } = body;

  if (id) {
    await Notification.findByIdAndUpdate(id, { isRead: true });
  } else {
    // Mark all as read
    await Notification.updateMany(
      {
        $or: [
          { targetUserId: session.userId },
          { targetRole: session.role },
          { targetRole: { $exists: false } },
        ],
      },
      { isRead: true }
    );
  }

  return successResponse(null, "Notification(s) marked as read");
}
