/**
 * Phase 2B — Inventory 1:N Tenancy Partitioner
 * Project: Dealership Management (Mother Company ERP)
 *
 * Implements non-destructive 1-to-N inventory partitioning, brand/dealership alignment,
 * unresolved stock quarantine, explicit-null handling, and exact mathematical quantity reconciliation.
 */

import mongoose from "mongoose";

export interface LegacyInventoryBalance {
  _id: mongoose.Types.ObjectId | string;
  warehouseId: mongoose.Types.ObjectId | string;
  productId: mongoose.Types.ObjectId | string;
  variantId: mongoose.Types.ObjectId | string;
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity?: number;
  damagedQuantity?: number;
  stockInTransit?: number;
  [key: string]: unknown;
}

export interface DealershipAllocationRule {
  dealershipId: mongoose.Types.ObjectId | string;
  ratio?: number; // e.g. 0.6 for 60%
  exactOnHand?: number;
  exactReserved?: number;
  exactDamaged?: number;
  exactInTransit?: number;
}

export interface PartitionTargetRecord {
  businessId: mongoose.Types.ObjectId | string;
  dealershipId: mongoose.Types.ObjectId | string | null; // explicit null for quarantine
  warehouseId: mongoose.Types.ObjectId | string;
  productId: mongoose.Types.ObjectId | string;
  variantId: mongoose.Types.ObjectId | string;
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  damagedQuantity: number;
  stockInTransit: number;
  sourceBaselineId: mongoose.Types.ObjectId | string;
  partitionStatus: "active" | "quarantined";
  migrationRunId: string;
}

export interface PartitionResult {
  sourceBaselineId: string;
  sourceOnHand: number;
  sourceReserved: number;
  sourceDamaged: number;
  sourceInTransit: number;
  targetPartitions: PartitionTargetRecord[];
  isQuarantined: boolean;
  reconciliation: {
    totalOnHand: number;
    totalReserved: number;
    totalDamaged: number;
    totalInTransit: number;
    onHandDelta: number;
    reservedDelta: number;
    damagedDelta: number;
    inTransitDelta: number;
    isBalanced: boolean;
  };
}

export class InventoryReconciliationError extends Error {
  details?: Record<string, unknown>;
  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "InventoryReconciliationError";
    this.details = details;
  }
}

export class DuplicateTargetKeyError extends Error {
  details?: Record<string, unknown>;
  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "DuplicateTargetKeyError";
    this.details = details;
  }
}

/**
 * Partitions a single legacy inventory balance record into 1 or N dealership-owned records.
 *
 * Rules:
 * 1. If allocations are provided, stock is partitioned according to verified rules.
 * 2. Unresolved stock or remainders are quarantined with `dealershipId: null`.
 * 3. Total target stock across all partitions MUST reconcile exactly to source baseline ($\Delta \equiv 0$).
 * 4. Duplicate target keys ({ businessId, dealershipId, warehouseId, productId, variantId }) are forbidden.
 */
export function partitionInventoryBalance(
  source: LegacyInventoryBalance,
  businessId: mongoose.Types.ObjectId | string,
  migrationRunId: string,
  allocations: DealershipAllocationRule[] = []
): PartitionResult {
  const sourceOnHand = source.onHandQuantity ?? 0;
  const sourceReserved = source.reservedQuantity ?? 0;
  const sourceDamaged = source.damagedQuantity ?? 0;
  const sourceInTransit = source.stockInTransit ?? 0;

  // Validation: baseline cannot be negative
  if (sourceOnHand < 0 || sourceReserved < 0 || sourceDamaged < 0 || sourceInTransit < 0) {
    throw new InventoryReconciliationError(
      `Cannot partition corrupt legacy balance with negative quantities: onHand=${sourceOnHand}, reserved=${sourceReserved}`,
      { sourceId: source._id }
    );
  }

  const targetPartitions: PartitionTargetRecord[] = [];
  const targetKeySet = new Set<string>();

  const buildTargetKey = (dealershipId: mongoose.Types.ObjectId | string | null): string => {
    const dId = dealershipId ? dealershipId.toString() : "QUARANTINE_NULL";
    return `${businessId.toString()}:${dId}:${source.warehouseId.toString()}:${source.productId.toString()}:${source.variantId.toString()}`;
  };

  // Case 1: Unresolved Ownership or Empty Allocations -> 100% Quarantine
  if (allocations.length === 0) {
    const key = buildTargetKey(null);
    targetPartitions.push({
      businessId,
      dealershipId: null, // EXPLICIT NULL for quarantined partial index
      warehouseId: source.warehouseId,
      productId: source.productId,
      variantId: source.variantId,
      onHandQuantity: sourceOnHand,
      reservedQuantity: sourceReserved,
      availableQuantity: sourceOnHand - sourceReserved,
      damagedQuantity: sourceDamaged,
      stockInTransit: sourceInTransit,
      sourceBaselineId: source._id,
      partitionStatus: "quarantined",
      migrationRunId,
    });
    targetKeySet.add(key);
  } else {
    // Case 2: 1:N Partitioning across verified dealerships
    let allocatedOnHand = 0;
    let allocatedReserved = 0;
    let allocatedDamaged = 0;
    let allocatedInTransit = 0;

    for (const alloc of allocations) {
      if (!alloc.dealershipId) {
        throw new InventoryReconciliationError(
          "Allocation rule missing dealershipId. Unresolved stock must be quarantined, not allocated.",
          { alloc }
        );
      }

      const key = buildTargetKey(alloc.dealershipId);
      if (targetKeySet.has(key)) {
        throw new DuplicateTargetKeyError(
          `Duplicate target inventory balance key detected for dealership: ${alloc.dealershipId}`,
          { key }
        );
      }
      targetKeySet.add(key);

      let onHand = 0;
      let reserved = 0;
      let damaged = 0;
      let inTransit = 0;

      if (alloc.exactOnHand !== undefined) {
        onHand = alloc.exactOnHand;
        reserved = alloc.exactReserved ?? 0;
        damaged = alloc.exactDamaged ?? 0;
        inTransit = alloc.exactInTransit ?? 0;
      } else if (alloc.ratio !== undefined) {
        if (alloc.ratio < 0 || alloc.ratio > 1) {
          throw new InventoryReconciliationError(`Invalid allocation ratio: ${alloc.ratio}`);
        }
        // Integer floor allocation; remainders go to quarantine
        onHand = Math.floor(sourceOnHand * alloc.ratio);
        reserved = Math.floor(sourceReserved * alloc.ratio);
        damaged = Math.floor(sourceDamaged * alloc.ratio);
        inTransit = Math.floor(sourceInTransit * alloc.ratio);
      }

      allocatedOnHand += onHand;
      allocatedReserved += reserved;
      allocatedDamaged += damaged;
      allocatedInTransit += inTransit;

      targetPartitions.push({
        businessId,
        dealershipId: alloc.dealershipId, // EXPLICIT ObjectId
        warehouseId: source.warehouseId,
        productId: source.productId,
        variantId: source.variantId,
        onHandQuantity: onHand,
        reservedQuantity: reserved,
        availableQuantity: onHand - reserved,
        damagedQuantity: damaged,
        stockInTransit: inTransit,
        sourceBaselineId: source._id,
        partitionStatus: "active",
        migrationRunId,
      });
    }

    // Allocate remainders to quarantine (dealershipId: null)
    const remainderOnHand = sourceOnHand - allocatedOnHand;
    const remainderReserved = sourceReserved - allocatedReserved;
    const remainderDamaged = sourceDamaged - allocatedDamaged;
    const remainderInTransit = sourceInTransit - allocatedInTransit;

    if (
      remainderOnHand > 0 ||
      remainderReserved > 0 ||
      remainderDamaged > 0 ||
      remainderInTransit > 0
    ) {
      const qKey = buildTargetKey(null);
      targetPartitions.push({
        businessId,
        dealershipId: null, // EXPLICIT NULL for quarantine
        warehouseId: source.warehouseId,
        productId: source.productId,
        variantId: source.variantId,
        onHandQuantity: remainderOnHand,
        reservedQuantity: remainderReserved,
        availableQuantity: remainderOnHand - remainderReserved,
        damagedQuantity: remainderDamaged,
        stockInTransit: remainderInTransit,
        sourceBaselineId: source._id,
        partitionStatus: "quarantined",
        migrationRunId,
      });
      targetKeySet.add(qKey);
    }
  }

  // -------------------------------------------------------------
  // EXACT MATHEMATICAL RECONCILIATION
  // -------------------------------------------------------------
  const totalOnHand = targetPartitions.reduce((sum, p) => sum + p.onHandQuantity, 0);
  const totalReserved = targetPartitions.reduce((sum, p) => sum + p.reservedQuantity, 0);
  const totalDamaged = targetPartitions.reduce((sum, p) => sum + p.damagedQuantity, 0);
  const totalInTransit = targetPartitions.reduce((sum, p) => sum + p.stockInTransit, 0);

  const onHandDelta = totalOnHand - sourceOnHand;
  const reservedDelta = totalReserved - sourceReserved;
  const damagedDelta = totalDamaged - sourceDamaged;
  const inTransitDelta = totalInTransit - sourceInTransit;

  const isBalanced =
    onHandDelta === 0 && reservedDelta === 0 && damagedDelta === 0 && inTransitDelta === 0;

  if (!isBalanced) {
    throw new InventoryReconciliationError(
      `Inventory quantity reconciliation failed! Target sum != source baseline. ` +
        `onHandDelta=${onHandDelta}, reservedDelta=${reservedDelta}, damagedDelta=${damagedDelta}, inTransitDelta=${inTransitDelta}`,
      {
        source: { sourceOnHand, sourceReserved, sourceDamaged, sourceInTransit },
        targetSum: { totalOnHand, totalReserved, totalDamaged, totalInTransit },
      }
    );
  }

  const hasQuarantined = targetPartitions.some((p) => p.partitionStatus === "quarantined");

  return {
    sourceBaselineId: source._id.toString(),
    sourceOnHand,
    sourceReserved,
    sourceDamaged,
    sourceInTransit,
    targetPartitions,
    isQuarantined: hasQuarantined,
    reconciliation: {
      totalOnHand,
      totalReserved,
      totalDamaged,
      totalInTransit,
      onHandDelta,
      reservedDelta,
      damagedDelta,
      inTransitDelta,
      isBalanced,
    },
  };
}
