import type { IOcrProvider, OcrExtractionResult } from "./types";

export class UnconfiguredOcrProvider implements IOcrProvider {
  readonly name = "unconfigured";

  isConfigured(): boolean {
    return false;
  }

  async extractFromFile(
    _fileBuffer: Buffer,
    _mimeType: string,
    _options?: { filename?: string }
  ): Promise<OcrExtractionResult> {
    return {
      provider: this.name,
      isConfigured: false,
      status: "NOT_CONFIGURED",
      rawText: "",
      overallConfidence: 0,
      errorMessage:
        "No OCR provider is currently configured. Please configure an OCR service API key or continue with primary Manual Challan Entry.",
      lineItems: [],
    };
  }
}
