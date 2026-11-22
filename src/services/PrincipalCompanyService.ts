import mongoose from "mongoose";
import { PrincipalCompany, type IPrincipalCompany } from "@/models/PrincipalCompany";
import { AuditService } from "./AuditService";

export interface CreatePrincipalCompanyDto {
  name: string;
  code: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  status?: "active" | "inactive";
}

export interface UpdatePrincipalCompanyDto {
  name?: string;
  code?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  status?: "active" | "inactive";
}

export interface PrincipalCompanyQueryParams {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export class PrincipalCompanyService {
  /**
   * Lists principal companies for a business with pagination and search.
   */
  static async list(
    businessId: string | mongoose.Types.ObjectId,
    params: PrincipalCompanyQueryParams = {}
  ): Promise<{ items: IPrincipalCompany[]; total: number; page: number; limit: number; totalPages: number }> {
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

    if (params.search) {
      const term = params.search.trim();
      query.$or = [
        { name: { $regex: term, $options: "i" } },
        { code: { $regex: term, $options: "i" } },
        { contactPerson: { $regex: term, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      PrincipalCompany.find(query)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PrincipalCompany.countDocuments(query),
    ]);

    return {
      items: items as IPrincipalCompany[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Retrieves single principal company by ID within a business.
   */
  static async getById(
    businessId: string | mongoose.Types.ObjectId,
    companyId: string | mongoose.Types.ObjectId
  ): Promise<IPrincipalCompany | null> {
    const company = await PrincipalCompany.findOne({
      _id: companyId,
      businessId,
      isDeleted: false,
    }).lean();

    return company as IPrincipalCompany | null;
  }

  /**
   * Creates a new principal company under a business.
   * Enforces business-scoped uniqueness for company code.
   */
  static async create(
    businessId: string | mongoose.Types.ObjectId,
    data: CreatePrincipalCompanyDto,
    actor: { userId: string; email: string }
  ): Promise<IPrincipalCompany> {
    const cleanName = data.name?.trim();
    const cleanCode = data.code?.trim().toUpperCase();

    if (!cleanName) throw new Error("Principal company name is required");
    if (!cleanCode) throw new Error("Principal company code is required");

    // Check code uniqueness within business
    const existing = await PrincipalCompany.findOne({
      businessId,
      code: cleanCode,
      isDeleted: false,
    });

    if (existing) {
      throw new Error(`Principal company with code '${cleanCode}' already exists in this business`);
    }

    const company = await PrincipalCompany.create({
      businessId,
      name: cleanName,
      code: cleanCode,
      contactPerson: data.contactPerson?.trim() || undefined,
      phone: data.phone?.trim() || undefined,
      email: data.email?.trim().toLowerCase() || undefined,
      address: data.address?.trim() || undefined,
      status: data.status || "active",
      isDeleted: false,
    });

    await AuditService.log({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: "PRINCIPAL_COMPANY_CREATED",
      entityType: "principal_company",
      entityId: String(company._id),
      afterSnapshot: company.toObject() as unknown as Record<string, unknown>,
    });

    return company;
  }

  /**
   * Updates an existing principal company within a business.
   */
  static async update(
    businessId: string | mongoose.Types.ObjectId,
    companyId: string | mongoose.Types.ObjectId,
    data: UpdatePrincipalCompanyDto,
    actor: { userId: string; email: string }
  ): Promise<IPrincipalCompany> {
    const company = await PrincipalCompany.findOne({
      _id: companyId,
      businessId,
      isDeleted: false,
    });

    if (!company) {
      throw new Error("Principal company not found");
    }

    const beforeSnapshot = company.toObject();

    if (data.name !== undefined) {
      const cleanName = data.name.trim();
      if (!cleanName) throw new Error("Name cannot be empty");
      company.name = cleanName;
    }

    if (data.code !== undefined) {
      const cleanCode = data.code.trim().toUpperCase();
      if (!cleanCode) throw new Error("Code cannot be empty");

      if (cleanCode !== company.code) {
        const existing = await PrincipalCompany.findOne({
          businessId,
          code: cleanCode,
          _id: { $ne: company._id },
          isDeleted: false,
        });
        if (existing) {
          throw new Error(`Principal company with code '${cleanCode}' already exists in this business`);
        }
        company.code = cleanCode;
      }
    }

    if (data.contactPerson !== undefined) company.contactPerson = data.contactPerson.trim() || undefined;
    if (data.phone !== undefined) company.phone = data.phone.trim() || undefined;
    if (data.email !== undefined) company.email = data.email.trim().toLowerCase() || undefined;
    if (data.address !== undefined) company.address = data.address.trim() || undefined;
    if (data.status !== undefined) company.status = data.status;

    await company.save();

    await AuditService.log({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: "PRINCIPAL_COMPANY_UPDATED",
      entityType: "principal_company",
      entityId: String(company._id),
      beforeSnapshot: beforeSnapshot as unknown as Record<string, unknown>,
      afterSnapshot: company.toObject() as unknown as Record<string, unknown>,
    });

    return company;
  }

  /**
   * Soft deletes a principal company within a business.
   */
  static async delete(
    businessId: string | mongoose.Types.ObjectId,
    companyId: string | mongoose.Types.ObjectId,
    actor: { userId: string; email: string }
  ): Promise<{ success: boolean }> {
    const company = await PrincipalCompany.findOne({
      _id: companyId,
      businessId,
      isDeleted: false,
    });

    if (!company) {
      throw new Error("Principal company not found");
    }

    company.isDeleted = true;
    await company.save();

    await AuditService.log({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: "PRINCIPAL_COMPANY_DELETED",
      entityType: "principal_company",
      entityId: String(company._id),
      beforeSnapshot: company.toObject() as unknown as Record<string, unknown>,
    });

    return { success: true };
  }
}
