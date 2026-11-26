import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { requireAuth } from "@/lib/auth/session";
import { ReturnsService } from "@/services/ReturnsService";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  if (!hasPermission(user.role, user.permissions, PERMISSIONS.CLAIMS_VIEW)) {
    return forbiddenResponse("Permission denied: cannot view claims");
  }

  const businessId = user.businessId;
  if (!businessId) return errorResponse("Business context required", 400);

  const url = req.nextUrl;
  const status = url.searchParams.get("status") || undefined;
  const claimCategory = url.searchParams.get("category") || undefined;
  const requestedDealership = url.searchParams.get("dealershipId");
  const isSuperOrOwner = user.role === "super_admin" || user.role === "owner";
  const dealershipId = isSuperOrOwner
    ? requestedDealership || user.dealershipId || undefined
    : user.dealershipId || user.activeDealershipId;

  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = parseInt(url.searchParams.get("limit") || "20", 10);

  await connectDB();

  try {
    const result = await ReturnsService.listClaims({
      businessId,
      dealershipId,
      status,
      claimCategory,
      page,
      limit,
    });
    return successResponse(result, "Claims retrieved successfully");
  } catch (err: any) {
    return errorResponse(err.message || "Failed to list claims", 500);
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  if (!hasPermission(user.role, user.permissions, PERMISSIONS.CLAIMS_CREATE)) {
    return forbiddenResponse("Permission denied: cannot create claims");
  }

  const businessId = user.businessId;
  if (!businessId) return errorResponse("Business context required", 400);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON payload", 400);
  }

  const isSuperOrOwner = user.role === "super_admin" || user.role === "owner";
  const dealershipId = isSuperOrOwner
    ? body.dealershipId || user.dealershipId || user.activeDealershipId
    : user.dealershipId || user.activeDealershipId;

  if (!dealershipId || !body.claimCategory || !body.referenceType || !body.claimedAmount) {
    return errorResponse("dealershipId, claimCategory, referenceType, and claimedAmount are required", 400);
  }

  await connectDB();

  try {
    const claim = await ReturnsService.createClaim({
      businessId,
      dealershipId,
      claimCategory: body.claimCategory,
      referenceType: body.referenceType,
      referenceId: body.referenceId,
      referenceDocId: body.referenceDocId,
      principalCompanyId: body.principalCompanyId,
      vendorId: body.vendorId,
      items: body.items,
      claimedAmount: Number(body.claimedAmount),
      reason: body.reason || "Operational claim",
      calculationBasis: body.calculationBasis,
      evidenceAttachments: body.evidenceAttachments,
      actorId: user.userId,
    });

    return successResponse(claim, "Claim submitted successfully", undefined, 201);
  } catch (err: any) {
    return errorResponse(err.message || "Failed to create claim", 400);
  }
}
