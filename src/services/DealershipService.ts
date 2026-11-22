import mongoose from "mongoose";
import { Dealership, type IDealership } from "@/models/Dealership";
import { PrincipalCompany } from "@/models/PrincipalCompany";
import { AuditService } from "./AuditService";

export interface CreateDealershipDto {
  name: string;
  code: string;
  principalCompanyId?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  status?: "active" | "inactive";
}

export interface UpdateDealershipDto {
  name?: string;
  code?: string;
  principalCompanyId?: string | null;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  status?: "active" | "inactive";
}

export interface DealershipQueryParams {
  search?: string;
  principalCompanyId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export class DealershipService {
  /**
   * Lists dealerships for a business with pagination and search.
   */
  static async list(
    businessId: string | mongoose.Types.ObjectId,
    params: DealershipQueryParams = {}
  ): Promise<{ items: IDealership[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {
      businessId,
      isDeleted: false,
    };

    if (params.status) {
      query.status = params.status;
    }

    if (params.principalCompanyId) {
      query.principalCompanyId = params.principalCompanyId;
    }

    if (params.search) {
      const term = params.search.trim();
      query.$or = [
        { name: { $regex: term, $options: "i" } },
        { code: { $regex: term, $options: "i" } },
        { contactPerson: { $regex: term, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      Dealership.find(query)
        .populate("principalCompanyId", "name code status")
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Dealership.countDocuments(query),
    ]);

    return {
      items: items as unknown as IDealership[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Retrieves single dealership by ID within a business.
   */
  static async getById(
    businessId: string | mongoose.Types.ObjectId,
    dealershipId: string | mongoose.Types.ObjectId
  ): Promise<IDealership | null> {
    const dealership = await Dealership.findOne({
      _id: dealershipId,
      businessId,
      isDeleted: false,
    })
      .populate("principalCompanyId", "name code status")
      .lean();

    return dealership as unknown as IDealership | null;
  }

  /**
   * Creates a new dealership under a business.
   * Enforces business-scoped uniqueness for dealership code and validates principal company ownership.
   */
  static async create(
    businessId: string | mongoose.Types.ObjectId,
    data: CreateDealershipDto,
    actor: { userId: string; email: string }
  ): Promise<IDealership> {
    const cleanName = data.name?.trim();
    const cleanCode = data.code?.trim().toUpperCase();

    if (!cleanName) throw new Error("Dealership name is required");
    if (!cleanCode) throw new Error("Dealership code is required");

    // Check code uniqueness within business
    const existing = await Dealership.findOne({
      businessId,
      code: cleanCode,
      isDeleted: false,
    });

    if (existing) {
      throw new Error(`Dealership with code '${cleanCode}' already exists in this business`);
    }

    // If principal company is specified, verify it belongs to this business
    let principalCompanyObjId: mongoose.Types.ObjectId | undefined;
    if (data.principalCompanyId) {
      const pc = await PrincipalCompany.findOne({
        _id: data.principalCompanyId,
        businessId,
        isDeleted: false,
      });
      if (!pc) {
        throw new Error("Specified Principal Company not found or does not belong to this business");
      }
      principalCompanyObjId = pc._id as mongoose.Types.ObjectId;
    }

    const dealership = await Dealership.create({
      businessId,
      principalCompanyId: principalCompanyObjId,
      name: cleanName,
      code: cleanCode,
      contactPerson: data.contactPerson?.trim() || undefined,
      contactPhone: data.contactPhone?.trim() || undefined,
      contactEmail: data.contactEmail?.trim().toLowerCase() || undefined,
      address: data.address?.trim() || undefined,
      status: data.status || "active",
      isDeleted: false,
    });

    await AuditService.log({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: "DEALERSHIP_CREATED",
      entityType: "dealership",
      entityId: String(dealership._id),
      afterSnapshot: dealership.toObject() as unknown as Record<string, unknown>,
    });

    return dealership;
  }

  /**
   * Updates an existing dealership within a business.
   */
  static async update(
    businessId: string | mongoose.Types.ObjectId,
    dealershipId: string | mongoose.Types.ObjectId,
    data: UpdateDealershipDto,
    actor: { userId: string; email: string }
  ): Promise<IDealership> {
    const dealership = await Dealership.findOne({
      _id: dealershipId,
      businessId,
      isDeleted: false,
    });

    if (!dealership) {
      throw new Error("Dealership not found");
    }

    const beforeSnapshot = dealership.toObject();

    if (data.name !== undefined) {
      const cleanName = data.name.trim();
      if (!cleanName) throw new Error("Name cannot be empty");
      dealership.name = cleanName;
    }

    if (data.code !== undefined) {
      const cleanCode = data.code.trim().toUpperCase();
      if (!cleanCode) throw new Error("Code cannot be empty");

      if (cleanCode !== dealership.code) {
        const existing = await Dealership.findOne({
          businessId,
          code: cleanCode,
          _id: { $ne: dealership._id },
          isDeleted: false,
        });
        if (existing) {
          throw new Error(`Dealership with code '${cleanCode}' already exists in this business`);
        }
        dealership.code = cleanCode;
      }
    }

    if (data.principalCompanyId !== undefined) {
      if (data.principalCompanyId === null || data.principalCompanyId === "") {
        dealership.principalCompanyId = undefined as any;
      } else {
        const pc = await PrincipalCompany.findOne({
          _id: data.principalCompanyId,
          businessId,
          isDeleted: false,
        });
        if (!pc) {
          throw new Error("Specified Principal Company not found or does not belong to this business");
        }
        dealership.principalCompanyId = pc._id as mongoose.Types.ObjectId;
      }
    }

    if (data.contactPerson !== undefined) dealership.contactPerson = data.contactPerson.trim() || undefined;
    if (data.contactPhone !== undefined) dealership.contactPhone = data.contactPhone.trim() || undefined;
    if (data.contactEmail !== undefined) dealership.contactEmail = data.contactEmail.trim().toLowerCase() || undefined;
    if (data.address !== undefined) dealership.address = data.address.trim() || undefined;
    if (data.status !== undefined) dealership.status = data.status;

    await dealership.save();

    await AuditService.log({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: "DEALERSHIP_UPDATED",
      entityType: "dealership",
      entityId: String(dealership._id),
      beforeSnapshot: beforeSnapshot as unknown as Record<string, unknown>,
      afterSnapshot: dealership.toObject() as unknown as Record<string, unknown>,
    });

    return dealership;
  }

  /**
   * Soft deletes a dealership within a business.
   */
  static async delete(
    businessId: string | mongoose.Types.ObjectId,
    dealershipId: string | mongoose.Types.ObjectId,
    actor: { userId: string; email: string }
  ): Promise<{ success: boolean }> {
    const dealership = await Dealership.findOne({
      _id: dealershipId,
      businessId,
      isDeleted: false,
    });

    if (!dealership) {
      throw new Error("Dealership not found");
    }

    dealership.isDeleted = true;
    dealership.deletedAt = new Date();
    dealership.deletedBy = new mongoose.Types.ObjectId(actor.userId);
    await dealership.save();

    await AuditService.log({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: "DEALERSHIP_DELETED",
      entityType: "dealership",
      entityId: String(dealership._id),
      beforeSnapshot: dealership.toObject() as unknown as Record<string, unknown>,
    });

    return { success: true };
  }
}
