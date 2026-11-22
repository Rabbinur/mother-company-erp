/**
 * Safe Environment and Secrets Masking Utilities
 * Project: Dealership Management (Mother Company ERP)
 */

import { MIGRATION_MODES, type MigrationMode } from "./constants";

/**
 * Safely masks passwords and credentials in MongoDB connection URIs
 * Example: mongodb+srv://admin:secret123@cluster0.abc.mongodb.net/erp -> mongodb+srv://admin:***@cluster0.abc.mongodb.net/erp
 */
export function maskMongoUri(uri: string | undefined | null): string {
  if (!uri || typeof uri !== "string") {
    return "[NOT_CONFIGURED]";
  }

  // Regex to match credentials in mongodb:// or mongodb+srv:// URIs
  // Captures: protocol, username, password, rest of URI
  return uri.replace(
    /^(mongodb(?:\+srv)?:\/\/)([^:@\s]+):([^@\s]+)@/i,
    (_match, protocol, username) => `${protocol}${username}:***@`
  );
}

/**
 * Detects whether a MongoDB URI points to a remote cluster (Atlas, external host)
 * vs a safe local test fixture (127.0.0.1, localhost, memory).
 */
export function isRemoteClusterUri(uri: string | undefined | null): boolean {
  if (!uri || typeof uri !== "string") {
    return false;
  }

  const lower = uri.toLowerCase();

  // Atlas SRV protocol is always remote
  if (lower.startsWith("mongodb+srv://")) {
    return true;
  }

  // Known Atlas or external domain markers
  if (lower.includes(".mongodb.net") || lower.includes(".aws.") || lower.includes(".azure.") || lower.includes(".gcp.")) {
    return true;
  }

  // Safe local patterns
  if (
    lower.includes("localhost") ||
    lower.includes("127.0.0.1") ||
    lower.includes("::1") ||
    lower.includes("memory")
  ) {
    return false;
  }

  // Any other external hostname is considered remote
  return true;
}

/**
 * Validates and normalizes migration mode string
 */
export function validateMigrationMode(rawMode: string | undefined | null): MigrationMode {
  if (!rawMode) {
    return "inspection";
  }

  const normalized = rawMode.toLowerCase().trim();
  if (MIGRATION_MODES.includes(normalized as MigrationMode)) {
    return normalized as MigrationMode;
  }

  throw new Error(
    `Invalid migration mode '${rawMode}'. Must be one of: ${MIGRATION_MODES.join(", ")}`
  );
}
