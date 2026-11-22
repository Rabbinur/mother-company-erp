/**
 * Phase 2B — Index Migration Planner & Atlas Validator
 * Project: Dealership Management (Mother Company ERP)
 *
 * Implements approved dual partial unique index definitions, Atlas partialFilterExpression
 * compatibility checks, and pre-index duplicate tuple detection.
 */

export interface MigrationIndexDefinition {
  name: string;
  collection: string;
  keys: Record<string, 1 | -1>;
  unique: boolean;
  partialFilterExpression?: Record<string, any>;
  description: string;
}

/**
 * The approved Phase 2A index definitions for InventoryBalance
 */
export const APPROVED_INVENTORY_INDEXES: MigrationIndexDefinition[] = [
  {
    name: "uniq_inv_active_dealership",
    collection: "inventorybalances",
    keys: {
      businessId: 1,
      dealershipId: 1,
      warehouseId: 1,
      productId: 1,
      variantId: 1,
    },
    unique: true,
    partialFilterExpression: {
      dealershipId: { $type: "objectId" },
    },
    description: "Enforces unique balance per variant in a warehouse for an active commercial dealership",
  },
  {
    name: "uniq_inv_quarantine_business",
    collection: "inventorybalances",
    keys: {
      businessId: 1,
      warehouseId: 1,
      productId: 1,
      variantId: 1,
    },
    unique: true,
    partialFilterExpression: {
      dealershipId: null,
    },
    description: "Enforces single quarantined balance per variant in a warehouse across business",
  },
];

/**
 * Validates whether a partialFilterExpression is supported by MongoDB Atlas WiredTiger engine.
 * Atlas restricts partialFilterExpression to equality, $exists, $type, $gt, $gte, $lt, $lte, and top-level $and.
 * Forbidden: $expr, $where, $regex, $ne.
 */
export function validateAtlasPartialFilter(filter: Record<string, any> | undefined): {
  isAtlasCompatible: boolean;
  violations: string[];
} {
  if (!filter) {
    return { isAtlasCompatible: true, violations: [] };
  }

  const violations: string[] = [];
  const forbiddenOps = ["$expr", "$where", "$regex", "$ne"];

  function checkSubFilter(obj: any, path: string) {
    if (!obj || typeof obj !== "object") return;

    for (const key of Object.keys(obj)) {
      const fullPath = path ? `${path}.${key}` : key;
      if (forbiddenOps.includes(key)) {
        violations.push(`Forbidden operator '${key}' in partialFilterExpression at '${fullPath}'`);
      }
      if (typeof obj[key] === "object" && obj[key] !== null) {
        checkSubFilter(obj[key], fullPath);
      }
    }
  }

  checkSubFilter(filter, "");

  return {
    isAtlasCompatible: violations.length === 0,
    violations,
  };
}

/**
 * Tests whether a document matches an Atlas partialFilterExpression.
 */
export function matchesPartialFilter(doc: any, filter: Record<string, any> | undefined): boolean {
  if (!filter) return true;

  for (const [field, condition] of Object.entries(filter)) {
    const val = doc[field];

    if (condition === null) {
      // Matches both explicit null and undefined (missing)
      if (val !== null && val !== undefined) return false;
      continue;
    }

    if (typeof condition === "object" && condition !== null) {
      if (condition.$type !== undefined) {
        const expectedType = condition.$type.toLowerCase();
        if (expectedType === "objectid") {
          // Check for BSON ObjectId
          const isObjectId =
            val?._bsontype === "ObjectID" ||
            val?.constructor?.name === "ObjectId" ||
            /^[0-9a-fA-F]{24}$/.test(val?.toString?.() ?? "");
          if (!isObjectId || val === null || val === undefined) return false;
        } else if (expectedType === "string") {
          if (typeof val !== "string") return false;
        }
      }
      if (condition.$exists !== undefined) {
        const exists = val !== undefined;
        if (exists !== condition.$exists) return false;
      }
    } else {
      if (val !== condition) return false;
    }
  }

  return true;
}

/**
 * Detects duplicate key tuples in a dataset according to an index definition.
 * Only evaluates documents matching the partialFilterExpression.
 */
export function detectIndexDuplicates(
  documents: any[],
  indexDef: MigrationIndexDefinition
): {
  hasDuplicates: boolean;
  duplicateCount: number;
  duplicateTuples: Array<{ key: string; count: number; sampleIds: any[] }>;
} {
  const matchingDocs = documents.filter((doc) =>
    matchesPartialFilter(doc, indexDef.partialFilterExpression)
  );

  const tupleMap = new Map<string, any[]>();

  for (const doc of matchingDocs) {
    const keyParts: string[] = [];
    for (const key of Object.keys(indexDef.keys)) {
      const val = doc[key];
      keyParts.push(val === null || val === undefined ? "NULL" : val.toString());
    }
    const tupleKey = keyParts.join(":");
    const existing = tupleMap.get(tupleKey) || [];
    existing.push(doc._id);
    tupleMap.set(tupleKey, existing);
  }

  const duplicateTuples: Array<{ key: string; count: number; sampleIds: any[] }> = [];

  for (const [key, ids] of tupleMap.entries()) {
    if (ids.length > 1) {
      duplicateTuples.push({
        key,
        count: ids.length,
        sampleIds: ids.slice(0, 5),
      });
    }
  }

  return {
    hasDuplicates: duplicateTuples.length > 0,
    duplicateCount: duplicateTuples.length,
    duplicateTuples,
  };
}
