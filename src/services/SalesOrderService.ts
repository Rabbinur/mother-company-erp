import mongoose from "mongoose";
import { Order, type IOrder, type IOrderItem, type SalesOrderStatus } from "@/models/Order";
import { Customer } from "@/models/Customer";
import { CustomerDealershipAccount } from "@/models/CustomerDealershipAccount";
import { ProductVariant } from "@/models/ProductVariant";
import { Product } from "@/models/Product";
import { Warehouse } from "@/models/Warehouse";
import { Counter } from "@/models/Counter";
import { InventoryService } from "./InventoryService";
import { PricingService } from "./PricingService";
import { AuditLog } from "@/models/AuditLog";
import { generateReferenceCode } from "@/lib/utils";

export interface SalesOrderItemInput {
  productId: string | mongoose.Types.ObjectId;
  variantId: string | mongoose.Types.ObjectId;
  quantity: number;
  discount?: number;
}

export interface CreateSalesOrderInput {
  businessId: string | mongoose.Types.ObjectId;
  dealershipId: string | mongoose.Types.ObjectId;
  customerId: string | mongoose.Types.ObjectId;
  warehouseId: string | mongoose.Types.ObjectId;
  items: SalesOrderItemInput[];
  notes?: string;
  source?: "admin_dashboard" | "internal_staff" | "field_sales" | "api";
  salesmanId?: string | mongoose.Types.ObjectId;
  externalOrderId?: string;
  idempotencyKey?: string;
  actorId?: string | mongoose.Types.ObjectId;
}

export interface UpdateDraftSalesOrderInput {
  warehouseId?: string | mongoose.Types.ObjectId;
  items?: SalesOrderItemInput[];
  notes?: string;
  actorId?: string | mongoose.Types.ObjectId;
}

export interface ListSalesOrdersParams {
  businessId: string | mongoose.Types.ObjectId;
  dealershipId?: string | mongoose.Types.ObjectId;
  customerId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export class SalesOrderService {
  /**
   * Concurrency-safe, atomic sequence order number generation
   */
  static async generateOrderNumber(
    businessId: string | mongoose.Types.ObjectId,
    dealershipId: string | mongoose.Types.ObjectId,
    session?: mongoose.ClientSession
  ): Promise<string> {
    const ym = new Date().toISOString().slice(0, 7).replace("-", "");
    const key = `so_${String(businessId)}_${String(dealershipId)}_${ym}`;
    const seq = await Counter.getNextSequence(key, session);
    return generateReferenceCode("SO", seq);
  }

  /**
   * Create a Sales Order in DRAFT status.
   * INVARIANT: DRAFT orders never reserve inventory and never mutate Customer balances.
   */
  static async createSalesOrder(input: CreateSalesOrderInput): Promise<IOrder> {
    const bId = new mongoose.Types.ObjectId(String(input.businessId));
    const dId = new mongoose.Types.ObjectId(String(input.dealershipId));
    const cId = new mongoose.Types.ObjectId(String(input.customerId));
    const wId = new mongoose.Types.ObjectId(String(input.warehouseId));
    const actId = input.actorId ? new mongoose.Types.ObjectId(String(input.actorId)) : undefined;

    // Idempotency check
    const cleanIdemp = input.idempotencyKey?.trim();
    if (cleanIdemp) {
      const existing = await Order.findOne({ idempotencyKey: cleanIdemp });
      if (existing) {
        return existing;
      }
    }

    // Validate Customer
    const customer = await Customer.findById(cId).lean();
    if (!customer) {
      throw new Error("Customer not found");
    }
    if (customer.status === "blocked") {
      throw new Error("Customer is blocked from placing orders");
    }

    // Validate Dealership-Specific Customer Account
    const account = await CustomerDealershipAccount.findOne({
      dealershipId: dId,
      customerId: cId,
      isDeleted: false,
    }).lean();

    if (!account) {
      throw new Error("Customer does not have an active account with this dealership");
    }
    if (account.status === "suspended" || account.status === "blocked") {
      throw new Error(`Customer dealership account is ${account.status}`);
    }

    // Validate Warehouse
    const warehouse = await Warehouse.findById(wId).lean();
    if (!warehouse) {
      throw new Error("Warehouse not found");
    }

    if (!input.items || input.items.length === 0) {
      throw new Error("Sales Order must contain at least one line item");
    }

    let subtotal = 0;
    let discountTotal = 0;
    const orderItems: IOrderItem[] = [];

    // Server-side authoritative price resolution
    for (const it of input.items) {
      const pId = new mongoose.Types.ObjectId(String(it.productId));
      const vId = new mongoose.Types.ObjectId(String(it.variantId));
      const qty = Math.max(1, Number(it.quantity || 1));
      const disc = Math.max(0, Number(it.discount || 0));

      const priceInfo = await PricingService.resolveActivePrice({
        businessId: bId,
        dealershipId: dId,
        productId: pId,
        variantId: vId,
      });

      const variant = await ProductVariant.findById(vId).lean();
      const variantName = variant?.variantName || "Standard";
      const sku = variant?.sku || "SKU-N/A";

      const lineSubtotal = qty * priceInfo.customerPrice - disc;
      subtotal += qty * priceInfo.customerPrice;
      discountTotal += disc;

      orderItems.push({
        productId: pId,
        variantId: vId,
        name: variantName,
        sku,
        quantity: qty,
        customerPriceSnapshot: priceInfo.customerPrice,
        retailPriceSnapshot: priceInfo.retailPrice,
        unitPrice: priceInfo.customerPrice,
        discount: disc,
        subtotal: lineSubtotal,
        priceEffectiveDate: new Date(),
        priceSource: priceInfo.priceSource,
      });
    }

    const grandTotal = Math.max(0, subtotal - discountTotal);
    const orderNumber = await this.generateOrderNumber(bId, dId);

    const order = await Order.create({
      orderNumber,
      externalOrderId: input.externalOrderId,
      idempotencyKey: cleanIdemp,
      businessId: bId,
      dealershipId: dId,
      customerDealershipAccountId: account._id,
      source: input.source || "admin_dashboard",
      customerId: cId,
      warehouseId: wId,
      items: orderItems,
      subtotal,
      discountTotal,
      taxTotal: 0,
      grandTotal,
      paidAmount: 0,
      receivableAmount: grandTotal,
      orderStatus: "DRAFT",
      fulfillmentStatus: "unfulfilled",
      paymentStatus: "unpaid",
      orderDate: new Date(),
      salesmanId: input.salesmanId ? new mongoose.Types.ObjectId(String(input.salesmanId)) : undefined,
      notes: input.notes?.trim(),
      createdBy: actId,
    });

    if (actId) {
      await AuditLog.create({
        actorId: actId,
        action: "SALES_ORDER_CREATED",
        entityType: "order",
        entityId: String(order._id),
        afterSnapshot: {
          orderNumber,
          status: "DRAFT",
          grandTotal,
          dealershipId: String(dId),
        },
      });
    }

    return order;
  }

  /**
   * Edit a DRAFT order: update items, warehouse, or notes
   */
  static async updateDraftOrder(
    orderId: string | mongoose.Types.ObjectId,
    input: UpdateDraftSalesOrderInput
  ): Promise<IOrder> {
    const oId = new mongoose.Types.ObjectId(String(orderId));
    const order = await Order.findById(oId);
    if (!order) throw new Error("Order not found");

    if (order.orderStatus !== "DRAFT" && order.orderStatus !== "draft") {
      throw new Error(`Cannot modify order in status '${order.orderStatus}'. Only DRAFT orders can be edited.`);
    }

    if (input.warehouseId) {
      const wId = new mongoose.Types.ObjectId(String(input.warehouseId));
      const w = await Warehouse.findById(wId).lean();
      if (!w) throw new Error("Warehouse not found");
      order.warehouseId = wId;
    }

    if (input.notes !== undefined) {
      order.notes = input.notes.trim();
    }

    if (input.items && input.items.length > 0) {
      let subtotal = 0;
      let discountTotal = 0;
      const orderItems: IOrderItem[] = [];

      for (const it of input.items) {
        const pId = new mongoose.Types.ObjectId(String(it.productId));
        const vId = new mongoose.Types.ObjectId(String(it.variantId));
        const qty = Math.max(1, Number(it.quantity || 1));
        const disc = Math.max(0, Number(it.discount || 0));

        const priceInfo = await PricingService.resolveActivePrice({
          businessId: order.businessId,
          dealershipId: order.dealershipId,
          productId: pId,
          variantId: vId,
        });

        const variant = await ProductVariant.findById(vId).lean();
        const variantName = variant?.variantName || "Standard";
        const sku = variant?.sku || "SKU-N/A";

        const lineSubtotal = qty * priceInfo.customerPrice - disc;
        subtotal += qty * priceInfo.customerPrice;
        discountTotal += disc;

        orderItems.push({
          productId: pId,
          variantId: vId,
          name: variantName,
          sku,
          quantity: qty,
          customerPriceSnapshot: priceInfo.customerPrice,
          retailPriceSnapshot: priceInfo.retailPrice,
          unitPrice: priceInfo.customerPrice,
          discount: disc,
          subtotal: lineSubtotal,
          priceEffectiveDate: new Date(),
          priceSource: priceInfo.priceSource,
        });
      }

      order.items = orderItems;
      order.subtotal = subtotal;
      order.discountTotal = discountTotal;
      order.grandTotal = Math.max(0, subtotal - discountTotal);
      order.receivableAmount = order.grandTotal;
    }

    await order.save();
    return order;
  }

  /**
   * Confirm Sales Order:
   * 1. Idempotency guard (if already confirmed, returns without re-reserving).
   * 2. Dealership customer credit check.
   * 3. Server-side price lock.
   * 4. Atomic dealership-scoped inventory reservation.
   */
  static async confirmSalesOrder(params: {
    orderId: string | mongoose.Types.ObjectId;
    actorId?: string | mongoose.Types.ObjectId;
    session?: mongoose.ClientSession;
  }): Promise<IOrder> {
    const oId = new mongoose.Types.ObjectId(String(params.orderId));
    const actId = params.actorId ? new mongoose.Types.ObjectId(String(params.actorId)) : undefined;

    const order = await Order.findById(oId).session(params.session || null);
    if (!order) throw new Error("Sales Order not found");

    // Idempotent: if already CONFIRMED, return without repeating reservations
    if (order.orderStatus === "CONFIRMED" || order.orderStatus === "confirmed") {
      return order;
    }

    if (order.orderStatus !== "DRAFT" && order.orderStatus !== "draft") {
      throw new Error(`Cannot confirm order in status '${order.orderStatus}'`);
    }

    // 1. Validate Customer Dealership Account & Credit Limit
    const account = await CustomerDealershipAccount.findOne({
      dealershipId: order.dealershipId,
      customerId: order.customerId,
      isDeleted: false,
    }).session(params.session || null);

    if (!account) {
      throw new Error("Customer dealership account not found");
    }
    if (account.status === "suspended" || account.status === "blocked") {
      throw new Error(`Cannot confirm order: customer dealership account is ${account.status}`);
    }

    if (account.creditLimit > 0) {
      const projectedBalance = (account.currentBalance || 0) + order.grandTotal;
      if (projectedBalance > account.creditLimit) {
        throw new Error(
          `Order exceeds customer credit limit for this dealership (Limit: ৳${account.creditLimit.toFixed(2)}, Current: ৳${(account.currentBalance || 0).toFixed(2)}, Order: ৳${order.grandTotal.toFixed(2)})`
        );
      }
    }

    // 2. Re-verify prices and ensure immutable pricing snapshot
    for (const item of order.items) {
      if (!item.customerPriceSnapshot || item.customerPriceSnapshot <= 0) {
        const pInfo = await PricingService.resolveActivePrice({
          businessId: order.businessId,
          dealershipId: order.dealershipId,
          productId: item.productId,
          variantId: item.variantId,
        });
        item.customerPriceSnapshot = pInfo.customerPrice;
        item.retailPriceSnapshot = pInfo.retailPrice;
        item.unitPrice = pInfo.customerPrice;
        item.priceSource = pInfo.priceSource;
        item.priceEffectiveDate = new Date();
      }
    }

    // 3. Atomically reserve inventory scoped strictly to dealership & warehouse
    const reservation = await InventoryService.reserveStock({
      businessId: order.businessId,
      dealershipId: order.dealershipId,
      warehouseId: order.warehouseId,
      items: order.items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId,
        quantity: i.quantity,
      })),
      source: order.source || "admin_dashboard",
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      actorId: actId,
      session: params.session,
    });

    order.reservationId = reservation._id as mongoose.Types.ObjectId;
    order.orderStatus = "CONFIRMED";
    order.confirmedDate = new Date();
    order.confirmedBy = actId;
    await order.save({ session: params.session });

    if (actId) {
      await AuditLog.create({
        actorId: actId,
        action: "SALES_ORDER_CONFIRMED",
        entityType: "order",
        entityId: String(order._id),
        afterSnapshot: {
          orderNumber: order.orderNumber,
          reservationNumber: reservation.reservationNumber,
          grandTotal: order.grandTotal,
        },
      });
    }

    return order;
  }

  /**
   * Cancel Sales Order:
   * 1. Idempotency guard.
   * 2. Releases reservation if order was CONFIRMED.
   */
  static async cancelSalesOrder(params: {
    orderId: string | mongoose.Types.ObjectId;
    reason?: string;
    actorId?: string | mongoose.Types.ObjectId;
    session?: mongoose.ClientSession;
  }): Promise<IOrder> {
    const oId = new mongoose.Types.ObjectId(String(params.orderId));
    const actId = params.actorId ? new mongoose.Types.ObjectId(String(params.actorId)) : undefined;

    const order = await Order.findById(oId).session(params.session || null);
    if (!order) throw new Error("Sales Order not found");

    // Idempotent: already cancelled
    if (order.orderStatus === "CANCELLED" || order.orderStatus === "cancelled") {
      return order;
    }

    if (
      order.orderStatus === "FULFILLED" ||
      order.orderStatus === "fulfilled" ||
      order.orderStatus === "delivered"
    ) {
      throw new Error(`Cannot cancel an order in status '${order.orderStatus}'`);
    }

    // Release reservation if order was confirmed
    if (order.reservationId) {
      await InventoryService.releaseReservation(
        order.reservationId,
        params.reason || "Order cancelled",
        actId,
        params.session
      );
    }

    order.orderStatus = "CANCELLED";
    order.cancelledDate = new Date();
    order.cancelledBy = actId;
    order.cancellationReason = params.reason?.trim() || "Cancelled by user";
    await order.save({ session: params.session });

    if (actId) {
      await AuditLog.create({
        actorId: actId,
        action: "SALES_ORDER_CANCELLED",
        entityType: "order",
        entityId: String(order._id),
        afterSnapshot: {
          orderNumber: order.orderNumber,
          reason: order.cancellationReason,
        },
      });
    }

    return order;
  }

  /**
   * Fast lean order query with role-based purchase price protection
   */
  static async getSalesOrderDetails(
    orderId: string | mongoose.Types.ObjectId,
    userContext?: { role?: string; permissions?: string[]; dealershipId?: string | mongoose.Types.ObjectId }
  ): Promise<IOrder | null> {
    const oId = new mongoose.Types.ObjectId(String(orderId));
    const order = await Order.findById(oId)
      .populate("customerId", "name shopName phone address")
      .populate("warehouseId", "name code")
      .populate("dealershipId", "name code")
      .populate("customerDealershipAccountId", "creditLimit currentBalance status")
      .populate("reservationId", "reservationNumber status")
      .lean();

    if (!order) return null;

    // Cross-dealership security check
    if (userContext?.dealershipId && order.dealershipId) {
      const userDId = String(userContext.dealershipId);
      const orderDId = String((order.dealershipId as any)._id || order.dealershipId);
      if (userDId !== orderDId && userContext.role !== "owner" && userContext.role !== "admin") {
        throw new Error("Cross-dealership order access denied");
      }
    }

    return order as any;
  }

  /**
   * Super fast paginated sales orders query with index utilization
   */
  static async listSalesOrders(params: ListSalesOrdersParams) {
    const bId = new mongoose.Types.ObjectId(String(params.businessId));
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, any> = { businessId: bId };

    if (params.dealershipId) {
      query.dealershipId = new mongoose.Types.ObjectId(String(params.dealershipId));
    }
    if (params.customerId) {
      query.customerId = new mongoose.Types.ObjectId(String(params.customerId));
    }
    if (params.status && params.status !== "ALL") {
      query.orderStatus = { $in: [params.status.toUpperCase(), params.status.toLowerCase()] };
    }
    if (params.startDate || params.endDate) {
      query.orderDate = {};
      if (params.startDate) query.orderDate.$gte = new Date(params.startDate);
      if (params.endDate) query.orderDate.$lte = new Date(params.endDate);
    }
    if (params.search?.trim()) {
      query.orderNumber = { $regex: params.search.trim(), $options: "i" };
    }

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate("customerId", "name shopName phone")
        .populate("warehouseId", "name code")
        .populate("dealershipId", "name code")
        .sort({ orderDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(query),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Fast aggregated KPIs for the Sales Dashboard
   */
  static async getSalesDashboardKpis(
    businessIdOrParams: string | mongoose.Types.ObjectId | { businessId: string | mongoose.Types.ObjectId; dealershipId?: string | mongoose.Types.ObjectId },
    dealershipIdArg?: string | mongoose.Types.ObjectId
  ) {
    let businessId: string | mongoose.Types.ObjectId;
    let dealershipId: string | mongoose.Types.ObjectId | undefined = dealershipIdArg;

    if (
      typeof businessIdOrParams === "object" &&
      businessIdOrParams !== null &&
      !("toHexString" in (businessIdOrParams as any)) &&
      !(businessIdOrParams instanceof mongoose.Types.ObjectId)
    ) {
      businessId = (businessIdOrParams as any).businessId;
      dealershipId = (businessIdOrParams as any).dealershipId;
    } else {
      businessId = businessIdOrParams as string | mongoose.Types.ObjectId;
    }

    const bId = new mongoose.Types.ObjectId(String(businessId));
    const match: Record<string, any> = { businessId: bId };
    if (dealershipId) {
      match.dealershipId = new mongoose.Types.ObjectId(String(dealershipId));
    }

    const stats = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          draftOrders: {
            $sum: { $cond: [{ $in: ["$orderStatus", ["draft", "DRAFT"]] }, 1, 0] },
          },
          confirmedOrders: {
            $sum: { $cond: [{ $in: ["$orderStatus", ["confirmed", "CONFIRMED"]] }, 1, 0] },
          },
          fulfilledOrders: {
            $sum: { $cond: [{ $in: ["$orderStatus", ["fulfilled", "FULFILLED", "delivered"]] }, 1, 0] },
          },
          totalSalesValue: {
            $sum: {
              $cond: [
                { $nin: ["$orderStatus", ["cancelled", "CANCELLED"]] },
                "$grandTotal",
                0,
              ],
            },
          },
        },
      },
    ]);

    const s = stats[0] || {
      totalOrders: 0,
      draftOrders: 0,
      confirmedOrders: 0,
      fulfilledOrders: 0,
      totalSalesValue: 0,
    };

    return {
      totalOrders: s.totalOrders,
      draftOrders: s.draftOrders,
      confirmedOrders: s.confirmedOrders,
      fulfilledOrders: s.fulfilledOrders,
      totalSalesValue: s.totalSalesValue,
      fulfillmentRate:
        s.totalOrders > 0
          ? Math.round((s.fulfilledOrders / (s.totalOrders - s.draftOrders || 1)) * 100)
          : 100,
    };
  }
}
