import mongoose from "mongoose";
import { Product, type IProduct } from "@/models/Product";
import { ProductVariant, type IProductVariant } from "@/models/ProductVariant";

export interface MatchQueryInput {
  rawName: string;
  sku?: string;
  barcode?: string;
  uom?: string;
}

export interface MatchCandidate {
  productId: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  sku: string;
  barcode?: string;
  purchasePrice?: number;
  score: number;
}

export interface ProductMatchResult {
  matchStatus: "matched" | "ambiguous" | "unmatched" | "manual";
  matchConfidence: number;
  productId?: mongoose.Types.ObjectId;
  variantId?: mongoose.Types.ObjectId;
  productName?: string;
  matchedVariantName?: string;
  sku?: string;
  barcode?: string;
  suggestedPurchasePrice?: number;
  candidates?: MatchCandidate[];
}

export class ProductMatcherService {
  /**
   * Normalize text by removing noise characters, punctuation, and extra whitespace
   */
  static normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Calculate Jaccard similarity score between two token sets
   */
  static tokenSimilarity(a: string, b: string): number {
    const tokensA = new Set(this.normalizeText(a).split(" ").filter(t => t.length > 1));
    const tokensB = new Set(this.normalizeText(b).split(" ").filter(t => t.length > 1));

    if (tokensA.size === 0 || tokensB.size === 0) return 0;

    let intersection = 0;
    for (const t of tokensA) {
      if (tokensB.has(t)) intersection++;
    }

    const union = new Set([...tokensA, ...tokensB]).size;
    return union === 0 ? 0 : intersection / union;
  }

  /**
   * Match an OCR line item against the central Product Catalog
   */
  static async matchLineItem(
    businessId: string | mongoose.Types.ObjectId | undefined,
    input: MatchQueryInput
  ): Promise<ProductMatchResult> {
    const bId = businessId ? new mongoose.Types.ObjectId(String(businessId)) : undefined;
    const baseFilter = bId ? { $or: [{ businessId: bId }, { businessId: { $exists: false } }, { businessId: null }] } : {};

    // 1. Exact Barcode Match (Variant or Product)
    if (input.barcode && input.barcode.trim()) {
      const barcode = input.barcode.trim();
      const variant = await ProductVariant.findOne({
        barcode,
        status: "active",
        ...baseFilter,
      }).lean();

      if (variant) {
        const prod = await Product.findById(variant.productId).lean();
        return {
          matchStatus: "matched",
          matchConfidence: 1.0,
          productId: variant.productId as mongoose.Types.ObjectId,
          variantId: variant._id as mongoose.Types.ObjectId,
          productName: prod ? prod.name : input.rawName,
          matchedVariantName: variant.variantName,
          sku: variant.sku,
          barcode: variant.barcode,
          suggestedPurchasePrice: variant.purchasePrice,
        };
      }

      const prod = await Product.findOne({
        barcode,
        status: "active",
        ...baseFilter,
      }).lean();

      if (prod) {
        const defaultVariant = await ProductVariant.findOne({
          productId: prod._id,
          status: "active",
        }).lean();

        return {
          matchStatus: "matched",
          matchConfidence: 0.98,
          productId: prod._id as mongoose.Types.ObjectId,
          variantId: defaultVariant ? (defaultVariant._id as mongoose.Types.ObjectId) : undefined,
          productName: prod.name,
          matchedVariantName: defaultVariant?.variantName,
          sku: defaultVariant?.sku || prod.sku,
          barcode: prod.barcode,
          suggestedPurchasePrice: defaultVariant?.purchasePrice,
        };
      }
    }

    // 2. Exact SKU Match
    if (input.sku && input.sku.trim()) {
      const sku = input.sku.trim().toUpperCase();
      const variant = await ProductVariant.findOne({
        sku,
        status: "active",
        ...baseFilter,
      }).lean();

      if (variant) {
        const prod = await Product.findById(variant.productId).lean();
        return {
          matchStatus: "matched",
          matchConfidence: 1.0,
          productId: variant.productId as mongoose.Types.ObjectId,
          variantId: variant._id as mongoose.Types.ObjectId,
          productName: prod ? prod.name : input.rawName,
          matchedVariantName: variant.variantName,
          sku: variant.sku,
          barcode: variant.barcode,
          suggestedPurchasePrice: variant.purchasePrice,
        };
      }

      const prod = await Product.findOne({
        $or: [{ sku }, { code: sku }],
        status: "active",
        ...baseFilter,
      }).lean();

      if (prod) {
        const defaultVariant = await ProductVariant.findOne({
          productId: prod._id,
          status: "active",
        }).lean();

        return {
          matchStatus: "matched",
          matchConfidence: 0.98,
          productId: prod._id as mongoose.Types.ObjectId,
          variantId: defaultVariant ? (defaultVariant._id as mongoose.Types.ObjectId) : undefined,
          productName: prod.name,
          matchedVariantName: defaultVariant?.variantName,
          sku: defaultVariant?.sku || prod.sku,
          suggestedPurchasePrice: defaultVariant?.purchasePrice,
        };
      }
    }

    // 3. Exact Case-Insensitive Name Match
    if (input.rawName && input.rawName.trim()) {
      const trimmedName = input.rawName.trim();
      const exactProduct = await Product.findOne({
        name: { $regex: new RegExp(`^${escapeRegex(trimmedName)}$`, "i") },
        status: "active",
        ...baseFilter,
      }).lean();

      if (exactProduct) {
        const variants = await ProductVariant.find({
          productId: exactProduct._id,
          status: "active",
        }).lean();

        if (variants.length === 1) {
          return {
            matchStatus: "matched",
            matchConfidence: 0.95,
            productId: exactProduct._id as mongoose.Types.ObjectId,
            variantId: variants[0]._id as mongoose.Types.ObjectId,
            productName: exactProduct.name,
            matchedVariantName: variants[0].variantName,
            sku: variants[0].sku,
            barcode: variants[0].barcode,
            suggestedPurchasePrice: variants[0].purchasePrice,
          };
        } else if (variants.length > 1) {
          // Multiple variants available — ambiguous, requires manual selection
          return {
            matchStatus: "ambiguous",
            matchConfidence: 0.70,
            productId: exactProduct._id as mongoose.Types.ObjectId,
            productName: exactProduct.name,
            candidates: variants.map((v) => ({
              productId: String(exactProduct._id),
              variantId: String(v._id),
              productName: exactProduct.name,
              variantName: v.variantName,
              sku: v.sku,
              barcode: v.barcode,
              purchasePrice: v.purchasePrice,
              score: 0.95,
            })),
          };
        }
      }

      // 4. Token-Based Fuzzy Search
      const searchTokens = this.normalizeText(trimmedName).split(" ").filter(t => t.length > 2);
      if (searchTokens.length > 0) {
        const regexPatterns = searchTokens.map(t => new RegExp(escapeRegex(t), "i"));
        const candidateProducts = await Product.find({
          name: { $in: regexPatterns },
          status: "active",
          ...baseFilter,
        })
          .limit(10)
          .lean();

        const scoredCandidates: MatchCandidate[] = [];

        for (const prod of candidateProducts) {
          const score = this.tokenSimilarity(trimmedName, prod.name);
          if (score >= 0.4) {
            const variants = await ProductVariant.find({
              productId: prod._id,
              status: "active",
            }).lean();

            if (variants.length > 0) {
              for (const v of variants) {
                scoredCandidates.push({
                  productId: String(prod._id),
                  variantId: String(v._id),
                  productName: prod.name,
                  variantName: v.variantName,
                  sku: v.sku,
                  barcode: v.barcode,
                  purchasePrice: v.purchasePrice,
                  score,
                });
              }
            } else {
              scoredCandidates.push({
                productId: String(prod._id),
                productName: prod.name,
                sku: prod.sku,
                score,
              });
            }
          }
        }

        // Sort descending by score
        scoredCandidates.sort((a, b) => b.score - a.score);

        if (scoredCandidates.length > 0) {
          const top = scoredCandidates[0];
          // If top candidate is very high and significantly better than second
          if (top.score >= 0.85 && (scoredCandidates.length === 1 || top.score - scoredCandidates[1].score > 0.2)) {
            return {
              matchStatus: "matched",
              matchConfidence: top.score,
              productId: new mongoose.Types.ObjectId(top.productId),
              variantId: top.variantId ? new mongoose.Types.ObjectId(top.variantId) : undefined,
              productName: top.productName,
              matchedVariantName: top.variantName,
              sku: top.sku,
              barcode: top.barcode,
              suggestedPurchasePrice: top.purchasePrice,
              candidates: scoredCandidates.slice(0, 5),
            };
          }

          // Otherwise ambiguous
          return {
            matchStatus: "ambiguous",
            matchConfidence: top.score,
            candidates: scoredCandidates.slice(0, 5),
          };
        }
      }
    }

    // 5. Unmatched
    return {
      matchStatus: "unmatched",
      matchConfidence: 0.0,
      candidates: [],
    };
  }
}

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}
