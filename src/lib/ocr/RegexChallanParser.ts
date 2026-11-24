import type { OcrExtractedLineItem, OcrFieldConfidence } from "./types";

export class RegexChallanParser {
  /**
   * Parse arbitrary raw OCR text blocks into structured challan candidate fields
   */
  static parseRawText(rawText: string): {
    challanNumber?: OcrFieldConfidence<string>;
    challanDate?: OcrFieldConfidence<string>;
    invoiceNumber?: OcrFieldConfidence<string>;
    invoiceDate?: OcrFieldConfidence<string>;
    supplierName?: OcrFieldConfidence<string>;
    lineItems: OcrExtractedLineItem[];
    grossTotal?: OcrFieldConfidence<number>;
    invoiceDiscount?: OcrFieldConfidence<number>;
    netTotal?: OcrFieldConfidence<number>;
  } {
    const lines = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    let challanNumber: OcrFieldConfidence<string> | undefined;
    let challanDate: OcrFieldConfidence<string> | undefined;
    let invoiceNumber: OcrFieldConfidence<string> | undefined;
    let invoiceDate: OcrFieldConfidence<string> | undefined;
    let supplierName: OcrFieldConfidence<string> | undefined;
    let grossTotal: OcrFieldConfidence<number> | undefined;
    let invoiceDiscount: OcrFieldConfidence<number> | undefined;
    let netTotal: OcrFieldConfidence<number> | undefined;
    const lineItems: OcrExtractedLineItem[] = [];

    // Common header regex patterns
    const challanRegex = /(?:challan|chln|delivery\s*challan)\s*(?:no|num|#)?[:.\s]+([a-zA-Z0-9\-_/]+)/i;
    const invoiceRegex = /(?:invoice|bill|inv)\s*(?:no|num|#)?[:.\s]+([a-zA-Z0-9\-_/]+)/i;
    const dateRegex = /(?:date|dated)[:.\s]+(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4})/i;
    const supplierRegex = /(?:supplier|vendor|from|m\/s)[:.\s]+([a-zA-Z0-9\s&.,-]+)/i;
    const grossRegex = /(?:gross\s*total|sub\s*total|total\s*amount)[:.\s]+([\d,.]+)/i;
    const discountRegex = /(?:invoice\s*discount|special\s*discount|disc)[:.\s]+([\d,.]+)/i;
    const netRegex = /(?:net\s*total|grand\s*total|payable)[:.\s]+([\d,.]+)/i;

    // Line item pattern: e.g. "Product Name ... Qty Rate Total" or CSV/tabular format
    // Example: "Soap 100g 50 pcs 25.00 1250.00"
    const itemRegex = /^([a-zA-Z0-9\s().&/-]{3,40})\s+(\d+)\s*(pcs|box|pkt|kg|ltr|units)?\s+([\d,.]+)\s+([\d,.]+)$/i;

    for (const line of lines) {
      if (!challanNumber) {
        const m = line.match(challanRegex);
        if (m) challanNumber = { value: m[1].trim(), confidence: 0.90 };
      }

      if (!invoiceNumber) {
        const m = line.match(invoiceRegex);
        if (m && (!challanNumber || m[1].trim() !== challanNumber.value)) {
          invoiceNumber = { value: m[1].trim(), confidence: 0.88 };
        }
      }

      if (!challanDate) {
        const m = line.match(dateRegex);
        if (m) challanDate = { value: m[1].trim(), confidence: 0.85 };
      }

      if (!supplierName) {
        const m = line.match(supplierRegex);
        if (m) supplierName = { value: m[1].trim(), confidence: 0.82 };
      }

      if (!grossTotal) {
        const m = line.match(grossRegex);
        if (m) {
          const val = parseFloat(m[1].replace(/,/g, ""));
          if (!isNaN(val)) grossTotal = { value: val, confidence: 0.89 };
        }
      }

      if (!invoiceDiscount) {
        const m = line.match(discountRegex);
        if (m) {
          const val = parseFloat(m[1].replace(/,/g, ""));
          if (!isNaN(val)) invoiceDiscount = { value: val, confidence: 0.85 };
        }
      }

      if (!netTotal) {
        const m = line.match(netRegex);
        if (m) {
          const val = parseFloat(m[1].replace(/,/g, ""));
          if (!isNaN(val)) netTotal = { value: val, confidence: 0.92 };
        }
      }

      const itemMatch = line.match(itemRegex);
      if (itemMatch) {
        const rawName = itemMatch[1].trim();
        const qty = parseInt(itemMatch[2], 10);
        const uom = itemMatch[3] ? itemMatch[3].toLowerCase() : "pcs";
        const rate = parseFloat(itemMatch[4].replace(/,/g, ""));
        const lineTot = parseFloat(itemMatch[5].replace(/,/g, ""));

        if (!isNaN(qty) && qty > 0 && !isNaN(rate)) {
          lineItems.push({
            rawName,
            quantity: qty,
            uom,
            unitPrice: rate,
            lineTotal: isNaN(lineTot) ? qty * rate : lineTot,
            confidence: 0.84,
          });
        }
      }
    }

    return {
      challanNumber,
      challanDate,
      invoiceNumber,
      invoiceDate,
      supplierName,
      lineItems,
      grossTotal,
      invoiceDiscount,
      netTotal,
    };
  }
}
