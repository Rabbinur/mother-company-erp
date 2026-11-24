import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { requireAuth } from "@/lib/auth/session";
import { User } from "@/models/User";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const businessId = user.businessId;
  if (!businessId) return errorResponse("Business context required", 400);

  await connectDB();

  try {
    // Deliverymen include delivery_staff, driver, or users with role containing delivery
    const deliverymen = await User.find({
      businessId,
      role: { $in: ["delivery_staff", "driver", "sales_staff", "warehouse_staff"] },
      status: "active",
      isDeleted: false,
    })
      .select("name email phone role avatar")
      .sort({ name: 1 })
      .lean();

    return successResponse(deliverymen, "Delivery staff retrieved successfully");
  } catch (err: any) {
    return errorResponse(err.message || "Failed to list delivery staff", 500);
  }
}
