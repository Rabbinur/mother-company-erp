import type { IOcrProvider, OcrExtractionResult } from "./types";

export interface MockExtractionPreset {
  supplierName?: string;
  principalCompanyName?: string;
  challanNumber?: string;
  challanDate?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  lineItems: Array<{
    rawName: string;
    sku?: string;
    barcode?: string;
    quantity: number;
    uom?: string;
    unitPrice?: number;
    lineDiscount?: number;
    schemeFreeQty?: number;
    tax?: number;
    lineTotal?: number;
    confidence?: number;
  }>;
  grossTotal?: number;
  invoiceDiscount?: number;
  cashDiscount?: number;
  tradeDiscount?: number;
  freightCharge?: number;
  handlingCharge?: number;
  taxTotal?: number;
  netTotal?: number;
}

export class MockOcrProvider implements IOcrProvider {
  readonly name = "mock_ocr";
  private customPreset?: MockExtractionPreset;

  constructor(customPreset?: MockExtractionPreset) {
    this.customPreset = customPreset;
  }

  setPreset(preset: MockExtractionPreset) {
    this.customPreset = preset;
  }

  isConfigured(): boolean {
    return true;
  }

  async extractFromFile(
    fileBuffer: Buffer,
    _mimeType: string,
    _options?: { filename?: string }
  ): Promise<OcrExtractionResult> {
    // If the fileBuffer contains text representation or customPreset is provided
    if (this.customPreset) {
      return {
        provider: this.name,
        isConfigured: true,
        status: "COMPLETED",
        rawText: `[MOCK OCR EXTRACTED TEXT]\nChallan: ${this.customPreset.challanNumber || "CH-1001"}`,
        overallConfidence: 0.94,
        supplierName: this.customPreset.supplierName
          ? { value: this.customPreset.supplierName, confidence: 0.95 }
          : undefined,
        principalCompanyName: this.customPreset.principalCompanyName
          ? { value: this.customPreset.principalCompanyName, confidence: 0.92 }
          : undefined,
        challanNumber: {
          value: this.customPreset.challanNumber || "CH-1001",
          confidence: 0.96,
        },
        challanDate: {
          value: this.customPreset.challanDate || new Date().toISOString().slice(0, 10),
          confidence: 0.93,
        },
        invoiceNumber: this.customPreset.invoiceNumber
          ? { value: this.customPreset.invoiceNumber, confidence: 0.94 }
          : undefined,
        lineItems: this.customPreset.lineItems.map((item) => ({
          rawName: item.rawName,
          sku: item.sku,
          barcode: item.barcode,
          quantity: item.quantity,
          uom: item.uom || "pcs",
          unitPrice: item.unitPrice || 0,
          lineDiscount: item.lineDiscount || 0,
          schemeFreeQty: item.schemeFreeQty || 0,
          tax: item.tax || 0,
          lineTotal: item.lineTotal || (item.quantity * (item.unitPrice || 0) - (item.lineDiscount || 0)),
          confidence: item.confidence ?? 0.91,
          fieldConfidences: {
            name: 0.92,
            quantity: 0.95,
            price: 0.91,
          },
        })),
        grossTotal: this.customPreset.grossTotal !== undefined
          ? { value: this.customPreset.grossTotal, confidence: 0.96 }
          : undefined,
        invoiceDiscount: this.customPreset.invoiceDiscount !== undefined
          ? { value: this.customPreset.invoiceDiscount, confidence: 0.92 }
          : undefined,
        cashDiscount: this.customPreset.cashDiscount !== undefined
          ? { value: this.customPreset.cashDiscount, confidence: 0.90 }
          : undefined,
        tradeDiscount: this.customPreset.tradeDiscount !== undefined
          ? { value: this.customPreset.tradeDiscount, confidence: 0.90 }
          : undefined,
        freightCharge: this.customPreset.freightCharge !== undefined
          ? { value: this.customPreset.freightCharge, confidence: 0.93 }
          : undefined,
        handlingCharge: this.customPreset.handlingCharge !== undefined
          ? { value: this.customPreset.handlingCharge, confidence: 0.91 }
          : undefined,
        taxTotal: this.customPreset.taxTotal !== undefined
          ? { value: this.customPreset.taxTotal, confidence: 0.94 }
          : undefined,
        netTotal: this.customPreset.netTotal !== undefined
          ? { value: this.customPreset.netTotal, confidence: 0.96 }
          : undefined,
      };
    }

    // Default simulation result
    const textStr = fileBuffer.toString("utf8");
    const isSynthetic = textStr.includes("CHALLAN");

    return {
      provider: this.name,
      isConfigured: true,
      status: "COMPLETED",
      rawText: isSynthetic ? textStr : "[Simulated OCR output for scanned document]",
      overallConfidence: 0.88,
      challanNumber: { value: "CH-SIM-9901", confidence: 0.92 },
      challanDate: { value: new Date().toISOString().slice(0, 10), confidence: 0.90 },
      lineItems: [
        {
          rawName: "Standard Synthetic Product Pack 500g",
          sku: "SKU-SYN-01",
          quantity: 20,
          uom: "pcs",
          unitPrice: 150,
          lineDiscount: 100,
          schemeFreeQty: 2,
          lineTotal: 2900,
          confidence: 0.89,
        },
      ],
      grossTotal: { value: 3000, confidence: 0.95 },
      invoiceDiscount: { value: 150, confidence: 0.85 },
      netTotal: { value: 2750, confidence: 0.95 },
    };
  }
}
