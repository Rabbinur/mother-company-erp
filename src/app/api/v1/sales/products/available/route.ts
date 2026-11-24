import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { requireAuth } from "@/lib/auth/session";
import { Product } from "@/models/Product";
import { ProductVariant } from "@/models/ProductVariant";
import { InventoryBalance } from "@/models/InventoryBalance";
import { PricingService } from "@/services/PricingService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const businessId = user.businessId;
  if (!businessId) return errorResponse("Business context required", 400);

  const searchParams = req.nextUrl.searchParams;
  const dealershipId = searchParams.get("dealershipId") || user.dealershipId || user.activeDealershipId;
  const warehouseId = searchParams.get("warehouseId");

  if (!dealershipId) return errorResponse("Dealership context required", 400);

  await connectDB();

  try {
    const products = await Product.find({ businessId, status: "active" })
      .select("name sku uom")
      .lean();

    const productIds = products.map((p) => p._id);

    const [variants, balances] = await Promise.all([
      ProductVariant.find({ productId: { $in: productIds }, status: "active" })
        .select("productId variantName sku customerPrice retailPrice")
        .lean(),
      warehouseId
        ? InventoryBalance.find({
            businessId,
            dealershipId,
            warehouseId,
          })
            .select("productId variantId onHandQuantity reservedQuantity")
            .lean()
        : [],
    ]);

    const balanceMap = new Map<string, { onHand: number; reserved: number; available: number }>();
    for (const b of balances) {
      const key = `${String(b.productId)}_${String(b.variantId)}`;
      const onHand = b.onHandQuantity || 0;
      const reserved = b.reservedQuantity || 0;
      balanceMap.set(key, {
        onHand,
        reserved,
        available: Math.max(0, onHand - reserved),
      });
    }

    const availableProducts = await Promise.all(
      products.map(async (p) => {
        const prodVariants = variants.filter((v) => String(v.productId) === String(p._id));
        const resolvedVariants = await Promise.all(
          prodVariants.map(async (v) => {
            const priceInfo = await PricingService.resolveActivePrice({
              businessId,
              dealershipId,
              productId: p._id,
              variantId: v._id,
            });

            const key = `${String(p._id)}_${String(v._id)}`;
            const bal = balanceMap.get(key) || { onHand: 0, reserved: 0, available: 0 };

            return {
              _id: String(v._id),
              variantName: v.variantName,
              sku: v.sku,
              customerPrice: priceInfo.customerPrice,
              retailPrice: priceInfo.retailPrice,
              priceSource: priceInfo.priceSource,
              onHand: bal.onHand,
              available: bal.available,
            };
          })
        );

        return {
          _id: String(p._id),
          name: p.name,
          sku: p.sku,
          uom: p.uom,
          variants: resolvedVariants,
        };
      })
    );

    return successResponse(availableProducts, "Available products retrieved");
  } catch (err: any) {
    return errorResponse(err.message || "Failed to fetch products", 500);
  }
}
