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
  maxTransientRetries?: number;   // Default: 2
  maxCommitRetries?: number;      // Default: 3
  maxCommitTimeMS?: number;       // Default: 4000ms
  totalDeadlineMS?: number;       // Serverless execution deadline (Default: 8000ms)
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
  operation: (session: mongoose.ClientSession) => Promise<{ result: T; entityId?: string }>,
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
          throw new Error("Idempotency conflict: Identical key used with different request payload");
        }
        if (existing.status === "COMMITTED") {
          return existing.responseSnapshot as T; // Idempotent playback
        }
        if (existing.status === "PENDING" || existing.status === "RECONCILIATION_REQUIRED") {
          throw new TransactionAmbiguousError(
            "Operation is currently pending or undergoing reconciliation",
            options.idempotencyKey
          );
        }
      }
    }
    throw err;
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
        throw new Error("Transaction deadline exceeded before execution completed");
      }

      transientAttempts++;
      session.startTransaction({
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
        maxCommitTimeMS,
      });

      try {
        const { result, entityId } = await operation(session);

        // Commit Retry Loop
        let commitAttempts = 0;
        while (true) {
          try {
            await session.commitTransaction();

            // Mark COMMITTED durably in standalone write
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
                  entityId,
                  responseSnapshot: result,
                  resolvedAt: new Date(),
                },
              }
            );

            return result;
          } catch (commitErr: any) {
            const isUnknownCommit = commitErr?.hasErrorLabel?.("UnknownTransactionCommitResult");

            if (isUnknownCommit && commitAttempts < maxCommitRetries && Date.now() < deadline) {
              commitAttempts++;
              await new Promise((r) => setTimeout(r, commitAttempts * 75));
              continue; // Retry commit ONLY!
            }

            if (commitErr?.hasErrorLabel?.("TransientTransactionError")) {
              throw commitErr; // Escalate to outer loop
            }

            if (isUnknownCommit) {
              // Ambiguous commit retries exhausted!
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
                      errorMessage: commitErr.message,
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

            throw commitErr;
          }
        }
      } catch (opErr: any) {
        if (session.inTransaction()) {
          try {
            await session.abortTransaction();
          } catch {
            // Ignore abort error
          }
        }

        const isTransient = opErr?.hasErrorLabel?.("TransientTransactionError");
        if (isTransient && transientAttempts <= maxTransientRetries && Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, transientAttempts * 100));
          continue; // Restart transaction loop
        }

        // Mark ABORTED durably
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
              errorMessage: opErr.message,
              resolvedAt: new Date(),
            },
          }
        );

        throw opErr;
      }
    }
  } finally {
    await session.endSession();
  }
}
