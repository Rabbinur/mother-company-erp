import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { requireAuth } from "@/lib/auth/session";
import { Vehicle } from "@/models/Vehicle";
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
    const vehicles = await Vehicle.find({ businessId, status: { $ne: "inactive" } })
      .populate("defaultDriverId", "name phone")
      .sort({ registrationNumber: 1 })
      .lean();

    return successResponse(vehicles, "Vehicles retrieved successfully");
  } catch (err: any) {
    return errorResponse(err.message || "Failed to list vehicles", 500);
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const businessId = user.businessId;
  if (!businessId) return errorResponse("Business context required", 400);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON payload", 400);
  }

  if (!body.registrationNumber) {
    return errorResponse("registrationNumber is required", 400);
  }

  await connectDB();

  try {
    const vehicle = await Vehicle.create({
      registrationNumber: body.registrationNumber.trim().toUpperCase(),
      businessId,
      dealershipId: body.dealershipId || undefined,
      vehicleType: body.vehicleType || "pickup",
      modelName: body.modelName?.trim(),
      capacityWeightKg: Number(body.capacityWeightKg || 0),
      capacityVolumeCft: Number(body.capacityVolumeCft || 0),
      ownership: body.ownership || "owned",
      status: body.status || "active",
      defaultDriverId: body.defaultDriverId || undefined,
      driverName: body.driverName?.trim(),
      driverPhone: body.driverPhone?.trim(),
      notes: body.notes?.trim(),
    });

    return successResponse(vehicle, "Vehicle created successfully", undefined, 201);
  } catch (err: any) {
    return errorResponse(err.message || "Failed to create vehicle", 400);
  }
}
