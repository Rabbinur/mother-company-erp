/**
 * Phase 2B — Post-Migration Mutation Detector
 * Project: Dealership Management (Mother Company ERP)
 *
 * Compares current target collection state against migration manifest hashes to detect
 * modifications, deletions, new records, inventory alterations, and financial journal mutations.
 */

import crypto from "crypto";
import type { MigrationAuditEntry } from "./audit-manifest";
import type { RestorationEligibilityStatus } from "./rollback-types";

export interface TargetDocumentEvaluation {
  targetId: string;
  sourceId: string;
  sourceCollection: string;
  targetCollection: string;
  recordedAfterHash: string;
  currentHash?: string;
  status: RestorationEligibilityStatus;
  conflictReason?: string;
  hasMutated: boolean;
  mutatedFields?: string[];
  currentDoc?: any;
}

export interface MutationDetectionResult {
  totalEvaluated: number;
  safeCount: number;
  conflictCount: number;
  missingTargetCount: number;
  newRecordCount: number;
  evaluations: TargetDocumentEvaluation[];
  unrecordedTargetDocuments: any[];
}

/**
 * Computes deterministic SHA-256 hash of a current document object.
 */
export function hashCurrentDocument(doc: any): string {
  if (!doc) return "";
  // Stringify with sorted keys
  const sortedKeys = Object.keys(doc).sort();
  const sorted: Record<string, any> = {};
  for (const k of sortedKeys) {
    // Exclude volatile timestamps or internal Mongoose attributes if needed
    if (k !== "__v") {
      sorted[k] = doc[k];
    }
  }
  return crypto.createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
}

/**
 * Detects mutations on target documents by comparing them against the migration audit entries.
 */
export function detectPostMigrationMutations(
  auditEntries: MigrationAuditEntry[],
  currentCollectionDocs: any[],
  targetCollectionName: string,
  migrationCompletedAt?: Date
): MutationDetectionResult {
  const evaluations: TargetDocumentEvaluation[] = [];

  // Index current collection documents by _id or composite targetId
  const currentDocMap = new Map<string, any>();
  for (const doc of currentCollectionDocs) {
    if (doc._id) {
      currentDocMap.set(doc._id.toString(), doc);
    }
  }

  const evaluatedTargetDocIds = new Set<string>();

  // 1. Evaluate every migrated entry in the manifest
  for (const entry of auditEntries) {
    if (entry.targetCollection !== targetCollectionName) {
      continue;
    }

    // Try finding by entry.targetId or by sourceBaselineId matching entry.sourceId
    let currentDoc = currentDocMap.get(entry.targetId);
    if (!currentDoc) {
      // Check if any document has sourceBaselineId == entry.sourceId
      currentDoc = currentCollectionDocs.find(
        (d) => d.sourceBaselineId?.toString() === entry.sourceId
      );
    }

    if (!currentDoc) {
      // Target document was deleted after migration!
      evaluations.push({
        targetId: entry.targetId,
        sourceId: entry.sourceId,
        sourceCollection: entry.sourceCollection,
        targetCollection: entry.targetCollection,
        recordedAfterHash: entry.afterHash,
        status: "CONFLICT",
        conflictReason: "TARGET_DOCUMENT_DELETED: Document was deleted from target collection after migration",
        hasMutated: true,
      });
      continue;
    }

    evaluatedTargetDocIds.add(currentDoc._id.toString());
    const currentHash = hashCurrentDocument(currentDoc);

    // Check specific critical field mutations
    const mutatedFields: string[] = [];

    // Check inventory quantities if applicable
    if (entry.metadata?.onHandQuantity !== undefined) {
      if (currentDoc.onHandQuantity !== entry.metadata.onHandQuantity) {
        mutatedFields.push("onHandQuantity");
      }
    }

    // Check dealership change if applicable
    if (entry.metadata?.partitionStatus !== undefined) {
      if (currentDoc.partitionStatus !== entry.metadata.partitionStatus) {
        mutatedFields.push("partitionStatus");
      }
    }

    // Check financial mutations: journal entry posted or order payments changed
    if (currentDoc.paidAmount !== undefined && entry.metadata?.paidAmount !== undefined) {
      if (currentDoc.paidAmount !== entry.metadata.paidAmount) {
        mutatedFields.push("paidAmount");
      }
    }

    // Determine status
    if (mutatedFields.length > 0) {
      evaluations.push({
        targetId: currentDoc._id.toString(),
        sourceId: entry.sourceId,
        sourceCollection: entry.sourceCollection,
        targetCollection: entry.targetCollection,
        recordedAfterHash: entry.afterHash,
        currentHash,
        status: "CONFLICT",
        conflictReason: `BUSINESS_MUTATION_DETECTED: Target fields mutated after migration: [${mutatedFields.join(", ")}]`,
        hasMutated: true,
        mutatedFields,
        currentDoc,
      });
    } else if (entry.afterHash && currentHash && entry.afterHash !== currentHash) {
      // Generic hash mismatch (in-place update or metadata alteration)
      evaluations.push({
        targetId: currentDoc._id.toString(),
        sourceId: entry.sourceId,
        sourceCollection: entry.sourceCollection,
        targetCollection: entry.targetCollection,
        recordedAfterHash: entry.afterHash,
        currentHash,
        status: "CONFLICT",
        conflictReason: "HASH_MISMATCH: Current target document content does not match post-migration hash",
        hasMutated: true,
        currentDoc,
      });
    } else {
      // Document is clean and identical to post-migration state
      evaluations.push({
        targetId: currentDoc._id.toString(),
        sourceId: entry.sourceId,
        sourceCollection: entry.sourceCollection,
        targetCollection: entry.targetCollection,
        recordedAfterHash: entry.afterHash,
        currentHash,
        status: "SAFE_TO_RESTORE",
        hasMutated: false,
        currentDoc,
      });
    }
  }

  // 2. Detect unrecorded target documents (newly inserted records created post-migration)
  const unrecordedTargetDocuments: any[] = [];
  for (const doc of currentCollectionDocs) {
    const docId = doc._id?.toString();
    if (!evaluatedTargetDocIds.has(docId)) {
      // Document was created outside or after this migration run!
      const isPostMigration =
        migrationCompletedAt && doc.createdAt
          ? new Date(doc.createdAt).getTime() >= migrationCompletedAt.getTime()
          : true;

      if (isPostMigration) {
        unrecordedTargetDocuments.push(doc);
      }
    }
  }

  const safeCount = evaluations.filter((e) => e.status === "SAFE_TO_RESTORE").length;
  const conflictCount = evaluations.filter((e) => e.status === "CONFLICT").length;
  const missingTargetCount = evaluations.filter(
    (e) => e.conflictReason?.includes("DELETED")
  ).length;

  return {
    totalEvaluated: evaluations.length,
    safeCount,
    conflictCount,
    missingTargetCount,
    newRecordCount: unrecordedTargetDocuments.length,
    evaluations,
    unrecordedTargetDocuments,
  };
}
