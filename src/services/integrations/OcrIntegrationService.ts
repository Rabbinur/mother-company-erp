import type { IOcrProvider, OcrExtractionResult } from "@/lib/ocr/types";

export class OcrIntegrationService implements IOcrProvider {
  readonly name = "cloud_vision_ocr";
  private static instance: OcrIntegrationService;

  static getInstance(): OcrIntegrationService {
    if (!OcrIntegrationService.instance) {
      OcrIntegrationService.instance = new OcrIntegrationService();
    }
    return OcrIntegrationService.instance;
  }

  isConfigured(): boolean {
    const key = process.env.OCR_API_KEY || process.env.GOOGLE_VISION_KEY;
    return Boolean(key && key.trim() !== "");
  }

  /**
   * Extract challan/invoice data from document buffer.
   * SAFETY GUARANTEE: OCR results are advisory drafts only.
   * Output must NEVER automatically verify GRN or mutate inventory balances.
   */
  async extractFromFile(
    fileBuffer: Buffer,
    mimeType: string,
    options?: { filename?: string }
  ): Promise<OcrExtractionResult> {
    if (!this.isConfigured()) {
      return {
        provider: this.name,
        isConfigured: false,
        status: "NOT_CONFIGURED",
        rawText: "",
        overallConfidence: 0,
        errorMessage:
          "Cloud OCR provider is not configured. Please configure OCR_API_KEY or use manual challan entry.",
        lineItems: [],
      };
    }

    try {
      const endpoint =
        process.env.OCR_ENDPOINT ||
        "https://vision.googleapis.com/v1/images:annotate";

      // Execute vision API call when configured in live environment
      const res = await fetch(
        `${endpoint}?key=${process.env.OCR_API_KEY || process.env.GOOGLE_VISION_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: [
              {
                image: { content: fileBuffer.toString("base64") },
                features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
              },
            ],
          }),
          signal: AbortSignal.timeout(5000),
        }
      );

      if (!res.ok) {
        return {
          provider: this.name,
          isConfigured: true,
          status: "FAILED",
          rawText: "",
          overallConfidence: 0,
          errorMessage: `OCR service responded with HTTP ${res.status}. Continue with manual challan entry.`,
          lineItems: [],
        };
      }

      const data = await res.json();
      const rawText =
        data.responses?.[0]?.fullTextAnnotation?.text || "";

      return {
        provider: this.name,
        isConfigured: true,
        status: "COMPLETED",
        rawText,
        overallConfidence: 0.85,
        lineItems: [],
      };
    } catch (err: unknown) {
      const isTimeout = err instanceof Error && err.name === "TimeoutError";
      const message = isTimeout
        ? "OCR service request timed out after 5000ms"
        : err instanceof Error
        ? err.message
        : "OCR processing error";
      return {
        provider: this.name,
        isConfigured: true,
        status: "FAILED",
        rawText: "",
        overallConfidence: 0,
        errorMessage: `${message}. Fallback to manual entry available.`,
        lineItems: [],
      };
    }
  }
}
