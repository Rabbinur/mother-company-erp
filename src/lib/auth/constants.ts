/**
 * System migration deployment timestamp and legacy token grace cutoff definitions.
 * Anchors the transition window deterministically.
 */
export const SYSTEM_MIGRATION_DEPLOYED_AT = new Date("2026-11-21T00:00:00Z");
export const LEGACY_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000; // Exactly 24 Hours
export const LEGACY_CUTOFF_TIMESTAMP = new Date(
  SYSTEM_MIGRATION_DEPLOYED_AT.getTime() + LEGACY_GRACE_PERIOD_MS
);
