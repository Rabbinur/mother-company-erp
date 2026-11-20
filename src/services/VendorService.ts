import { Vendor, IVendor } from "@/models/Vendor";
import { AuditService } from "./AuditService";
import {
  IVendorService,
  CreateVendorDTO,
  UpdateVendorDTO,
  VendorQueryFilters,
} from "@/types/services";
import { PaginatedResult } from "@/types/common";

/**
 * VendorService - Single Responsibility: Supplier Registry & Payables Management
 */
export class VendorService implements IVendorService {
  async list(filters: VendorQueryFilters): Promise<PaginatedResult<IVendor>> {
    const {
      page = 1,
      limit = 20,
      search = "",
      status = "",
      sortBy = "name",
      sortOrder = "asc",
    } = filters;

    const query: Record<string, unknown> = {};
    if (status) query.status = status;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { companyName: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const sort: Record<string, 1 | -1> = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    const [items, total] = await Promise.all([
      Vendor.find(query).sort(sort).skip(skip).limit(limit).lean() as unknown as IVendor[],
      Vendor.countDocuments(query),
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

  async getById(id: string): Promise<IVendor | null> {
    return (Vendor.findById(id).lean() as unknown as IVendor) || null;
  }

  async create(data: CreateVendorDTO, userId?: string): Promise<IVendor> {
    const existing = await Vendor.findOne({
      $or: [{ name: data.name }, { phone: data.phone }],
    });
    if (existing) {
      throw new Error("A vendor with this name or phone already exists.");
    }

    const openingBal = Number(data.openingBalance || 0);

    const doc = await Vendor.create({
      name: data.name,
      companyName: data.companyName,
      phone: data.phone,
      email: data.email,
      address: data.address,
      contactPerson: data.contactPerson,
      taxVatNumber: data.taxNumber,
      openingBalance: openingBal,
      currentPayable: openingBal,
      notes: data.notes,
    });

    const vendor = doc as unknown as IVendor;

    if (userId) {
      await AuditService.log({
        actorId: userId,
        action: "VENDOR_CREATED",
        entityType: "Vendor",
        entityId: String(vendor._id),
        afterSnapshot: {
          name: vendor.name,
          companyName: vendor.companyName,
          phone: vendor.phone,
        },
      });
    }

    return vendor;
  }

  async update(id: string, data: UpdateVendorDTO, userId?: string): Promise<IVendor | null> {
    const vendor = await Vendor.findById(id);
    if (!vendor) {
      throw new Error("Vendor not found.");
    }

    if (data.phone && data.phone !== vendor.phone) {
      const existing = await Vendor.findOne({ phone: data.phone, _id: { $ne: id } });
      if (existing) {
        throw new Error("Another vendor is registered with this phone number.");
      }
    }

    Object.assign(vendor, data);
    await vendor.save();

    if (userId) {
      await AuditService.log({
        actorId: userId,
        action: "VENDOR_UPDATED",
        entityType: "Vendor",
        entityId: id,
        afterSnapshot: {
          name: vendor.name,
          companyName: vendor.companyName,
          status: vendor.status,
        },
      });
    }

    return vendor;
  }

  async adjustPayable(vendorId: string, amount: number): Promise<IVendor> {
    const vendor = await Vendor.findByIdAndUpdate(
      vendorId,
      { $inc: { currentPayable: amount } },
      { new: true }
    );
    if (!vendor) {
      throw new Error(`Vendor with ID ${vendorId} not found for payable adjustment.`);
    }
    return vendor;
  }
}

export const vendorService = new VendorService();
