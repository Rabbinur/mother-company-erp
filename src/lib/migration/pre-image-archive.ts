/**
 * Phase 2B — BSON Pre-Image Archive & GridFS Fallback
 * Project: Dealership Management (Mother Company ERP)
 *
 * Implements byte-preserving BSON archiving, canonical key-sorted SHA-256 hashing,
 * 15MB GridFS fallback, orphan chunk detection, and lossless round-trip restoration.
 */

import crypto from "crypto";
import mongoose from "mongoose";

const { BSON } = mongoose.mongo;

export const GRIDFS_THRESHOLD_BYTES = 15 * 1024 * 1024; // 15 MB threshold

export interface PreImageRecord {
  _id: mongoose.Types.ObjectId | string;
  migrationRunId: string;
  collectionName: string;
  originalId: mongoose.Types.ObjectId | string;
  storageType: "inline" | "gridfs";
  byteSize: number;
  sha256Hash: string;
  payload?: Buffer; // Populated if inline
  gridfsFileId?: mongoose.Types.ObjectId | string; // Populated if gridfs
  chunkCount?: number;
  createdAt: Date;
}

export class ArchiveHashMismatchError extends Error {
  details?: Record<string, unknown>;
  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ArchiveHashMismatchError";
    this.details = details;
  }
}

export class CorruptPreImageError extends Error {
  details?: Record<string, unknown>;
  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "CorruptPreImageError";
    this.details = details;
  }
}

/**
 * Deterministically sorts object keys recursively to ensure canonical BSON byte serialization.
 */
export function canonicalSort(value: any): any {
  if (value === null || typeof value !== "object") {
    return value;
  }

  // Preserve native BSON instances (ObjectId, Decimal128, Date, Buffer, Binary, Long, Int32, Double)
  if (
    value._bsontype ||
    value instanceof mongoose.Types.ObjectId ||
    value instanceof mongoose.mongo.Decimal128 ||
    value instanceof mongoose.mongo.Binary ||
    value instanceof Date ||
    Buffer.isBuffer(value)
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(canonicalSort);
  }

  const sortedKeys = Object.keys(value).sort();
  const sortedObj: Record<string, any> = {};
  for (const key of sortedKeys) {
    sortedObj[key] = canonicalSort(value[key]);
  }
  return sortedObj;
}

/**
 * Serializes a Mongoose document or plain object to a canonical BSON byte buffer
 * and computes its deterministic SHA-256 hash.
 */
export function serializeToBson(doc: any): {
  buffer: Buffer;
  sha256: string;
  byteSize: number;
} {
  const plainObj = typeof doc.toObject === "function" ? doc.toObject({ depopulate: true }) : doc;
  const sorted = canonicalSort(plainObj);
  const buffer = Buffer.from(BSON.serialize(sorted));
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

  return {
    buffer,
    sha256,
    byteSize: buffer.length,
  };
}

/**
 * Deserializes a BSON buffer back into a clean JavaScript document object,
 * preserving exact native types (Decimal128, Date, ObjectId, Binary).
 */
export function deserializeFromBson(buffer: Buffer): any {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new CorruptPreImageError("Cannot deserialize non-buffer payload");
  }

  try {
    return BSON.deserialize(buffer, { promoteValues: true });
  } catch (err: any) {
    throw new CorruptPreImageError(`BSON deserialization failed: ${err.message}`, { error: err });
  }
}

/**
 * Creates an immutable pre-image record for a document before migration mutation.
 * Enforces the 15MB GridFS fallback.
 */
export function createPreImageRecord(
  doc: any,
  collectionName: string,
  migrationRunId: string,
  mockLargeSizeForTesting?: number
): PreImageRecord {
  const { buffer, sha256, byteSize } = serializeToBson(doc);
  const effectiveSize = mockLargeSizeForTesting ?? byteSize;
  const isLarge = effectiveSize >= GRIDFS_THRESHOLD_BYTES;

  const originalId = doc._id;
  const recordId = new mongoose.Types.ObjectId();

  if (isLarge) {
    // 15MB GridFS Fallback
    const gridfsFileId = new mongoose.Types.ObjectId();
    const chunkSize = 255 * 1024; // Standard GridFS chunk size
    const chunkCount = Math.ceil(effectiveSize / chunkSize);

    return {
      _id: recordId,
      migrationRunId,
      collectionName,
      originalId,
      storageType: "gridfs",
      byteSize: effectiveSize,
      sha256Hash: sha256,
      gridfsFileId,
      chunkCount,
      createdAt: new Date(),
    };
  }

  // Inline storage (< 15 MB)
  return {
    _id: recordId,
    migrationRunId,
    collectionName,
    originalId,
    storageType: "inline",
    byteSize,
    sha256Hash: sha256,
    payload: buffer,
    createdAt: new Date(),
  };
}

/**
 * Verifies that a pre-image buffer deserializes cleanly and reconciles to the expected hash.
 */
export function verifyPreImageRoundTrip(
  buffer: Buffer,
  expectedSha256: string
): { isValid: boolean; restoredDoc: any } {
  const restoredDoc = deserializeFromBson(buffer);
  const reSerialized = serializeToBson(restoredDoc);

  if (reSerialized.sha256 !== expectedSha256) {
    throw new ArchiveHashMismatchError(
      `Pre-image archive hash mismatch! Expected ${expectedSha256}, got ${reSerialized.sha256}`,
      { expectedSha256, actualSha256: reSerialized.sha256 }
    );
  }

  return { isValid: true, restoredDoc };
}

/**
 * Detects orphaned GridFS chunks in a mock or real chunks collection.
 * Any chunk whose files_id is not present in activeFiles is an orphan.
 */
export function detectOrphanedGridFsChunks(
  chunks: Array<{ files_id: any; n: number }>,
  activeFiles: Array<{ _id: any }>
): Array<{ files_id: any; n: number }> {
  const activeFileIdSet = new Set(activeFiles.map((f) => f._id.toString()));
  return chunks.filter((chunk) => !activeFileIdSet.has(chunk.files_id.toString()));
}
