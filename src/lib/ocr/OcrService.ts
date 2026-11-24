import type { IOcrProvider, OcrExtractionResult } from "./types";
import { UnconfiguredOcrProvider } from "./UnconfiguredOcrProvider";
import { MockOcrProvider } from "./MockOcrProvider";

export class OcrService {
  private static activeProvider: IOcrProvider = new UnconfiguredOcrProvider();

  /**
   * Set or override current OCR provider (useful for testing or plugin configuration)
   */
  static setProvider(provider: IOcrProvider): void {
    this.activeProvider = provider;
  }

  /**
   * Get active provider instance
   */
  static getProvider(): IOcrProvider {
    // If environment specifies mock provider or custom provider
    if (process.env.OCR_PROVIDER === "mock" && !(this.activeProvider instanceof MockOcrProvider)) {
      this.activeProvider = new MockOcrProvider();
    }
    return this.activeProvider;
  }

  /**
   * Check if OCR is operational
   */
  static isConfigured(): boolean {
    return this.getProvider().isConfigured();
  }

  /**
   * Extract challan data from uploaded buffer
   */
  static async extract(
    buffer: Buffer,
    mimeType: string,
    options?: { filename?: string }
  ): Promise<OcrExtractionResult> {
    const provider = this.getProvider();
    return await provider.extractFromFile(buffer, mimeType, options);
  }
}
