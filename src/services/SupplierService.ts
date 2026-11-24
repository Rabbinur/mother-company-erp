import mongoose from "mongoose";
import { Vendor, type IVendor } from "@/models/Vendor";
import { GoodsReceiptNote } from "@/models/GoodsReceiptNote";
import { Purchase } from "@/models/Purchase";
import { generateReferenceCode } from "@/lib/utils";

export interface CreateSupplierInput {
  businessId: string | mongoose.Types.ObjectId;
  code?: string;
  name: string;
  companyName: string;
  phone: string;
  email?: string;
  address?: string;
  contactPerson?: string;
  taxVatNumber?: string;
  principalCompanyId?: string | mongoose.Types.ObjectId | null;
  paymentTerms?: "cash" | "net7" | "net15" | "net30" | "net45" | "net60" | "custom";
  customPaymentTermsDays?: number;
  openingBalance?: number;
  notes?: string;
}

export interface UpdateSupplierInput {
  name?: string;
  companyName?: string;
  phone?: string;
  email?: string;
  address?: string;
  contactPerson?: string;
  taxVatNumber?: string;
  principalCompanyId?: string | mongoose.Types.ObjectId | null;
  paymentTerms?: "cash" | "net7" | "net15" | "net30" | "net45" | "net60" | "custom";
  customPaymentTermsDays?: number;
  status?: "active" | "inactive";
  notes?: string;
}

export class SupplierService {
  /**
   * List suppliers for a business with pagination, search, and outstanding balance summary
   */
  static async listSuppliers(params: {
    businessId: string | mongoose.Types.ObjectId;
    search?: string;
    status?: string;
    principalCompanyId?: string;
    page?: number;
    limit?: number;
  }) {
    const bId = new mongoose.Types.ObjectId(String(params.businessId));
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      $or: [{ businessId: bId }, { businessId: { $exists: false } }],
    };

    if (params.status) filter.status = params.status;
    if (params.principalCompanyId) {
      filter.principalCompanyId = new mongoose.Types.ObjectId(params.principalCompanyId);
    }
    if (params.search) {
      const q = params.search.trim();
      filter.$and = [
        {
          $or: [
            { companyName: { $regex: q, $options: "i" } },
            { name: { $regex: q, $options: "i" } },
            { phone: { $regex: q, $options: "i" } },
            { code: { $regex: q, $options: "i" } },
          ],
        },
      ];
    }

    const [suppliers, total] = await Promise.all([
      Vendor.find(filter)
        .populate("principalCompanyId", "name code")
        .sort({ companyName: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Vendor.countDocuments(filter),
    ]);

    return {
      suppliers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Create a new supplier in the business, preventing duplicate code/phone
   */
  static async createSupplier(input: CreateSupplierInput): Promise<IVendor> {
    const bId = new mongoose.Types.ObjectId(String(input.businessId));

    // Duplicate check on phone or code within business
    const phoneClean = input.phone?.trim();
    if (phoneClean) {
      const existingPhone = await Vendor.findOne({
        businessId: bId,
        phone: phoneClean,
      });
      if (existingPhone) {
        throw new Error(`Supplier with phone number '${phoneClean}' already exists in this business`);
      }
    }

    let code = input.code?.trim().toUpperCase();
    if (code) {
      const existingCode = await Vendor.findOne({ businessId: bId, code });
      if (existingCode) {
        throw new Error(`Supplier code '${code}' already exists for this business`);
      }
    } else {
      code = generateReferenceCode("SUP", Math.floor(Math.random() * 9000 + 1000));
    }

    const supplier = await Vendor.create({
      businessId: bId,
      code,
      name: input.name.trim(),
      companyName: input.companyName?.trim() || input.name.trim(),
      phone: phoneClean,
      email: input.email?.trim().toLowerCase(),
      address: input.address?.trim(),
      contactPerson: input.contactPerson?.trim(),
      taxVatNumber: input.taxVatNumber?.trim(),
      principalCompanyId: input.principalCompanyId
        ? new mongoose.Types.ObjectId(String(input.principalCompanyId))
        : null,
      paymentTerms: input.paymentTerms || "net30",
      customPaymentTermsDays: input.customPaymentTermsDays || 30,
      openingBalance: Number(input.openingBalance || 0),
      currentPayable: Number(input.openingBalance || 0),
      status: "active",
      notes: input.notes?.trim(),
    });

    return supplier;
  }

  /**
   * Get single supplier details with linked purchase metrics
   */
  static async getSupplierDetails(
    supplierId: string | mongoose.Types.ObjectId,
    businessId?: string | mongoose.Types.ObjectId
  ) {
    const sId = new mongoose.Types.ObjectId(String(supplierId));
    const supplier = await Vendor.findById(sId)
      .populate("principalCompanyId", "name code contactPerson phone")
      .lean();

    if (!supplier) throw new Error("Supplier not found");

    // Aggregate purchase metrics
    const [grnCount, poCount] = await Promise.all([
      GoodsReceiptNote.countDocuments({ supplierId: sId, isCancelled: false }),
      Purchase.countDocuments({ vendorId: sId, status: { $ne: "cancelled" } }),
    ]);

    return {
      supplier,
      metrics: {
        totalPurchaseOrders: poCount,
        totalGoodsReceiptNotes: grnCount,
        currentPayable: supplier.currentPayable || 0,
        openingBalance: supplier.openingBalance || 0,
      },
    };
  }

  /**
   * Update supplier metadata
   */
  static async updateSupplier(
    supplierId: string | mongoose.Types.ObjectId,
    input: UpdateSupplierInput
  ): Promise<IVendor> {
    const supplier = await Vendor.findById(supplierId);
    if (!supplier) throw new Error("Supplier not found");

    if (input.name !== undefined) supplier.name = input.name.trim();
    if (input.companyName !== undefined) supplier.companyName = input.companyName.trim();
    if (input.phone !== undefined) supplier.phone = input.phone.trim();
    if (input.email !== undefined) supplier.email = input.email.trim().toLowerCase();
    if (input.address !== undefined) supplier.address = input.address.trim();
    if (input.contactPerson !== undefined) supplier.contactPerson = input.contactPerson.trim();
    if (input.taxVatNumber !== undefined) supplier.taxVatNumber = input.taxVatNumber.trim();
    if (input.principalCompanyId !== undefined) {
      supplier.principalCompanyId = input.principalCompanyId
        ? new mongoose.Types.ObjectId(String(input.principalCompanyId))
        : null;
    }
    if (input.paymentTerms !== undefined) supplier.paymentTerms = input.paymentTerms;
    if (input.customPaymentTermsDays !== undefined) {
      supplier.customPaymentTermsDays = input.customPaymentTermsDays;
    }
    if (input.status !== undefined) supplier.status = input.status;
    if (input.notes !== undefined) supplier.notes = input.notes.trim();

    await supplier.save();
    return supplier;
  }
}
