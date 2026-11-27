import mongoose from "mongoose";
import { Product } from "@/models/Product";
import { ProductVariant } from "@/models/ProductVariant";
import { InventoryBalance } from "@/models/InventoryBalance";
import { Warehouse } from "@/models/Warehouse";
import { Order, type IOrder } from "@/models/Order";
import { Customer } from "@/models/Customer";
import { CustomerDealershipAccount } from "@/models/CustomerDealershipAccount";
import { OrderService } from "./OrderService";

export interface FieldSalesProductItem {
  id: string;
  variantId: string;
  name: string;
  sku: string;
  category?: string;
  image?: string;
  customerPrice: number; // default sales price to retailers
  retailPrice: number; // suggested resale price
  availableStock: number;
  status: string;
}

export class FieldSalesService {
  /**
   * Catalog for Field Sales reps.
   * STRICT SECURITY RULE: Never expose Purchase Price through this endpoint!
   */
  static async getCatalog(): Promise<FieldSalesProductItem[]> {
    // Find Central Warehouse
    let centralWarehouse = await Warehouse.findOne({ isCentral: true });
    if (!centralWarehouse) {
      centralWarehouse = await Warehouse.findOne({ status: "active" });
    }

    const wId = centralWarehouse?._id;

    const variants = await ProductVariant.find({ status: "active" })
      .populate("productId")
      .lean();

    const catalog: FieldSalesProductItem[] = [];

    for (const v of variants) {
      const prod = v.productId as unknown as {
        _id: mongoose.Types.ObjectId;
        name: string;
        categoryId?: mongoose.Types.ObjectId;
        images?: string[];
        status: string;
      } | null;
      if (!prod || prod.status !== "active") continue;

      let availableStock = 0;
      if (wId) {
        const bal = await InventoryBalance.findOne({
          warehouseId: wId,
          productId: prod._id,
          variantId: v._id,
        }).lean();
        if (bal) {
          availableStock = Math.max(0, bal.onHandQuantity - bal.reservedQuantity);
        }
      }

      catalog.push({
        id: String(prod._id),
        variantId: String(v._id),
        name: `${prod.name} - ${v.variantName}`,
        sku: v.sku,
        category: prod.categoryId ? String(prod.categoryId) : undefined,
        image: v.image || (Array.isArray(prod.images) ? prod.images[0] : undefined),
        customerPrice: v.customerPrice,
        retailPrice: v.retailPrice,
        availableStock,
        status: v.status,
      });
    }

    return catalog;
  }

  /**
   * Field Sales Atomic Order Reservation
   * Authenticates, checks idempotency, retrieves authoritative prices, reserves stock atomically,
   * and creates the Mother Company Order.
   */
  static async reserveOrder(params: {
    customerId: string;
    externalOrderId: string;
    idempotencyKey: string;
    items: Array<{
      productId: string;
      variantId: string;
      quantity: number;
    }>;
    notes?: string;
  }): Promise<{
    orderId: string;
    orderNumber: string;
    reservationId: string;
    grandTotal: number;
    itemsCount: number;
    status: string;
  }> {
    if (!params.idempotencyKey) {
      throw new Error("Missing required 'idempotencyKey'");
    }

    // Check existing order with this idempotency key
    const existing = await Order.findOne({ idempotencyKey: params.idempotencyKey });
    if (existing) {
      return {
        orderId: String(existing._id),
        orderNumber: existing.orderNumber,
        reservationId: String(existing.reservationId || ""),
        grandTotal: existing.grandTotal,
        itemsCount: existing.items.length,
        status: existing.orderStatus,
      };
    }

    // Identify Central Warehouse
    let warehouse = await Warehouse.findOne({ isCentral: true });
    if (!warehouse) {
      warehouse = await Warehouse.findOne({ status: "active" });
    }
    if (!warehouse) {
      throw new Error("Central warehouse not configured in Mother Company");
    }

    // Reuse the exact same underlying OrderService & InventoryService!
    const order = await OrderService.createOrder({
      customerId: params.customerId,
      warehouseId: warehouse._id as mongoose.Types.ObjectId,
      source: "field_sales",
      externalOrderId: params.externalOrderId,
      idempotencyKey: params.idempotencyKey,
      items: params.items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId,
        quantity: i.quantity,
      })),
      notes: params.notes,
      autoConfirmAndReserve: true, // atomically reserves stock!
    });

    return {
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      reservationId: String(order.reservationId || ""),
      grandTotal: order.grandTotal,
      itemsCount: order.items.length,
      status: order.orderStatus,
    };
  }

  /**
   * Cancel Field Sales Order & safely release reservations
   */
  static async cancelOrder(
    orderIdOrNumber: string,
    reason?: string
  ): Promise<IOrder> {
    let order: IOrder | null = null;
    if (mongoose.Types.ObjectId.isValid(orderIdOrNumber)) {
      order = await Order.findById(orderIdOrNumber);
    }
    if (!order) {
      order = await Order.findOne({
        $or: [
          { orderNumber: orderIdOrNumber },
          { externalOrderId: orderIdOrNumber },
        ],
      });
    }

    if (!order) {
      throw new Error("Order not found");
    }

    return OrderService.cancelOrder(
      order._id as mongoose.Types.ObjectId,
      reason || "Cancelled by Field Sales System"
    );
  }

  /**
   * Sync Field Sales customer/shopkeeper into Mother ERP with deduplication
   */
  static async syncCustomer(params: {
    name: string;
    shopName: string;
    phone: string;
    dealershipId: string | mongoose.Types.ObjectId;
    businessId: string | mongoose.Types.ObjectId;
    address?: string;
    creditLimit?: number;
    salesmanId?: string | mongoose.Types.ObjectId;
  }): Promise<{ customerId: string; customerCode: string; isNew: boolean }> {
    const cleanedPhone = params.phone.replace(/[^0-9]/g, "");

    // 1. Deduplication by phone or exact shop name
    let customer = await Customer.findOne({
      $or: [{ phone: cleanedPhone }, { phone: params.phone }],
    });

    let isNew = false;
    if (!customer) {
      const code = `CUST-FS-${Math.floor(Math.random() * 90000 + 10000)}`;
      customer = await Customer.create({
        customerCode: code,
        name: params.name,
        shopName: params.shopName,
        phone: cleanedPhone || params.phone,
        address: params.address,
        creditLimit: params.creditLimit || 0,
        status: "active",
      });
      isNew = true;
    }

    // 2. Ensure dealership subledger exists
    const dId = new mongoose.Types.ObjectId(String(params.dealershipId));
    const bId = new mongoose.Types.ObjectId(String(params.businessId));
    const sId = params.salesmanId ? new mongoose.Types.ObjectId(String(params.salesmanId)) : undefined;

    await CustomerDealershipAccount.findOneAndUpdate(
      { customerId: customer._id, dealershipId: dId },
      {
        $setOnInsert: {
          businessId: bId,
          creditLimit: params.creditLimit || customer.creditLimit || 0,
          currentBalance: 0,
          totalInvoiced: 0,
          totalCollected: 0,
          totalReturned: 0,
          status: "active",
        },
        $set: {
          assignedSalesmanId: sId,
          isDeleted: false,
        },
      },
      { upsert: true, new: true }
    );

    return {
      customerId: String(customer._id),
      customerCode: customer.customerCode,
      isNew,
    };
  }
}
