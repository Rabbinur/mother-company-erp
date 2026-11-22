/**
 * Phase 2B — Migration Fence Guard & Write-Barrier Integration
 * Project: Dealership Management (Mother Company ERP)
 *
 * Implements coordinator lock verification, TTL lease enforcement, fencing epoch validation,
 * stale coordinator detection, and transactional write-conflict barrier simulation.
 */

import { MIGRATION_LOCK_KEY } from "./constants";

export interface MigrationLockPayload {
  locked: boolean;
  armed?: boolean;
  lockedAt?: Date | string;
  lockHolder?: string;
  leaseExpiresAt?: Date | string;
  fenceEpoch: number;
  txCounter?: number;
}

export interface FenceValidationResult {
  isValid: boolean;
  isArmed: boolean;
  isLocked: boolean;
  isExpired: boolean;
  isStaleEpoch: boolean;
  currentEpoch: number;
  error?: string;
  details?: Record<string, unknown>;
}

export class MigrationLockError extends Error {
  details?: Record<string, unknown>;
  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "MigrationLockError";
    this.details = details;
  }
}

export class StaleCoordinatorError extends Error {
  details?: Record<string, unknown>;
  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "StaleCoordinatorError";
    this.details = details;
  }
}

/**
 * Validates the migration lock state and fencing epoch for a coordinator process.
 */
export function validateMigrationLock(
  lockPayload: MigrationLockPayload | undefined | null,
  coordinatorId: string,
  minExpectedEpoch = 1,
  currentTime: Date = new Date()
): FenceValidationResult {
  if (!lockPayload) {
    return {
      isValid: false,
      isArmed: false,
      isLocked: false,
      isExpired: false,
      isStaleEpoch: false,
      currentEpoch: 0,
      error: `Migration lock document '${MIGRATION_LOCK_KEY}' does not exist`,
    };
  }

  const isLocked = !!lockPayload.locked;
  const isArmed = !!lockPayload.armed || isLocked;
  const currentEpoch = lockPayload.fenceEpoch ?? 0;

  // Check TTL expiration
  let isExpired = false;
  if (lockPayload.leaseExpiresAt) {
    const expiresAt = new Date(lockPayload.leaseExpiresAt);
    if (currentTime.getTime() > expiresAt.getTime()) {
      isExpired = true;
    }
  }

  // Check epoch freshness
  const isStaleEpoch = currentEpoch < minExpectedEpoch;

  // Check lock ownership
  const isHolderMatch = lockPayload.lockHolder === coordinatorId;

  if (!isLocked) {
    return {
      isValid: false,
      isArmed,
      isLocked: false,
      isExpired,
      isStaleEpoch,
      currentEpoch,
      error: "Migration write lock is not currently acquired (locked === false)",
      details: { lockPayload },
    };
  }

  if (isExpired) {
    return {
      isValid: false,
      isArmed,
      isLocked: true,
      isExpired: true,
      isStaleEpoch,
      currentEpoch,
      error: `Migration lock lease expired at ${lockPayload.leaseExpiresAt}`,
      details: { leaseExpiresAt: lockPayload.leaseExpiresAt, currentTime },
    };
  }

  if (isStaleEpoch) {
    return {
      isValid: false,
      isArmed,
      isLocked: true,
      isExpired: false,
      isStaleEpoch: true,
      currentEpoch,
      error: `Coordinator epoch ${minExpectedEpoch} is stale; current cluster epoch is ${currentEpoch}`,
      details: { minExpectedEpoch, currentEpoch },
    };
  }

  if (!isHolderMatch) {
    return {
      isValid: false,
      isArmed,
      isLocked: true,
      isExpired: false,
      isStaleEpoch: false,
      currentEpoch,
      error: `Lock is held by another process: '${lockPayload.lockHolder}' (expected '${coordinatorId}')`,
      details: { lockHolder: lockPayload.lockHolder, coordinatorId },
    };
  }

  return {
    isValid: true,
    isArmed: true,
    isLocked: true,
    isExpired: false,
    isStaleEpoch: false,
    currentEpoch,
  };
}

/**
 * Simulates WiredTiger transaction write-conflict collision on the lock document.
 * If inFlightTxEpoch does not match the active fenceEpoch or if the lock is armed/locked,
 * the transaction is aborted with error 112 (WriteConflict).
 */
export function simulateTransactionBarrierCheck(
  inFlightTxEpoch: number,
  lockPayload: MigrationLockPayload
): { canCommit: boolean; writeConflict: boolean; errorCode?: number } {
  const activeEpoch = lockPayload.fenceEpoch ?? 0;
  const isLocked = !!lockPayload.locked;

  // If coordinator has advanced the epoch or locked the system, in-flight transaction conflicts
  if (inFlightTxEpoch !== activeEpoch || isLocked) {
    return {
      canCommit: false,
      writeConflict: true,
      errorCode: 112, // WiredTiger WriteConflict error code
    };
  }

  return {
    canCommit: true,
    writeConflict: false,
  };
}
