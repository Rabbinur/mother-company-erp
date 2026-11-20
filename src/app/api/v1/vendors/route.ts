import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Vendor } from "@/models/Vendor";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { AuditService } from "@/services/AuditService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.VENDORS_VIEW
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  await connectDB();
  const searchParams = req.nextUrl.searchParams;
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  const query: Record<string, unknown> = {};
  if (status) query.status = status;
  if (search) {
    query.$or = [
      { companyName: { $regex: search, $options: "i" } },
      { name: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;
  const [vendors, total] = await Promise.all([
    Vendor.find(query)
      .sort({ companyName: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Vendor.countDocuments(query),
  ]);

  return successResponse(vendors, "Vendors retrieved", {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(req: NextRequest) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.VENDORS_CREATE
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  try {
    await connectDB();
    const body = await req.json();
    const {
      name,
      companyName,
      phone,
      email,
      address,
      contactPerson,
      taxVatNumber,
      openingBalance,
      notes,
    } = body;

    if (!name || !companyName || !phone) {
      return errorResponse("Contact Name, Company Name, and Phone are required", 400);
    }

    const cleanPhone = String(phone).trim();
    const existing = await Vendor.findOne({ phone: cleanPhone });
    if (existing) {
      return errorResponse(`A vendor with phone '${cleanPhone}' already exists`, 400);
    }

    const initialOpening = Number(openingBalance || 0);

    const vendor = await Vendor.create({
      name,
      companyName,
      phone: cleanPhone,
      email,
      address,
      contactPerson,
      taxVatNumber,
      openingBalance: initialOpening,
      currentPayable: initialOpening,
      status: "active",
      notes,
    });

    await AuditService.log({
      actorId: user.userId,
      actorEmail: user.email,
      action: "VENDOR_CREATED",
      entityType: "vendor",
      entityId: String(vendor._id),
      afterSnapshot: { companyName, name, phone: cleanPhone, openingBalance },
    });

    return successResponse(vendor, "Vendor created successfully", undefined, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create vendor";
    return errorResponse(msg, 500);
  }
}
