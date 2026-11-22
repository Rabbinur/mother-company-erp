import mongoose from "mongoose";
import { connectDB } from "./connect";
import { TransactionOutcome } from "@/models/TransactionOutcome";

export interface TransactionOptions {
  businessId: mongoose.Types.ObjectId;
  dealershipId: mongoose.Types.ObjectId;
  operationType: string;
  idempotencyKey: string;
  payloadHash: string;
  actorId: mongoose.Types.ObjectId;
  maxTransientRetries?: number; // Default: 2
  maxCommitRetries?: number; // Default: 3
  maxCommitTimeMS?: number; // Default: 4000ms
  totalDeadlineMS?: number; // Serverless execution deadline (Default: 8000ms)
}

export class TransactionAmbiguousError extends Error {
  idempotencyKey: string;
  constructor(message: string, idempotencyKey: string) {
    super(message);
    this.name = "TransactionAmbiguousError";
    this.idempotencyKey = idempotencyKey;
  }
}

export async function withTransaction<T>(
  operation: (
    session: mongoose.ClientSession
  ) => Promise<{ result: T; entityId?: string }>,
  options: TransactionOptions
): Promise<T> {
  await connectDB();

  // 1. Pre-flight Idempotency Record Registration (Outside Transaction)
  try {
    await TransactionOutcome.create({
      businessId: options.businessId,
      dealershipId: options.dealershipId,
      operationType: options.operationType,
      idempotencyKey: options.idempotencyKey,
      payloadHash: options.payloadHash,
      actorId: options.actorId,
      status: "PENDING",
      createdAt: new Date(),
    });
  } catch (err: any) {
    if (err.code === 11000) {
      // Existing idempotency key found! Check status
      const existing = await TransactionOutcome.findOne({
        businessId: options.businessId,
        dealershipId: options.dealershipId,
        operationType: options.operationType,
        idempotencyKey: options.idempotencyKey,
      });

      if (existing) {
        if (existing.payloadHash !== options.payloadHash) {
          throw new Error(
            "Idempotency conflict: Identical key used with different request payload"
          );
        }
        if (existing.status === "COMMITTED") {
          return existing.responseSnapshot as T; // Idempotent playback
        }
        if (
          existing.status === "PENDING" ||
          existing.status === "RECONCILIATION_REQUIRED"
        ) {
          // Strictly prevent duplicate execution of business callback!
          throw new TransactionAmbiguousError(
            `Operation '${options.operationType}' is currently ${existing.status.toLowerCase()}. Reconciliation required.`,
            options.idempotencyKey
          );
        }
        if (existing.status === "ABORTED") {
          // Prior attempt deterministically aborted before commit. Reset to PENDING for clean retry.
          await TransactionOutcome.updateOne(
            { _id: existing._id },
            {
              $set: {
                status: "PENDING",
                errorMessage: undefined,
                resolvedAt: undefined,
                createdAt: new Date(),
              },
            }
          );
        }
      }
    } else {
      throw err;
    }
  }

  const session = await mongoose.startSession();
  const maxTransientRetries = options.maxTransientRetries ?? 2;
  const maxCommitRetries = options.maxCommitRetries ?? 3;
  const maxCommitTimeMS = options.maxCommitTimeMS ?? 4000;
  const deadline = Date.now() + (options.totalDeadlineMS ?? 8000);

  let transientAttempts = 0;

  try {
    while (true) {
      if (Date.now() > deadline) {
        throw new Error(
          "Transaction deadline exceeded before execution completed"
        );
      }

      transientAttempts++;
      session.startTransaction({
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
        maxCommitTimeMS,
      });

      // ─── STAGE 1: BUSINESS OPERATION EXECUTION ──────────────────────
      let opResult: T;
      let opEntityId: string | undefined;

      try {
        const opExecution = await operation(session);
        opResult = opExecution.result;
        opEntityId = opExecution.entityId;
      } catch (businessErr: any) {
        // Business operation threw error before commit was ever attempted.
        if (session.inTransaction()) {
          try {
            await session.abortTransaction();
          } catch {
            // Ignore abort failure
          }
        }

        const isTransient = businessErr?.hasErrorLabel?.(
          "TransientTransactionError"
        );
        if (
          isTransient &&
          transientAttempts <= maxTransientRetries &&
          Date.now() < deadline
        ) {
          await new Promise((r) => setTimeout(r, transientAttempts * 100));
          continue; // Restart transaction loop cleanly
        }

        // Definite business failure before commit: mark ABORTED durably
        try {
          await TransactionOutcome.updateOne(
            {
              businessId: options.businessId,
              dealershipId: options.dealershipId,
              operationType: options.operationType,
              idempotencyKey: options.idempotencyKey,
            },
            {
              $set: {
                status: "ABORTED",
                errorMessage: businessErr.message,
                resolvedAt: new Date(),
              },
            }
          );
        } catch {
          // Secondary logging failure
        }

        throw businessErr;
      }

      // ─── STAGE 2: COMMIT EXECUTION ──────────────────────────────────
      let commitConfirmed = false;
      let commitAttempts = 0;

      while (true) {
        try {
          await session.commitTransaction();
          commitConfirmed = true;
          break; // Commit confirmed on database!
        } catch (commitErr: any) {
          const isUnknownCommit = commitErr?.hasErrorLabel?.(
            "UnknownTransactionCommitResult"
          );

          // Retry commit ONLY on UnknownTransactionCommitResult (never re-run business logic!)
          if (
            isUnknownCommit &&
            commitAttempts < maxCommitRetries &&
            Date.now() < deadline
          ) {
            commitAttempts++;
            await new Promise((r) => setTimeout(r, commitAttempts * 75));
            continue; // Retry session.commitTransaction() only!
          }

          if (commitErr?.hasErrorLabel?.("TransientTransactionError")) {
            if (session.inTransaction()) {
              try {
                await session.abortTransaction();
              } catch {}
            }
            if (transientAttempts <= maxTransientRetries && Date.now() < deadline) {
              await new Promise((r) => setTimeout(r, transientAttempts * 100));
              break; // Breaks commit loop to restart outer transaction loop
            }
            // Transient commit retries exhausted: mark ABORTED and throw
            try {
              await TransactionOutcome.updateOne(
                {
                  businessId: options.businessId,
                  dealershipId: options.dealershipId,
                  operationType: options.operationType,
                  idempotencyKey: options.idempotencyKey,
                },
                {
                  $set: {
                    status: "ABORTED",
                    errorMessage: commitErr.message,
                    resolvedAt: new Date(),
                  },
                }
              );
            } catch {}
            throw commitErr;
          }

          if (isUnknownCommit) {
            // UnknownTransactionCommitResult retries exhausted!
            // Commit is AMBIGUOUS. The primary may have committed.
            // NEVER mark ABORTED. Preserve RECONCILIATION_REQUIRED.
            try {
              await TransactionOutcome.updateOne(
                {
                  businessId: options.businessId,
                  dealershipId: options.dealershipId,
                  operationType: options.operationType,
                  idempotencyKey: options.idempotencyKey,
                },
                {
                  $set: {
                    status: "RECONCILIATION_REQUIRED",
                    errorMessage: `Commit confirmation lost after ${commitAttempts} retries: ${commitErr.message}`,
                    recordedAt: new Date(),
                  },
                }
              );
            } catch {
              // Secondary logging failure
            }

            throw new TransactionAmbiguousError(
              "Transaction commit confirmation lost due to network disconnect. Reconciliation required.",
              options.idempotencyKey
            );
          }

          // Definite commit failure (e.g. WriteConflict, expired session)
          if (session.inTransaction()) {
            try {
              await session.abortTransaction();
            } catch {}
          }
          try {
            await TransactionOutcome.updateOne(
              {
                businessId: options.businessId,
                dealershipId: options.dealershipId,
                operationType: options.operationType,
                idempotencyKey: options.idempotencyKey,
              },
              {
                $set: {
                  status: "ABORTED",
                  errorMessage: commitErr.message,
                  resolvedAt: new Date(),
                },
              }
            );
          } catch {}
          throw commitErr;
        }
      }

      // If transient commit failure broke out to restart transaction:
      if (!commitConfirmed) {
        continue;
      }

      // ─── STAGE 3: POST-COMMIT STATUS RECORDING ──────────────────────
      // Commit has definitely succeeded on the database.
      // Under NO circumstances may the operation ever be marked ABORTED!
      try {
        await TransactionOutcome.updateOne(
          {
            businessId: options.businessId,
            dealershipId: options.dealershipId,
            operationType: options.operationType,
            idempotencyKey: options.idempotencyKey,
          },
          {
            $set: {
              status: "COMMITTED",
              entityId: opEntityId,
              responseSnapshot: opResult,
              resolvedAt: new Date(),
            },
          }
        );
      } catch (statusUpdateErr: any) {
        // Commit succeeded on database, but outcome recording failed!
        // Mark RECONCILIATION_REQUIRED to prevent any client retry from re-executing business logic.
        try {
          await TransactionOutcome.updateOne(
            {
              businessId: options.businessId,
              dealershipId: options.dealershipId,
              operationType: options.operationType,
              idempotencyKey: options.idempotencyKey,
            },
            {
              $set: {
                status: "RECONCILIATION_REQUIRED",
                errorMessage: `Transaction committed to database, but outcome recording failed: ${statusUpdateErr.message}`,
                entityId: opEntityId,
                recordedAt: new Date(),
              },
            }
          );
        } catch {
          // Secondary write failure
        }

        throw new TransactionAmbiguousError(
          "Transaction committed to database, but recording completion status failed. Reconciliation required.",
          options.idempotencyKey
        );
      }

      return opResult;
    }
  } finally {
    await session.endSession();
  }
}
