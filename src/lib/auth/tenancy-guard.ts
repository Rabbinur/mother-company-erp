import crypto from "crypto";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { User, type IUser } from "@/models/User";
import { Business, type IBusiness } from "@/models/Business";
import { Dealership, type IDealership } from "@/models/Dealership";
import { DealershipMembership, type IDealershipMembership } from "@/models/DealershipMembership";
import { SupportTicket } from "@/models/SupportTicket";
import { AuditLog } from "@/models/AuditLog";
import type { TokenPayload } from "./jwt";
import { LEGACY_CUTOFF_TIMESTAMP, SYSTEM_MIGRATION_DEPLOYED_AT } from "./constants";

export interface IAuthoritativeTenancyContext {
  user: IUser;
  business: IBusiness;
  dealership: IDealership;
  membership?: IDealershipMembership;
  role: string;
  isOwner: boolean;
  isEmergencyReadOnly: boolean;
}

export class TenancySecurityError extends Error {
  statusCode: number;
  code: string;
  constructor(message: string, statusCode = 403, code = "TENANCY_FORBIDDEN") {
    super(message);
    this.name = "TenancySecurityError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

const SUPPORT_ROUTE_ALLOWLIST = [
  /^\/api\/v1\/orders(\/.*)?$/,
  /^\/api\/v1\/inventory(\/.*)?$/,
  /^\/api\/v1\/reports(\/.*)?$/,
  /^\/api\/v1\/audit-logs(\/.*)?$/,
  /^\/api\/v1\/products(\/.*)?$/,
];

/**
 * Generates a valid HMAC emergency access token for testing or authorized generation.
 */
export function generateHmacToken(ticketId: string, businessId: string, expiresAt: Date): string {
  const hmacSecret = process.env.SUPPORT_HMAC_SECRET || "mother_erp_support_hmac_default_secret_key_2026";
  const payload = `${ticketId}:${businessId}:${expiresAt.getTime()}`;
  const signature = crypto.createHmac("sha256", hmacSecret).update(payload).digest("hex");
  return `${ticketId}.${expiresAt.getTime()}.${signature}`;
}

/**
 * Authoritatively verifies emergency access HMAC token.
 * Token structure: ticketId.expiresAt.signature
 * Enforces format validation, equal-length checks, and constant-time timingSafeEqual.
 */
export function verifyHmacToken(rawToken: string, expectedBusinessId: string): { ticketId: string; expiresAt: Date } {
  if (!rawToken || typeof rawToken !== "string") {
    throw new TenancySecurityError(
      "Emergency access authorization failed: missing or invalid token",
      403,
      "INVALID_TOKEN_FORMAT"
    );
  }

  const parts = rawToken.split(".");
  if (parts.length !== 3) {
    throw new TenancySecurityError(
      "Emergency access authorization failed: malformed token structure",
      403,
      "INVALID_TOKEN_FORMAT"
    );
  }

  const [ticketId, expiresAtStr, signature] = parts;

  if (!ticketId || !ticketId.trim() || !expiresAtStr || !signature) {
    throw new TenancySecurityError(
      "Emergency access authorization failed: incomplete token payload",
      403,
      "INVALID_TOKEN_FORMAT"
    );
  }

  const hmacSecret = process.env.SUPPORT_HMAC_SECRET || "mother_erp_support_hmac_default_secret_key_2026";
  const payload = `${ticketId}:${expectedBusinessId}:${expiresAtStr}`;
  const expectedSignature = crypto.createHmac("sha256", hmacSecret).update(payload).digest("hex");

  const sigBuf = Buffer.from(signature, "utf-8");
  const expBuf = Buffer.from(expectedSignature, "utf-8");

  // Constant-time comparison strictly guarded by length check to prevent RangeError
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new TenancySecurityError(
      "Emergency access authorization failed: invalid token signature",
      403,
      "INVALID_TOKEN_SIGNATURE"
    );
  }

  const expiresAt = new Date(Number(expiresAtStr));
  if (isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
    throw new TenancySecurityError(
      "Emergency access authorization failed: token has expired",
      403,
      "TOKEN_EXPIRED"
    );
  }

  return { ticketId, expiresAt };
}

function canonicalizePath(rawPath: string): string {
  let decoded = decodeURIComponent(rawPath);
  if (decoded.includes("..") || decoded.includes("//")) {
    throw new TenancySecurityError("Malformed URI path segment detected", 400, "MALFORMED_URI");
  }
  return decoded.toLowerCase();
}

export async function assertDealershipAccess(params: {
  tokenPayload: TokenPayload;
  httpMethod: string;
  requestPath: string;
  headers: Record<string, string | undefined>;
  requestedDealershipId?: string;
  clientIp?: string;
  userAgent?: string;
}): Promise<IAuthoritativeTenancyContext> {
  await connectDB();

  // Strip method override headers
  if (params.headers["x-http-method-override"] || params.headers["x-method-override"]) {
    throw new TenancySecurityError("HTTP method override headers are strictly prohibited", 400, "METHOD_OVERRIDE_PROHIBITED");
  }

  const isMutation = params.httpMethod !== "GET" && params.httpMethod !== "HEAD";
  const canonicalPath = canonicalizePath(params.requestPath);

  // 1. Authoritative DB User Verification
  const user = await User.findOne({ _id: params.tokenPayload.userId, isDeleted: { $ne: true } });
  if (!user || user.status !== "active") {
    throw new TenancySecurityError("User account is inactive, suspended, or deleted", 401, "ACCOUNT_INACTIVE");
  }

  // 2. Strict Database tokenVersion Integrity
  if (typeof user.tokenVersion !== "number" || isNaN(user.tokenVersion)) {
    throw new TenancySecurityError("User security profile corrupted. Administrative repair required", 401, "USER_SECURITY_PROFILE_CORRUPTED");
  }

  // 3. Dual Issuance & Server-Time Legacy Token Validation
  const tokenIatMs = (params.tokenPayload.iat ?? 0) * 1000;
  if (!tokenIatMs || tokenIatMs > Date.now() + 60000) {
    throw new TenancySecurityError("Token issuance timestamp (iat) is invalid or in the future", 401, "INVALID_IAT");
  }

  if (params.tokenPayload.tokenVersion === undefined) {
    // Must have been issued before migration
    if (tokenIatMs >= SYSTEM_MIGRATION_DEPLOYED_AT.getTime()) {
      throw new TenancySecurityError("Tokens issued after migration must include tokenVersion", 401, "TOKEN_VERSION_MISSING");
    }
    // Must be within 24-hr grace period
    if (Date.now() >= LEGACY_CUTOFF_TIMESTAMP.getTime()) {
      throw new TenancySecurityError("Legacy grace period expired. Re-authentication required", 401, "LEGACY_SESSION_EXPIRED");
    }
    // Legacy mutations rejected immediately
    if (isMutation) {
      throw new TenancySecurityError("Security upgrade requires re-authentication for data modifications", 401, "LEGACY_TOKEN_UPGRADE_REQUIRED");
    }
    if (user.tokenVersion > 1) {
      throw new TenancySecurityError("Session invalidated due to user privilege changes", 401, "SESSION_REVOKED");
    }
  } else {
    // Modern tokenVersion strict comparison
    if (params.tokenPayload.tokenVersion !== user.tokenVersion) {
      throw new TenancySecurityError("Session token version mismatch. Access revoked", 401, "SESSION_REVOKED");
    }
  }

  // 4. Resolve Target Dealership
  if (!params.requestedDealershipId) {
    throw new TenancySecurityError("Explicit dealership context is required", 400, "DEALERSHIP_REQUIRED");
  }

  const dealership = await Dealership.findOne({
    _id: params.requestedDealershipId,
    status: "active",
    isDeleted: false,
  });

  if (!dealership) {
    throw new TenancySecurityError("Dealership not found or inactive", 404, "DEALERSHIP_NOT_FOUND");
  }

  // 5. Authoritative Business Ownership Verification
  const business = await Business.findOne({
    _id: dealership.businessId,
    status: "active",
    isDeleted: false,
  });

  if (!business) {
    throw new TenancySecurityError("Parent business organization not found or inactive", 404, "BUSINESS_NOT_FOUND");
  }

  // 6. Super Admin Emergency Access Gateway
  const isSuperAdminRole = user.role === "super_admin";
  let isEmergencyReadOnly = false;

  if (isSuperAdminRole) {
    const rawEmergencyToken = params.headers["x-admin-emergency-token"];
    if (!rawEmergencyToken) {
      throw new TenancySecurityError("Super-admin commercial access prohibited without emergency token", 403, "EMERGENCY_AUTH_REQUIRED");
    }

    if (isMutation) {
      throw new TenancySecurityError("Super-admin emergency access is strictly READ-ONLY", 403, "MUTATION_PROHIBITED");
    }

    // Verify route allowlist
    const isAllowedRoute = SUPPORT_ROUTE_ALLOWLIST.some((regex) => regex.test(canonicalPath));
    if (!isAllowedRoute) {
      throw new TenancySecurityError("Route excluded from emergency support allowlist", 403, "ROUTE_NOT_PERMITTED");
    }

    // Cryptographic HMAC token validation
    const { ticketId } = verifyHmacToken(rawEmergencyToken, String(business._id));

    // Database ticket authorization
    const ticket = await SupportTicket.findOne({
      ticketId,
      businessId: business._id,
      status: "approved",
      isRevoked: false,
      expiresAt: { $gt: new Date() },
    });

    if (!ticket) {
      throw new TenancySecurityError("Support ticket not found, expired, or revoked", 403, "TICKET_INVALID");
    }

    // Enforce 2-hour maximum lifetime
    const maxAllowedExpiry = ticket.createdAt.getTime() + 2 * 60 * 60 * 1000;
    if (ticket.expiresAt.getTime() > maxAllowedExpiry) {
      throw new TenancySecurityError("Support ticket lifetime exceeds maximum 2-hour ceiling", 403, "TICKET_LIFETIME_EXCEEDED");
    }

    // Two-person rule: requester cannot be approver
    if (ticket.requestedBy.equals(ticket.approvedBy)) {
      throw new TenancySecurityError("Support ticket violates two-person separation of duty", 403, "TICKET_SEPARATION_VIOLATION");
    }

    isEmergencyReadOnly = true;
  }

  const isOwner = user.role === "owner" && business.ownerId.equals(user._id);

  // 7. Role & Membership Resolution
  let membership: IDealershipMembership | undefined;
  let resolvedRole = user.role;

  if (isEmergencyReadOnly) {
    resolvedRole = "emergency_support_auditor";
  } else if (isOwner) {
    resolvedRole = "owner";
  } else {
    const liveMembership = await DealershipMembership.findOne({
      userId: user._id,
      businessId: business._id,
      dealershipId: dealership._id,
      isDeleted: false,
    });

    if (!liveMembership || liveMembership.status !== "active") {
      throw new TenancySecurityError(`User does not hold an active membership in dealership '${dealership.name}'`, 403, "MEMBERSHIP_REQUIRED");
    }

    membership = liveMembership;
    resolvedRole = liveMembership.role;
  }

  // 8. Fail-Closed Audit Logging
  if (isEmergencyReadOnly || (isOwner && isMutation)) {
    try {
      await AuditLog.create({
        actorId: user._id,
        actorEmail: user.email,
        action: isEmergencyReadOnly ? "EMERGENCY_SUPPORT_READ" : "OWNER_DEALERSHIP_MUTATION",
        entityType: "dealership_boundary",
        entityId: String(dealership._id),
        source: isEmergencyReadOnly ? "emergency_gateway" : "owner_dashboard",
        ipAddress: params.clientIp,
        userAgent: params.userAgent,
        afterSnapshot: {
          businessId: String(business._id),
          dealershipId: String(dealership._id),
          path: canonicalPath,
          role: resolvedRole,
        },
      });
    } catch {
      throw new TenancySecurityError("Security Audit failure: Log write failed. Operation terminated.", 500, "AUDIT_FAILURE");
    }
  }

  return {
    user,
    business,
    dealership,
    membership,
    role: resolvedRole,
    isOwner,
    isEmergencyReadOnly,
  };
}

export interface IAuthoritativeBusinessContext {
  user: IUser;
  business: IBusiness;
  role: string;
  isOwner: boolean;
  isEmergencyReadOnly: boolean;
}

/**
 * Authoritatively verifies access to a business organization.
 * Strictly derives business from server-side authenticated identity and prevents
 * cross-business tampering or unauthorized access.
 */
export async function assertBusinessAccess(params: {
  tokenPayload: TokenPayload;
  httpMethod: string;
  requestPath: string;
  headers: Record<string, string | undefined>;
  requestedBusinessId?: string;
  clientIp?: string;
  userAgent?: string;
}): Promise<IAuthoritativeBusinessContext> {
  await connectDB();

  // Strip method override headers
  if (params.headers["x-http-method-override"] || params.headers["x-method-override"]) {
    throw new TenancySecurityError(
      "HTTP method override headers are strictly prohibited",
      400,
      "METHOD_OVERRIDE_PROHIBITED"
    );
  }

  const isMutation = params.httpMethod !== "GET" && params.httpMethod !== "HEAD";
  const canonicalPath = canonicalizePath(params.requestPath);

  // 1. Authoritative DB User Verification
  const user = await User.findOne({ _id: params.tokenPayload.userId, isDeleted: { $ne: true } });
  if (!user || user.status !== "active") {
    throw new TenancySecurityError("User account is inactive, suspended, or deleted", 401, "ACCOUNT_INACTIVE");
  }

  // 2. Strict Database tokenVersion Integrity
  if (typeof user.tokenVersion !== "number" || isNaN(user.tokenVersion)) {
    throw new TenancySecurityError(
      "User security profile corrupted. Administrative repair required",
      401,
      "USER_SECURITY_PROFILE_CORRUPTED"
    );
  }

  // TokenVersion check
  if (params.tokenPayload.tokenVersion !== undefined && params.tokenPayload.tokenVersion !== user.tokenVersion) {
    throw new TenancySecurityError("Session token version mismatch. Access revoked", 401, "SESSION_REVOKED");
  }

  // 3. Resolve Target Business (Server-side derivation with tampering prevention)
  let business: IBusiness | null = null;
  const isSuperAdminRole = user.role === "super_admin";

  if (isSuperAdminRole) {
    if (!params.requestedBusinessId) {
      throw new TenancySecurityError("Super-admin access requires explicit businessId target", 400, "BUSINESS_REQUIRED");
    }
    business = await Business.findOne({ _id: params.requestedBusinessId, isDeleted: false });
  } else {
    // Determine user's authoritative business
    if (user.businessId) {
      // If client supplied a businessId, it MUST match the user's businessId
      if (params.requestedBusinessId && params.requestedBusinessId !== user.businessId.toString()) {
        throw new TenancySecurityError(
          "Cross-business access strictly prohibited: requested business does not match user business",
          403,
          "CROSS_BUSINESS_FORBIDDEN"
        );
      }
      business = await Business.findOne({ _id: user.businessId, isDeleted: false });
    } else if (user.role === "owner") {
      // Owner without user.businessId set, resolve via Business.ownerId
      business = await Business.findOne({ ownerId: user._id, isDeleted: false });
      if (business && params.requestedBusinessId && params.requestedBusinessId !== business._id.toString()) {
        throw new TenancySecurityError(
          "Cross-business access strictly prohibited: requested business does not belong to owner",
          403,
          "CROSS_BUSINESS_FORBIDDEN"
        );
      }
    }
  }

  if (!business || business.status !== "active") {
    throw new TenancySecurityError("Business organization not found or inactive", 404, "BUSINESS_NOT_FOUND");
  }

  // 4. Super Admin Emergency Access Gateway
  let isEmergencyReadOnly = false;
  if (isSuperAdminRole) {
    const rawEmergencyToken = params.headers["x-admin-emergency-token"];
    if (!rawEmergencyToken) {
      throw new TenancySecurityError("Super-admin commercial access prohibited without emergency token", 403, "EMERGENCY_AUTH_REQUIRED");
    }

    if (isMutation) {
      throw new TenancySecurityError("Super-admin emergency access is strictly READ-ONLY", 403, "MUTATION_PROHIBITED");
    }

    const { ticketId } = verifyHmacToken(rawEmergencyToken, String(business._id));

    const ticket = await SupportTicket.findOne({
      ticketId,
      businessId: business._id,
      status: "approved",
      isRevoked: false,
      expiresAt: { $gt: new Date() },
    });

    if (!ticket) {
      throw new TenancySecurityError("Support ticket not found, expired, or revoked", 403, "TICKET_INVALID");
    }

    isEmergencyReadOnly = true;
  }

  const isOwner = user.role === "owner" && business.ownerId.equals(user._id);
  const resolvedRole = isEmergencyReadOnly ? "emergency_support_auditor" : isOwner ? "owner" : user.role;

  // 5. Audit Logging for mutations or emergency reads
  if (isEmergencyReadOnly || (isOwner && isMutation) || (user.role === "admin" && isMutation)) {
    try {
      await AuditLog.create({
        actorId: user._id,
        actorEmail: user.email,
        action: isEmergencyReadOnly ? "EMERGENCY_SUPPORT_READ" : "BUSINESS_ORGANIZATION_MUTATION",
        entityType: "business_boundary",
        entityId: String(business._id),
        source: isEmergencyReadOnly ? "emergency_gateway" : "business_admin",
        ipAddress: params.clientIp,
        userAgent: params.userAgent,
        afterSnapshot: {
          businessId: String(business._id),
          path: canonicalPath,
          role: resolvedRole,
        },
      });
    } catch {
      throw new TenancySecurityError("Security Audit failure: Log write failed. Operation terminated.", 500, "AUDIT_FAILURE");
    }
  }

  return {
    user,
    business,
    role: resolvedRole,
    isOwner,
    isEmergencyReadOnly,
  };
}
