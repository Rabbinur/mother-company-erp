/**
 * Phase 2B — BSON Pre-Image Loader & GridFS Reassembly
 * Project: Dealership Management (Mother Company ERP)
 *
 * Implements pre-image archive loading, GridFS chunk reassembly, SHA-256 verification,
 * and lossless BSON deserialization restoring exact native types.
 */

import crypto from "crypto";
import mongoose from "mongoose";

import {
  deserializeFromBson,
  ArchiveHashMismatchError,
  CorruptPreImageError,
  type PreImageRecord,
} from "./pre-image-archive";

export interface GridFsChunk {
  files_id: mongoose.Types.ObjectId | string;
  n: number;
  data: Buffer;
}

export interface LoadedPreImageResult {
  isValid: boolean;
  restoredDoc: any;
  sha256Hash: string;
  storageType: "inline" | "gridfs";
  byteSize: number;
}

/**
 * Loads a pre-image record from inline payload or reassembles it from GridFS chunks.
 * Verifies SHA-256 integrity and deserializes into a native BSON document object.
 */
export function loadAndVerifyPreImage(
  preImage: PreImageRecord,
  gridfsChunks: GridFsChunk[] = []
): LoadedPreImageResult {
  if (!preImage) {
    throw new CorruptPreImageError("Pre-image record is null or undefined");
  }

  let rawBuffer: Buffer;

  if (preImage.storageType === "inline") {
    if (!preImage.payload || !Buffer.isBuffer(preImage.payload)) {
      throw new CorruptPreImageError(
        `Inline pre-image archive ${preImage._id} missing valid payload Buffer`,
        { preImageId: preImage._id }
      );
    }
    rawBuffer = preImage.payload;
  } else if (preImage.storageType === "gridfs") {
    if (!preImage.gridfsFileId) {
      throw new CorruptPreImageError(
        `GridFS pre-image archive ${preImage._id} missing gridfsFileId`,
        { preImageId: preImage._id }
      );
    }

    // Filter and sort chunks strictly by chunk index n
    const fileIdStr = preImage.gridfsFileId.toString();
    const relevantChunks = gridfsChunks
      .filter((c) => c.files_id.toString() === fileIdStr)
      .sort((a, b) => a.n - b.n);

    if (preImage.chunkCount !== undefined && relevantChunks.length !== preImage.chunkCount) {
      throw new CorruptPreImageError(
        `GridFS chunk count mismatch for file ${fileIdStr}: expected ${preImage.chunkCount}, found ${relevantChunks.length}`,
        { expectedChunks: preImage.chunkCount, foundChunks: relevantChunks.length }
      );
    }

    if (relevantChunks.length === 0) {
      throw new CorruptPreImageError(
        `No GridFS chunks found for pre-image file ${fileIdStr}`,
        { gridfsFileId: fileIdStr }
      );
    }

    // Verify continuous sequence [0, 1, 2, ... k-1]
    for (let i = 0; i < relevantChunks.length; i++) {
      if (relevantChunks[i].n !== i) {
        throw new CorruptPreImageError(
          `Missing or out-of-order GridFS chunk at sequence index ${i}`,
          { expectedN: i, actualN: relevantChunks[i].n }
        );
      }
    }

    // Concatenate chunks into contiguous BSON byte buffer
    rawBuffer = Buffer.concat(relevantChunks.map((c) => c.data));
  } else {
    throw new CorruptPreImageError(`Unknown storage type: ${(preImage as any).storageType}`);
  }

  // 1. Verify SHA-256 hash before deserialization
  const actualSha256 = crypto.createHash("sha256").update(rawBuffer).digest("hex");
  if (actualSha256 !== preImage.sha256Hash) {
    throw new ArchiveHashMismatchError(
      `Pre-image archive hash mismatch for ${preImage._id}: expected ${preImage.sha256Hash}, got ${actualSha256}`,
      { expectedSha256: preImage.sha256Hash, actualSha256 }
    );
  }

  // 2. Deserialize preserving native BSON types (promoteValues: true preserves numbers, Decimal128, Date, ObjectId)
  const restoredDoc = deserializeFromBson(rawBuffer);

  // 3. Verify original document identity
  if (!restoredDoc || !restoredDoc._id) {
    throw new CorruptPreImageError(
      `Restored document from pre-image ${preImage._id} missing required _id field`,
      { restoredDoc }
    );
  }

  const restoredIdStr = restoredDoc._id.toString();
  const expectedIdStr = preImage.originalId.toString();
  if (restoredIdStr !== expectedIdStr) {
    throw new CorruptPreImageError(
      `Restored document identity mismatch: expected originalId ${expectedIdStr}, got ${restoredIdStr}`,
      { expectedIdStr, restoredIdStr }
    );
  }

  return {
    isValid: true,
    restoredDoc,
    sha256Hash: actualSha256,
    storageType: preImage.storageType,
    byteSize: rawBuffer.length,
  };
}
