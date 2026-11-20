import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { Customer } from "@/models/Customer";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { AuditService } from "@/services/AuditService";
import { generateReferenceCode } from "@/lib/utils";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.CUSTOMERS_VIEW
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  await connectDB();
  const searchParams = req.nextUrl.searchParams;
  const search = searchParams.get("search") || "";
  const district = searchParams.get("district") || "";
  const status = searchParams.get("status") || "";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  const query: Record<string, unknown> = {};
  if (status) query.status = status;
  if (district) query.district = district;
  if (search) {
    query.$or = [
      { shopName: { $regex: search, $options: "i" } },
      { name: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { customerCode: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;
  const [customers, total] = await Promise.all([
    Customer.find(query)
      .sort({ shopName: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Customer.countDocuments(query),
  ]);

  return successResponse(customers, "Customers retrieved", {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(req: NextRequest) {
  const { user, authorized } = await requirePermission(
    req,
    PERMISSIONS.CUSTOMERS_CREATE
  );
  if (!user) return unauthorizedResponse();
  if (!authorized) return forbiddenResponse();

  try {
    await connectDB();
    const body = await req.json();
    const {
      name,
      shopName,
      ownerName,
      phone,
      email,
      address,
      district,
      area,
      gpsCoordinates,
      customerType,
      creditLimit,
      openingBalance,
      notes,
    } = body;

    if (!name || !shopName || !phone) {
      return errorResponse("Customer Name, Shop Name, and Phone are required", 400);
    }

    const cleanPhone = String(phone).trim();
    const existing = await Customer.findOne({ phone: cleanPhone });
    if (existing) {
      return errorResponse(`A customer with phone '${cleanPhone}' already exists`, 400);
    }

    const customerCode = generateReferenceCode(
      "CUST",
      Math.floor(Math.random() * 9000 + 1000)
    );

    const initialOpening = Number(openingBalance || 0);

    const customer = await Customer.create({
      customerCode,
      name,
      shopName,
      ownerName,
      phone: cleanPhone,
      email,
      address,
      district,
      area,
      gpsCoordinates,
      customerType: customerType || "retailer",
      creditLimit: Number(creditLimit || 0),
      openingBalance: initialOpening,
      currentReceivable: initialOpening,
      status: "active",
      notes,
    });

    await AuditService.log({
      actorId: user.userId,
      actorEmail: user.email,
      action: "CUSTOMER_CREATED",
      entityType: "customer",
      entityId: String(customer._id),
      afterSnapshot: { customerCode, shopName, phone: cleanPhone },
    });

    return successResponse(customer, "Customer created successfully", undefined, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create customer";
    return errorResponse(msg, 500);
  }
}
