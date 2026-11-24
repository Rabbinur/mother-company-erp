export interface OcrFieldConfidence<T> {
  value: T;
  confidence: number; // 0.0 - 1.0
  isEstimated?: boolean;
}

export interface OcrExtractedLineItem {
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
  confidence: number;
  fieldConfidences?: Record<string, number>;
}

export interface OcrExtractionResult {
  provider: string;
  isConfigured: boolean;
  rawText: string;
  overallConfidence: number;
  status: "COMPLETED" | "PARTIAL" | "FAILED" | "NOT_CONFIGURED";
  errorMessage?: string;

  supplierName?: OcrFieldConfidence<string>;
  principalCompanyName?: OcrFieldConfidence<string>;
  challanNumber?: OcrFieldConfidence<string>;
  challanDate?: OcrFieldConfidence<Date | string>;
  invoiceNumber?: OcrFieldConfidence<string>;
  invoiceDate?: OcrFieldConfidence<Date | string>;

  lineItems: OcrExtractedLineItem[];

  grossTotal?: OcrFieldConfidence<number>;
  invoiceDiscount?: OcrFieldConfidence<number>;
  cashDiscount?: OcrFieldConfidence<number>;
  tradeDiscount?: OcrFieldConfidence<number>;
  freightCharge?: OcrFieldConfidence<number>;
  handlingCharge?: OcrFieldConfidence<number>;
  taxTotal?: OcrFieldConfidence<number>;
  netTotal?: OcrFieldConfidence<number>;
}

export interface IOcrProvider {
  readonly name: string;
  isConfigured(): boolean;
  extractFromFile(
    fileBuffer: Buffer,
    mimeType: string,
    options?: { filename?: string }
  ): Promise<OcrExtractionResult>;
}
