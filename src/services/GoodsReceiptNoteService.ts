import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { GoodsReceiptNote, type IGoodsReceiptNote, type IGRNItem, type GRNStatus } from "@/models/GoodsReceiptNote";
import { SupplierPayable } from "@/models/SupplierPayable";
import { Vendor } from "@/models/Vendor";
import { Warehouse } from "@/models/Warehouse";
import { Dealership } from "@/models/Dealership";
import { AuditLog } from "@/models/AuditLog";
import { StockMovement } from "@/models/StockMovement";
import { InventoryService } from "./InventoryService";
import { PurchaseOrderService } from "./PurchaseOrderService";
import { ProductMatcherService } from "./ProductMatcherService";
import { GrnCostAllocationService } from "./GrnCostAllocationService";
import { OcrService } from "@/lib/ocr/OcrService";
import { generateReferenceCode } from "@/lib/utils";

export interface CreateGrnInput {
  businessId: string | mongoose.Types.ObjectId;
  dealershipId: string | mongoose.Types.ObjectId;
  warehouseId: string | mongoose.Types.ObjectId;
  supplierId: string | mongoose.Types.ObjectId;
  principalCompanyId?: string | mongoose.Types.ObjectId | null;
  purchaseOrderId?: string | mongoose.Types.ObjectId | null;
  challanNumber: string;
  challanDate: Date | string;
  invoiceNumber?: string;
  invoiceDate?: Date | string;
  items?: Array<Partial<IGRNItem>>;
  invoiceDiscount?: number;
  invoiceDiscountType?: "fixed" | "percentage";
  cashDiscount?: number;
  tradeDiscount?: number;
  freightCharge?: number;
  handlingCharge?: number;
  otherCharges?: number;
  discountAllocationPolicy?: "proportional_value" | "proportional_quantity";
  notes?: string;
  actorId: string | mongoose.Types.ObjectId;
}

export interface UpdateGrnInput {
  items: Array<Partial<IGRNItem>>;
  invoiceDiscount?: number;
  invoiceDiscountType?: "fixed" | "percentage";
  cashDiscount?: number;
  tradeDiscount?: number;
  freightCharge?: number;
  handlingCharge?: number;
  otherCharges?: number;
  discountAllocationPolicy?: "proportional_value" | "proportional_quantity";
  notes?: string;
  actorId: string | mongoose.Types.ObjectId;
  reason?: string;
}

export class GoodsReceiptNoteService {
  /**
   * Create a new GRN (Manual entry or blank draft for scan)
   */
  static async createGrn(input: CreateGrnInput): Promise<IGoodsReceiptNote> {
    const bId = new mongoose.Types.ObjectId(String(input.businessId));
    const dId = new mongoose.Types.ObjectId(String(input.dealershipId));
    const wId = new mongoose.Types.ObjectId(String(input.warehouseId));
    const sId = new mongoose.Types.ObjectId(String(input.supplierId));
    const pCompId = input.principalCompanyId
      ? new mongoose.Types.ObjectId(String(input.principalCompanyId))
      : null;
    const poId = input.purchaseOrderId
      ? new mongoose.Types.ObjectId(String(input.purchaseOrderId))
      : null;
    const actId = new mongoose.Types.ObjectId(String(input.actorId));

    // Verify supplier and warehouse exist
    const supplier = await Vendor.findById(sId);
    if (!supplier) throw new Error("Supplier (Vendor) not found");

    const warehouse = await Warehouse.findById(wId);
    if (!warehouse) throw new Error("Warehouse not found");

    // Check duplicate supplier challan in business
    const cleanChallan = input.challanNumber.trim();
    const existing = await GoodsReceiptNote.findOne({
      businessId: bId,
      supplierId: sId,
      challanNumber: cleanChallan,
      isCancelled: false,
    });
    if (existing) {
      throw new Error(
        `Duplicate Challan: A GRN (${existing.grnNumber}) already exists for Supplier '${supplier.companyName || supplier.name}' with Challan No '${cleanChallan}'`
      );
    }

    const grnNumber = generateReferenceCode("GRN", Math.floor(Math.random() * 9000 + 1000));

    // Handle initial items if manual entry
    let items: IGRNItem[] = [];
    let allocatedTotals = {
      grossTotal: 0,
      totalLineDiscount: 0,
      invoiceDiscount: 0,
      cashDiscount: 0,
      tradeDiscount: 0,
      freightCharge: 0,
      handlingCharge: 0,
      otherCharges: 0,
      taxTotal: 0,
      netInvoiceTotal: 0,
    };

    if (input.items && input.items.length > 0) {
      // Run product matching if needed
      const processedItems: Array<Partial<IGRNItem>> = [];
      for (const rawItem of input.items) {
        if (!rawItem.productId && rawItem.productName) {
          const match = await ProductMatcherService.matchLineItem(bId, {
            rawName: rawItem.productName,
            sku: rawItem.sku,
            barcode: rawItem.barcode,
            uom: rawItem.uom,
          });
          processedItems.push({
            ...rawItem,
            productId: match.productId || null,
            variantId: match.variantId || null,
            matchStatus: match.matchStatus,
            matchConfidence: match.matchConfidence,
            matchedVariantName: match.matchedVariantName,
            sku: match.sku || rawItem.sku,
            barcode: match.barcode || rawItem.barcode,
            unitPurchasePrice: rawItem.unitPurchasePrice ?? match.suggestedPurchasePrice ?? 0,
          });
        } else {
          processedItems.push(rawItem);
        }
      }

      const allocated = GrnCostAllocationService.allocateCosts({
        items: processedItems.map((pi) => ({
          ...pi,
          challanQuantity: pi.challanQuantity || 0,
          unitPurchasePrice: pi.unitPurchasePrice || 0,
        })),
        invoiceDiscount: input.invoiceDiscount,
        invoiceDiscountType: input.invoiceDiscountType,
        cashDiscount: input.cashDiscount,
        tradeDiscount: input.tradeDiscount,
        freightCharge: input.freightCharge,
        handlingCharge: input.handlingCharge,
        otherCharges: input.otherCharges,
        allocationPolicy: input.discountAllocationPolicy,
      });

      items = allocated.items;
      allocatedTotals = allocated;
    }

    const status: GRNStatus = items.length > 0 ? "NEEDS_REVIEW" : "DRAFT";

    const grn = await GoodsReceiptNote.create({
      businessId: bId,
      dealershipId: dId,
      warehouseId: wId,
      supplierId: sId,
      principalCompanyId: pCompId,
      purchaseOrderId: poId,
      grnNumber,
      challanNumber: cleanChallan,
      challanDate: new Date(input.challanDate),
      invoiceNumber: input.invoiceNumber?.trim(),
      invoiceDate: input.invoiceDate ? new Date(input.invoiceDate) : undefined,
      status,
      ocrStatus: "NOT_RUN",
      items,
      grossTotal: allocatedTotals.grossTotal,
      totalLineDiscount: allocatedTotals.totalLineDiscount,
      invoiceDiscount: allocatedTotals.invoiceDiscount,
      invoiceDiscountType: input.invoiceDiscountType || "fixed",
      cashDiscount: allocatedTotals.cashDiscount,
      tradeDiscount: allocatedTotals.tradeDiscount,
      freightCharge: allocatedTotals.freightCharge,
      handlingCharge: allocatedTotals.handlingCharge,
      otherCharges: allocatedTotals.otherCharges,
      taxTotal: allocatedTotals.taxTotal,
      netInvoiceTotal: allocatedTotals.netInvoiceTotal,
      discountAllocationPolicy: input.discountAllocationPolicy || "proportional_value",
      createdBy: actId,
      notes: input.notes,
    });

    await AuditLog.create({
      actorId: actId,
      action: "GRN_CREATED",
      entityType: "grn",
      entityId: String(grn._id),
      afterSnapshot: {
        grnNumber: grn.grnNumber,
        challanNumber: grn.challanNumber,
        status: grn.status,
        itemsCount: items.length,
      },
    });

    return grn;
  }

  /**
   * Upload and attach challan document to GRN
   */
  static async attachDocument(params: {
    grnId: string | mongoose.Types.ObjectId;
    fileBuffer: Buffer;
    originalName: string;
    mimeType: string;
    actorId: string | mongoose.Types.ObjectId;
  }): Promise<IGoodsReceiptNote> {
    const grn = await GoodsReceiptNote.findById(params.grnId);
    if (!grn) throw new Error("GRN not found");

    if (grn.status === "VERIFIED" || grn.status === "CANCELLED") {
      throw new Error(`Cannot attach document to GRN in status '${grn.status}'`);
    }

    const allowedMimes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowedMimes.includes(params.mimeType.toLowerCase())) {
      throw new Error(
        `Invalid file type '${params.mimeType}'. Allowed formats: PDF, JPEG, PNG, WEBP.`
      );
    }

    const maxBytes = 10 * 1024 * 1024; // 10MB
    if (params.fileBuffer.length > maxBytes) {
      throw new Error("File size exceeds 10MB limit");
    }

    // SHA-256 hash for integrity
    const hash = crypto.createHash("sha256").update(params.fileBuffer).digest("hex");

    // Storage path: storage/challans/<businessId>/<uuid>.<ext>
    const ext = path.extname(params.originalName) || ".bin";
    const storageDir = path.join(process.cwd(), "storage", "challans", String(grn.businessId));
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    const filename = `${grn.grnNumber}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}${ext}`;
    const absolutePath = path.join(storageDir, filename);
    fs.writeFileSync(absolutePath, params.fileBuffer);

    const relativePath = path.join("storage", "challans", String(grn.businessId), filename);

    grn.document = {
      originalName: params.originalName,
      mimeType: params.mimeType,
      size: params.fileBuffer.length,
      path: relativePath,
      hash,
      uploadedAt: new Date(),
      uploadedBy: new mongoose.Types.ObjectId(String(params.actorId)),
    };

    await grn.save();
    return grn;
  }

  /**
   * Trigger OCR on attached document (Optional workflow)
   */
  static async triggerOcr(
    grnId: string | mongoose.Types.ObjectId,
    actorId: string | mongoose.Types.ObjectId
  ): Promise<IGoodsReceiptNote> {
    const grn = await GoodsReceiptNote.findById(grnId);
    if (!grn) throw new Error("GRN not found");

    if (!grn.document || !grn.document.path) {
      throw new Error("No challan document attached to this GRN. Please upload a document first.");
    }

    const filePath = path.join(process.cwd(), grn.document.path);
    if (!fs.existsSync(filePath)) {
      throw new Error("Attached challan file not found on disk");
    }

    const fileBuffer = fs.readFileSync(filePath);
    const result = await OcrService.extract(fileBuffer, grn.document.mimeType, {
      filename: grn.document.originalName,
    });

    if (!result.isConfigured || result.status === "NOT_CONFIGURED") {
      grn.ocrStatus = "NOT_CONFIGURED";
      grn.ocrMetadata = {
        provider: result.provider,
        rawText: result.rawText,
        extractedAt: new Date(),
        overallConfidence: 0,
      };
      await grn.save();
      return grn;
    }

    if (result.status === "FAILED") {
      grn.ocrStatus = "FAILED";
      grn.ocrMetadata = {
        provider: result.provider,
        rawText: result.rawText,
        extractedAt: new Date(),
        overallConfidence: 0,
      };
      await grn.save();
      return grn;
    }

    // OCR extracted data successfully: run product matching on extracted lines
    const matchedItems: Array<Partial<IGRNItem>> = [];
    for (const extractedLine of result.lineItems) {
      const match = await ProductMatcherService.matchLineItem(grn.businessId, {
        rawName: extractedLine.rawName,
        sku: extractedLine.sku,
        barcode: extractedLine.barcode,
        uom: extractedLine.uom,
      });

      matchedItems.push({
        productName: extractedLine.rawName,
        productId: match.productId || null,
        variantId: match.variantId || null,
        matchStatus: match.matchStatus,
        matchConfidence: match.matchConfidence,
        matchedVariantName: match.matchedVariantName,
        sku: match.sku || extractedLine.sku,
        barcode: match.barcode || extractedLine.barcode,
        uom: extractedLine.uom || "pcs",
        challanQuantity: extractedLine.quantity,
        receivedQuantity: extractedLine.quantity,
        supplierSchemeFreeQuantity: extractedLine.schemeFreeQty || 0,
        manualFreeQuantity: 0,
        unitPurchasePrice: extractedLine.unitPrice ?? match.suggestedPurchasePrice ?? 0,
        lineDiscount: extractedLine.lineDiscount || 0,
        taxAmount: extractedLine.tax || 0,
      });
    }

    const allocated = GrnCostAllocationService.allocateCosts({
      items: matchedItems.map((m) => ({
        ...m,
        challanQuantity: m.challanQuantity || 0,
        unitPurchasePrice: m.unitPurchasePrice || 0,
      })),
      invoiceDiscount: result.invoiceDiscount?.value ?? grn.invoiceDiscount,
      cashDiscount: result.cashDiscount?.value ?? grn.cashDiscount,
      tradeDiscount: result.tradeDiscount?.value ?? grn.tradeDiscount,
      freightCharge: result.freightCharge?.value ?? grn.freightCharge,
      handlingCharge: result.handlingCharge?.value ?? grn.handlingCharge,
      allocationPolicy: grn.discountAllocationPolicy,
    });

    grn.items = allocated.items;
    grn.grossTotal = allocated.grossTotal;
    grn.totalLineDiscount = allocated.totalLineDiscount;
    grn.invoiceDiscount = allocated.invoiceDiscount;
    grn.cashDiscount = allocated.cashDiscount;
    grn.tradeDiscount = allocated.tradeDiscount;
    grn.freightCharge = allocated.freightCharge;
    grn.handlingCharge = allocated.handlingCharge;
    grn.netInvoiceTotal = allocated.netInvoiceTotal;
    grn.ocrStatus = "COMPLETED";
    grn.status = "NEEDS_REVIEW";
    grn.ocrMetadata = {
      provider: result.provider,
      rawText: result.rawText,
      extractedAt: new Date(),
      overallConfidence: result.overallConfidence,
    };

    await grn.save();
    return grn;
  }

  /**
   * Update GRN line items, physical receiving counts, discounts, and product corrections
   */
  static async updateGrn(
    grnId: string | mongoose.Types.ObjectId,
    input: UpdateGrnInput
  ): Promise<IGoodsReceiptNote> {
    const grn = await GoodsReceiptNote.findById(grnId);
    if (!grn) throw new Error("GRN not found");

    if (grn.status === "VERIFIED" || grn.status === "CANCELLED") {
      throw new Error(`Cannot modify GRN in status '${grn.status}'`);
    }

    const actId = new mongoose.Types.ObjectId(String(input.actorId));

    // Audit corrections
    const corrections = grn.corrections || [];
    corrections.push({
      field: "items_and_discounts",
      previousValue: { itemsCount: grn.items.length, netTotal: grn.netInvoiceTotal },
      newValue: { itemsCount: input.items.length },
      actorId: actId,
      reason: input.reason || "Manual GRN line update",
      timestamp: new Date(),
    });

    const allocated = GrnCostAllocationService.allocateCosts({
      items: input.items.map((it) => ({
        ...it,
        challanQuantity: it.challanQuantity || 0,
        unitPurchasePrice: it.unitPurchasePrice || 0,
      })),
      invoiceDiscount: input.invoiceDiscount ?? grn.invoiceDiscount,
      invoiceDiscountType: input.invoiceDiscountType ?? grn.invoiceDiscountType,
      cashDiscount: input.cashDiscount ?? grn.cashDiscount,
      tradeDiscount: input.tradeDiscount ?? grn.tradeDiscount,
      freightCharge: input.freightCharge ?? grn.freightCharge,
      handlingCharge: input.handlingCharge ?? grn.handlingCharge,
      otherCharges: input.otherCharges ?? grn.otherCharges,
      allocationPolicy: input.discountAllocationPolicy ?? grn.discountAllocationPolicy,
    });

    // Check if ready for confirmation (all items must have productId and variantId assigned)
    const allMatched = allocated.items.length > 0 && allocated.items.every((i) => i.productId && i.variantId);
    const newStatus: GRNStatus = allMatched ? "READY_FOR_CONFIRMATION" : "NEEDS_REVIEW";

    grn.items = allocated.items;
    grn.grossTotal = allocated.grossTotal;
    grn.totalLineDiscount = allocated.totalLineDiscount;
    grn.invoiceDiscount = allocated.invoiceDiscount;
    grn.invoiceDiscountType = input.invoiceDiscountType ?? grn.invoiceDiscountType;
    grn.cashDiscount = allocated.cashDiscount;
    grn.tradeDiscount = allocated.tradeDiscount;
    grn.freightCharge = allocated.freightCharge;
    grn.handlingCharge = allocated.handlingCharge;
    grn.otherCharges = allocated.otherCharges;
    grn.taxTotal = allocated.taxTotal;
    grn.netInvoiceTotal = allocated.netInvoiceTotal;
    grn.status = newStatus;
    grn.corrections = corrections;
    if (input.notes) grn.notes = input.notes;

    await grn.save();
    return grn;
  }

  /**
   * Confirm and Verify GRN: Concurrency-safe, Idempotent, and updates physical stock & batches
   */
  static async confirmGrn(params: {
    grnId: string | mongoose.Types.ObjectId;
    idempotencyKey?: string;
    actorId: string | mongoose.Types.ObjectId;
    session?: mongoose.ClientSession;
  }): Promise<IGoodsReceiptNote> {
    const grnId = new mongoose.Types.ObjectId(String(params.grnId));
    const actId = new mongoose.Types.ObjectId(String(params.actorId));
    const cleanIdempotencyKey = params.idempotencyKey?.trim();

    // 1. Idempotency Check: if already verified with matching key, return immediately
    const existing = await GoodsReceiptNote.findById(grnId).session(params.session || null);
    if (!existing) throw new Error("GRN not found");

    if (existing.status === "VERIFIED") {
      if (cleanIdempotencyKey && existing.idempotencyKey === cleanIdempotencyKey) {
        return existing; // Idempotent duplicate call
      }
      throw new Error(`GRN ${existing.grnNumber} is already VERIFIED`);
    }

    if (existing.status === "CANCELLED") {
      throw new Error("Cannot confirm a CANCELLED GRN");
    }

    // Must be in READY_FOR_CONFIRMATION (or NEEDS_REVIEW if all products matched)
    const allMatched = existing.items.length > 0 && existing.items.every((i) => i.productId && i.variantId);
    if (!allMatched) {
      throw new Error(
        "Cannot confirm GRN: Some items have not been matched to catalog products and variants"
      );
    }

    // 2. Concurrency-Safe Atomic Status Transition
    const updated = await GoodsReceiptNote.findOneAndUpdate(
      {
        _id: grnId,
        status: { $in: ["READY_FOR_CONFIRMATION", "NEEDS_REVIEW"] },
      },
      {
        $set: {
          status: "VERIFIED",
          idempotencyKey: cleanIdempotencyKey,
          verifiedBy: actId,
          verifiedAt: new Date(),
        },
      },
      { new: true, session: params.session || null }
    );

    if (!updated) {
      throw new Error(
        "Concurrent confirmation conflict: GRN was modified or verified by another request"
      );
    }

    // 3. Receive stock and create batches in inventory
    const stockItemsToReceive: Array<{
      productId: string | mongoose.Types.ObjectId;
      variantId: string | mongoose.Types.ObjectId;
      quantity: number;
      unitCost: number;
      batchNumber?: string;
      grossPurchasePrice?: number;
      lineDiscount?: number;
      allocatedFreight?: number;
      allocatedHandling?: number;
      supplierSchemeFreeQuantity?: number;
      manualFreeQuantity?: number;
      expiryDate?: Date | null;
    }> = [];

    const damagedItems: Array<{
      productId: string | mongoose.Types.ObjectId;
      variantId: string | mongoose.Types.ObjectId;
      damagedQty: number;
    }> = [];

    for (const item of updated.items) {
      const receivedQty = item.receivedQuantity || 0;
      const damagedQty = item.damagedQuantity || 0;
      const rejectedQty = item.rejectedQuantity || 0;
      const goodQty = Math.max(0, receivedQty - damagedQty - rejectedQty);
      const schemeFreeQty = item.supplierSchemeFreeQuantity || 0;
      const manualFreeQty = item.manualFreeQuantity || 0;
      const totalUnitsToStock = goodQty + schemeFreeQty + manualFreeQty;

      if (totalUnitsToStock > 0 && item.productId && item.variantId) {
        stockItemsToReceive.push({
          productId: item.productId,
          variantId: item.variantId,
          quantity: goodQty,
          unitCost: item.netLandedUnitCost,
          batchNumber: item.batchNumber || `${updated.grnNumber}-B${item.lineItemNumber}`,
          grossPurchasePrice: item.unitPurchasePrice * goodQty,
          lineDiscount: item.lineDiscount + item.allocatedInvoiceDiscount,
          allocatedFreight: item.allocatedFreight,
          allocatedHandling: item.allocatedHandling,
          supplierSchemeFreeQuantity: schemeFreeQty,
          manualFreeQuantity: manualFreeQty,
          expiryDate: item.expiryDate,
        });
      }

      if (damagedQty > 0 && item.productId && item.variantId) {
        damagedItems.push({
          productId: item.productId,
          variantId: item.variantId,
          damagedQty,
        });
      }
    }

    if (stockItemsToReceive.length > 0) {
      await InventoryService.receiveStock({
        businessId: updated.businessId,
        dealershipId: updated.dealershipId,
        warehouseId: updated.warehouseId,
        items: stockItemsToReceive,
        referenceId: updated.grnNumber,
        referenceType: "grn_receipt",
        supplierId: updated.supplierId,
        principalCompanyId: updated.principalCompanyId,
        purchaseInvoiceRef: updated.invoiceNumber,
        challanNumber: updated.challanNumber,
        actorId: actId,
        session: params.session,
      });
    }

    // Record damaged units directly under the originating dealership's balance and ledger
    for (const d of damagedItems) {
      const balance = await InventoryService.getOrCreateBalance(
        updated.businessId,
        updated.dealershipId,
        updated.warehouseId,
        d.productId,
        d.variantId,
        params.session
      );
      balance.damagedQuantity = (balance.damagedQuantity || 0) + d.damagedQty;
      balance.lastUpdated = new Date();
      await balance.save({ session: params.session });

      const moveCode = generateReferenceCode("STK-DMG", Math.floor(Math.random() * 9000 + 1000));
      await StockMovement.create(
        [
          {
            movementNumber: moveCode,
            type: "damage",
            businessId: updated.businessId,
            dealershipId: updated.dealershipId,
            warehouseId: updated.warehouseId,
            productId: d.productId,
            variantId: d.variantId,
            quantity: d.damagedQty,
            unitCost: 0,
            totalCost: 0,
            previousOnHand: balance.onHandQuantity,
            newOnHand: balance.onHandQuantity,
            previousReserved: balance.reservedQuantity,
            newReserved: balance.reservedQuantity,
            referenceType: "grn_receipt_damage",
            referenceId: updated.grnNumber,
            notes: `Damaged in transit / on arrival under GRN ${updated.grnNumber}`,
            createdBy: actId,
          } as any,
        ],
        { session: params.session }
      );
    }

    // 4. Update originating Purchase Order if linked
    if (updated.purchaseOrderId) {
      try {
        await PurchaseOrderService.recordGrnReceipt({
          poId: updated.purchaseOrderId,
          grnId: updated._id,
          receivedItems: updated.items.map((it) => ({
            productId: it.productId as mongoose.Types.ObjectId,
            variantId: it.variantId as mongoose.Types.ObjectId,
            receivedQuantity: Math.max(0, (it.receivedQuantity || 0) - (it.damagedQuantity || 0) - (it.rejectedQuantity || 0)),
          })),
          session: params.session,
        });
      } catch (poErr) {
        console.error("[confirmGrn] PO sync warning:", poErr);
      }
    }

    // 5. Create Supplier Payable record idempotently and update vendor outstanding balance
    const existingPayable = await SupplierPayable.findOne({
      businessId: updated.businessId,
      grnId: updated._id,
      isCancelled: false,
    }).session(params.session || null);

    if (!existingPayable && updated.netInvoiceTotal > 0) {
      const payableNumber = generateReferenceCode("PAY", Math.floor(Math.random() * 9000 + 1000));
      await SupplierPayable.create(
        [
          {
            businessId: updated.businessId,
            dealershipId: updated.dealershipId,
            supplierId: updated.supplierId,
            principalCompanyId: updated.principalCompanyId,
            grnId: updated._id,
            purchaseOrderId: updated.purchaseOrderId,
            payableNumber,
            invoiceNumber: updated.invoiceNumber || updated.challanNumber,
            invoiceDate: updated.invoiceDate || updated.challanDate,
            challanNumber: updated.challanNumber,
            grossAmount: updated.grossTotal,
            earnedDiscounts: updated.totalLineDiscount + updated.invoiceDiscount + updated.tradeDiscount,
            conditionalCashDiscount: updated.cashDiscount,
            freightCharge: updated.freightCharge,
            handlingCharge: updated.handlingCharge,
            taxAmount: updated.taxTotal,
            netPayable: updated.netInvoiceTotal,
            paidAmount: 0,
            outstandingBalance: updated.netInvoiceTotal,
            status: "UNPAID",
          },
        ],
        { session: params.session }
      );

      // Increment supplier's current payable
      await Vendor.findByIdAndUpdate(
        updated.supplierId,
        { $inc: { currentPayable: updated.netInvoiceTotal } },
        { session: params.session }
      );
    }

    await AuditLog.create({
      actorId: actId,
      action: "GRN_VERIFIED",
      entityType: "grn",
      entityId: String(updated._id),
      afterSnapshot: {
        grnNumber: updated.grnNumber,
        netInvoiceTotal: updated.netInvoiceTotal,
        receivedStockItemsCount: stockItemsToReceive.length,
        damagedItemsCount: damagedItems.length,
      },
    });

    return updated;
  }

  /**
   * Cancel an unverified GRN
   */
  static async cancelGrn(params: {
    grnId: string | mongoose.Types.ObjectId;
    reason: string;
    actorId: string | mongoose.Types.ObjectId;
  }): Promise<IGoodsReceiptNote> {
    const grn = await GoodsReceiptNote.findById(params.grnId);
    if (!grn) throw new Error("GRN not found");

    if (grn.status === "VERIFIED") {
      throw new Error("Cannot cancel a VERIFIED GRN. Use Purchase Return for stock reversal.");
    }

    grn.status = "CANCELLED";
    grn.isCancelled = true;
    grn.cancelledBy = new mongoose.Types.ObjectId(String(params.actorId));
    grn.cancelledAt = new Date();
    grn.cancellationReason = params.reason;

    await grn.save();
    return grn;
  }
}
