import mongoose from "mongoose";
import { Order, type IOrder } from "@/models/Order";
import { Dispatch } from "@/models/Dispatch";
import { User } from "@/models/User";
import { Notification } from "@/models/Notification";

export interface AssignDeliverymanInput {
  orderId: string;
  deliverymanId: string;
  deliverymanName?: string;
  deliverymanPhone?: string;
  actorId?: string;
}

export interface UpdateDeliveryStatusInput {
  orderId: string;
  status: "pending" | "out_for_delivery" | "delivered" | "failed";
  notes?: string;
  failureReason?: string;
  actorId?: string;
}

export class FieldSalesDeliveryService {
  /**
   * Assign deliveryman to an order from Mother ERP management
   */
  static async assignDeliveryman(input: AssignDeliverymanInput): Promise<{
    orderId: string;
    orderNumber: string;
    assignedDeliverymanId: string;
    deliverymanName: string;
    deliveryStatus: string;
    success: boolean;
  }> {
    const order = await Order.findById(input.orderId);
    if (!order) {
      throw new Error(`Order not found: ${input.orderId}`);
    }

    let dManName = input.deliverymanName || "";
    let dManPhone = input.deliverymanPhone || "";

    if (!dManName && mongoose.Types.ObjectId.isValid(input.deliverymanId)) {
      const user = await User.findById(input.deliverymanId).select("name phone").lean();
      if (user) {
        dManName = user.name;
        dManPhone = user.phone || "";
      }
    }

    const dManObjectId = new mongoose.Types.ObjectId(String(input.deliverymanId));
    order.assignedDeliverymanId = dManObjectId;
    if (order.deliveryStatus !== "delivered") {
      order.deliveryStatus = "out_for_delivery";
    }
    if (order.orderStatus === "confirmed" || order.orderStatus === "processing") {
      order.orderStatus = "processing";
    }
    await order.save();

    // If an associated dispatch exists, update its deliveryman & stop details
    await Dispatch.updateMany(
      { "orders.orderId": order._id },
      {
        $set: {
          deliverymanId: dManObjectId,
          deliverymanName: dManName || "Assigned Deliveryman",
          ...(dManPhone ? { deliverymanPhone: dManPhone } : {}),
        },
      }
    ).catch(() => {});

    // Notify deliveryman
    await Notification.create({
      title: `New Delivery Assignment: Order #${order.orderNumber}`,
      message: `You have been assigned to deliver order #${order.orderNumber}.`,
      type: "system",
      targetRole: "deliveryman",
      link: `/delivery`,
    }).catch(() => {});

    return {
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      assignedDeliverymanId: String(dManObjectId),
      deliverymanName: dManName,
      deliveryStatus: order.deliveryStatus || "out_for_delivery",
      success: true,
    };
  }

  /**
   * Synchronize delivery outcome status (pending, out_for_delivery, delivered, failed)
   */
  static async updateDeliveryStatus(input: UpdateDeliveryStatusInput): Promise<{
    orderId: string;
    orderNumber: string;
    deliveryStatus: string;
    success: boolean;
  }> {
    const order = await Order.findById(input.orderId);
    if (!order) {
      throw new Error(`Order not found: ${input.orderId}`);
    }

    order.deliveryStatus = input.status;

    if (input.status === "delivered") {
      order.orderStatus = "delivered";
      order.fulfillmentStatus = "fulfilled";
      order.fulfilledDate = new Date();
    } else if (input.status === "failed") {
      order.deliveryFailureReason = input.failureReason || input.notes || "Delivery attempt failed";
    }

    await order.save();

    // Synchronize stop outcome inside Dispatch
    const stopOutcome =
      input.status === "delivered"
        ? "delivered"
        : input.status === "failed"
        ? "failed"
        : "pending";

    await Dispatch.updateOne(
      { "orders.orderId": order._id },
      {
        $set: {
          "orders.$.status": stopOutcome,
          ...(input.status === "delivered" ? { "orders.$.deliveredAt": new Date() } : {}),
          ...(input.failureReason ? { "orders.$.failureReason": input.failureReason } : {}),
          ...(input.notes ? { "orders.$.notes": input.notes } : {}),
        },
      }
    ).catch(() => {});

    return {
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      deliveryStatus: order.deliveryStatus,
      success: true,
    };
  }

  /**
   * Paginated Field Sales order list with deliveryman & collection visibility
   */
  static async listFieldSalesOrders(params: {
    dealershipId?: string;
    deliverymanId?: string;
    status?: string;
    deliveryStatus?: string;
    limit?: number;
    page?: number;
  }): Promise<{
    orders: Array<{
      orderId: string;
      orderNumber: string;
      externalOrderId?: string;
      customerId: string;
      customerName?: string;
      shopName?: string;
      orderTotal: number;
      grandTotal: number;
      orderStatus: string;
      deliveryStatus: string;
      assignedDeliverymanId?: string;
      orderDate: Date;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const filter: Record<string, any> = {};

    if (params.dealershipId && mongoose.Types.ObjectId.isValid(params.dealershipId)) {
      filter.dealershipId = new mongoose.Types.ObjectId(params.dealershipId);
    }
    if (params.deliverymanId && mongoose.Types.ObjectId.isValid(params.deliverymanId)) {
      filter.assignedDeliverymanId = new mongoose.Types.ObjectId(params.deliverymanId);
    }
    if (params.status) {
      filter.orderStatus = params.status;
    }
    if (params.deliveryStatus) {
      filter.deliveryStatus = params.deliveryStatus;
    }

    const page = Math.max(1, params.page || 1);
    const limit = Math.min(50, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate("customerId", "name shopName phone")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
    ]);

    // STRICT SECURITY: Never expose customer outstanding balance, account receivables, or payment records to salesmen
    return {
      orders: orders.map((o) => {
        const cust = o.customerId as any;
        return {
          orderId: String(o._id),
          orderNumber: o.orderNumber,
          externalOrderId: o.externalOrderId,
          customerId: String(cust?._id || o.customerId),
          customerName: cust?.name,
          shopName: cust?.shopName,
          orderTotal: o.grandTotal,
          grandTotal: o.grandTotal,
          orderStatus: o.orderStatus,
          deliveryStatus: o.deliveryStatus || "pending",
          assignedDeliverymanId: o.assignedDeliverymanId ? String(o.assignedDeliverymanId) : undefined,
          orderDate: o.orderDate,
        };
      }),
      total,
      page,
      limit,
    };
  }
}
