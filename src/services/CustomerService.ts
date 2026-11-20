import { Customer, ICustomer } from "@/models/Customer";
import { generateReferenceCode } from "@/lib/utils";
import { AuditService } from "./AuditService";
import {
  ICustomerService,
  CreateCustomerDTO,
  UpdateCustomerDTO,
  CustomerQueryFilters,
} from "@/types/services";
import { PaginatedResult } from "@/types/common";

/**
 * CustomerService - Single Responsibility: Retailer & Customer Ledger Management
 */
export class CustomerService implements ICustomerService {
  async list(filters: CustomerQueryFilters): Promise<PaginatedResult<ICustomer>> {
    const {
      page = 1,
      limit = 20,
      search = "",
      district = "",
      status = "",
      customerType = "",
      sortBy = "shopName",
      sortOrder = "asc",
    } = filters;

    const query: Record<string, unknown> = {};
    if (status) query.status = status;
    if (district) query.district = district;
    if (customerType) query.customerType = customerType;

    if (search) {
      query.$or = [
        { shopName: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { customerCode: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const sort: Record<string, 1 | -1> = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    const [items, total] = await Promise.all([
      Customer.find(query).sort(sort).skip(skip).limit(limit).lean() as unknown as ICustomer[],
      Customer.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async getById(id: string): Promise<ICustomer | null> {
    return (Customer.findById(id).lean() as unknown as ICustomer) || null;
  }

  async create(data: CreateCustomerDTO, userId?: string): Promise<ICustomer> {
    const cleanPhone = String(data.phone).trim();
    const existing = await Customer.findOne({ phone: cleanPhone });
    if (existing) {
      throw new Error("A customer with this phone number already exists.");
    }

    const seq = Math.floor(Math.random() * 9000 + 1000);
    const customerCode = generateReferenceCode("CUST", seq);
    const openingBal = Number(data.openingBalance || 0);

    const doc = await Customer.create({
      customerCode,
      name: data.name,
      shopName: data.shopName,
      phone: cleanPhone,
      email: data.email,
      address: data.address,
      district: data.district,
      area: data.area,
      customerType: (data.customerType as any) || "retailer",
      creditLimit: Number(data.creditLimit || 0),
      openingBalance: openingBal,
      currentReceivable: openingBal,
      notes: data.notes,
    });

    const customer = doc as unknown as ICustomer;

    if (userId) {
      await AuditService.log({
        actorId: userId,
        action: "CUSTOMER_CREATED",
        entityType: "Customer",
        entityId: String(customer._id),
        afterSnapshot: {
          customerCode,
          shopName: customer.shopName,
          phone: customer.phone,
        },
      });
    }

    return customer;
  }

  async update(id: string, data: UpdateCustomerDTO, userId?: string): Promise<ICustomer | null> {
    const customer = await Customer.findById(id);
    if (!customer) {
      throw new Error("Customer not found.");
    }

    if (data.phone && data.phone !== customer.phone) {
      const existing = await Customer.findOne({ phone: data.phone, _id: { $ne: id } });
      if (existing) {
        throw new Error("Another customer is already registered with this phone number.");
      }
    }

    Object.assign(customer, data);
    await customer.save();

    if (userId) {
      await AuditService.log({
        actorId: userId,
        action: "CUSTOMER_UPDATED",
        entityType: "Customer",
        entityId: id,
        afterSnapshot: {
          shopName: customer.shopName,
          creditLimit: customer.creditLimit,
        },
      });
    }

    return customer;
  }

  async adjustReceivable(customerId: string, amount: number): Promise<ICustomer> {
    const customer = await Customer.findByIdAndUpdate(
      customerId,
      { $inc: { currentReceivable: amount } },
      { new: true }
    );
    if (!customer) {
      throw new Error(`Customer with ID ${customerId} not found for receivable update.`);
    }
    return customer;
  }
}

export const customerService = new CustomerService();
