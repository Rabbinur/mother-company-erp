import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { authenticateFieldSales } from "@/lib/security/field-sales-auth";
import { Order } from "@/models/Order";
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/utils/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = authenticateFieldSales(req);
  if (!auth.authenticated) {
    return unauthorizedResponse(auth.error || "Invalid Field Sales API credentials");
  }

  const { id } = await params;
  await connectDB();

  const order = await Order.findOne({
    $or: [{ _id: id }, { orderNumber: id }, { externalOrderId: id }],
  })
    .populate("customerId", "shopName name phone district")
    .lean();

  if (!order) return notFoundResponse("Order not found");

  return successResponse({
    orderId: String(order._id),
    orderNumber: order.orderNumber,
    externalOrderId: order.externalOrderId,
    status: order.orderStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    paymentStatus: order.paymentStatus,
    grandTotal: order.grandTotal,
    paidAmount: order.paidAmount,
    receivableAmount: order.receivableAmount,
    items: order.items.map((i) => ({
      variantId: String(i.variantId),
      name: i.name,
      sku: i.sku,
      quantity: i.quantity,
      customerPrice: i.customerPriceSnapshot,
      subtotal: i.subtotal,
    })),
    orderDate: order.orderDate,
  });
}
