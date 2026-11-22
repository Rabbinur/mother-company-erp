import mongoose from "mongoose";
import { Warehouse, type IWarehouse } from "@/models/Warehouse";
import { Dealership } from "@/models/Dealership";
import { AuditService } from "./AuditService";

export interface CreateWarehouseDto {
  name: string;
  code: string;
  address?: string;
  isCentral?: boolean;
  contactPerson?: string;
  phone?: string;
  email?: string;
  dealershipIds?: string[];
  status?: "active" | "inactive";
}

export interface UpdateWarehouseDto {
  name?: string;
  code?: string;
  address?: string;
  isCentral?: boolean;
  contactPerson?: string;
  phone?: string;
  email?: string;
  dealershipIds?: string[];
  status?: "active" | "inactive";
}

export interface WarehouseQueryParams {
  search?: string;
  dealershipId?: string;
  isCentral?: boolean;
  status?: string;
  page?: number;
  limit?: number;
}

export class WarehouseService {
  /**
   * Lists warehouses for a business with pagination and filters.
   * A warehouse can serve multiple dealerships.
   */
  static async list(
    businessId: string | mongoose.Types.ObjectId,
    params: WarehouseQueryParams = {}
  ): Promise<{ items: IWarehouse[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {
      $or: [{ businessId }, { businessId: { $exists: false } }],
      isDeleted: { $ne: true },
    };

    if (params.status) {
      query.status = params.status;
    }

    if (params.isCentral !== undefined) {
      query.isCentral = params.isCentral;
    }

    if (params.dealershipId) {
      // Warehouse either explicitly serves this dealership or is a central warehouse
      query.$or = [
        { dealershipIds: new mongoose.Types.ObjectId(params.dealershipId) },
        { isCentral: true },
      ];
    }

    if (params.search) {
      const term = params.search.trim();
      query.$and = [
        {
          $or: [
            { name: { $regex: term, $options: "i" } },
            { code: { $regex: term, $options: "i" } },
            { contactPerson: { $regex: term, $options: "i" } },
          ],
        },
      ];
    }

    const [items, total] = await Promise.all([
      Warehouse.find(query)
        .populate("dealershipIds", "name code")
        .sort({ isCentral: -1, name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Warehouse.countDocuments(query),
    ]);

    return {
      items: items as unknown as IWarehouse[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Retrieves single warehouse by ID.
   */
  static async getById(
    businessId: string | mongoose.Types.ObjectId,
    warehouseId: string | mongoose.Types.ObjectId
  ): Promise<IWarehouse | null> {
    const warehouse = await Warehouse.findOne({
      _id: warehouseId,
      $or: [{ businessId }, { businessId: { $exists: false } }],
      isDeleted: { $ne: true },
    })
      .populate("dealershipIds", "name code")
      .lean();

    return warehouse as unknown as IWarehouse | null;
  }

  /**
   * Creates a new warehouse under a business.
   * Enforces business-scoped uniqueness for warehouse code and validates dealership references.
   */
  static async create(
    businessId: string | mongoose.Types.ObjectId,
    data: CreateWarehouseDto,
    actor: { userId: string; email: string }
  ): Promise<IWarehouse> {
    const cleanName = data.name?.trim();
    const cleanCode = data.code?.trim().toUpperCase();

    if (!cleanName) throw new Error("Warehouse name is required");
    if (!cleanCode) throw new Error("Warehouse code is required");

    // Check code uniqueness within business
    const existing = await Warehouse.findOne({
      $or: [{ businessId }, { businessId: { $exists: false } }],
      code: cleanCode,
      isDeleted: { $ne: true },
    });

    if (existing) {
      throw new Error(`Warehouse with code '${cleanCode}' already exists in this business`);
    }

    // Validate dealership IDs if provided
    let dealershipObjIds: mongoose.Types.ObjectId[] = [];
    if (data.dealershipIds && data.dealershipIds.length > 0) {
      const validDealers = await Dealership.find({
        _id: { $in: data.dealershipIds },
        businessId,
        isDeleted: false,
      }).select("_id");

      if (validDealers.length !== data.dealershipIds.length) {
        throw new Error("One or more specified dealerships do not belong to this business");
      }
      dealershipObjIds = validDealers.map((d) => d._id as mongoose.Types.ObjectId);
    }

    const warehouse = await Warehouse.create({
      businessId,
      dealershipIds: dealershipObjIds,
      name: cleanName,
      code: cleanCode,
      address: data.address?.trim() || undefined,
      isCentral: !!data.isCentral,
      status: data.status || "active",
      contactPerson: data.contactPerson?.trim() || undefined,
      phone: data.phone?.trim() || undefined,
      email: data.email?.trim().toLowerCase() || undefined,
      isDeleted: false,
    });

    await AuditService.log({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: "WAREHOUSE_CREATED",
      entityType: "warehouse",
      entityId: String(warehouse._id),
      afterSnapshot: warehouse.toObject() as unknown as Record<string, unknown>,
    });

    return warehouse;
  }

  /**
   * Updates an existing warehouse.
   */
  static async update(
    businessId: string | mongoose.Types.ObjectId,
    warehouseId: string | mongoose.Types.ObjectId,
    data: UpdateWarehouseDto,
    actor: { userId: string; email: string }
  ): Promise<IWarehouse> {
    const warehouse = await Warehouse.findOne({
      _id: warehouseId,
      $or: [{ businessId }, { businessId: { $exists: false } }],
      isDeleted: { $ne: true },
    });

    if (!warehouse) {
      throw new Error("Warehouse not found");
    }

    const beforeSnapshot = warehouse.toObject();

    if (data.name !== undefined) {
      const cleanName = data.name.trim();
      if (!cleanName) throw new Error("Warehouse name cannot be empty");
      warehouse.name = cleanName;
    }

    if (data.code !== undefined) {
      const cleanCode = data.code.trim().toUpperCase();
      if (!cleanCode) throw new Error("Warehouse code cannot be empty");

      if (cleanCode !== warehouse.code) {
        const existing = await Warehouse.findOne({
          $or: [{ businessId }, { businessId: { $exists: false } }],
          code: cleanCode,
          _id: { $ne: warehouse._id },
          isDeleted: { $ne: true },
        });
        if (existing) {
          throw new Error(`Warehouse with code '${cleanCode}' already exists in this business`);
        }
        warehouse.code = cleanCode;
      }
    }

    if (data.dealershipIds !== undefined) {
      if (data.dealershipIds.length > 0) {
        const validDealers = await Dealership.find({
          _id: { $in: data.dealershipIds },
          businessId,
          isDeleted: false,
        }).select("_id");

        if (validDealers.length !== data.dealershipIds.length) {
          throw new Error("One or more specified dealerships do not belong to this business");
        }
        warehouse.dealershipIds = validDealers.map((d) => d._id as mongoose.Types.ObjectId);
      } else {
        warehouse.dealershipIds = [];
      }
    }

    if (data.address !== undefined) warehouse.address = data.address.trim() || undefined;
    if (data.isCentral !== undefined) warehouse.isCentral = data.isCentral;
    if (data.status !== undefined) warehouse.status = data.status;
    if (data.contactPerson !== undefined) warehouse.contactPerson = data.contactPerson.trim() || undefined;
    if (data.phone !== undefined) warehouse.phone = data.phone.trim() || undefined;
    if (data.email !== undefined) warehouse.email = data.email.trim().toLowerCase() || undefined;

    await warehouse.save();

    await AuditService.log({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: "WAREHOUSE_UPDATED",
      entityType: "warehouse",
      entityId: String(warehouse._id),
      beforeSnapshot: beforeSnapshot as unknown as Record<string, unknown>,
      afterSnapshot: warehouse.toObject() as unknown as Record<string, unknown>,
    });

    return warehouse;
  }

  /**
   * Soft deletes a warehouse.
   */
  static async delete(
    businessId: string | mongoose.Types.ObjectId,
    warehouseId: string | mongoose.Types.ObjectId,
    actor: { userId: string; email: string }
  ): Promise<{ success: boolean }> {
    const warehouse = await Warehouse.findOne({
      _id: warehouseId,
      $or: [{ businessId }, { businessId: { $exists: false } }],
      isDeleted: { $ne: true },
    });

    if (!warehouse) {
      throw new Error("Warehouse not found");
    }

    warehouse.isDeleted = true;
    await warehouse.save();

    await AuditService.log({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: "WAREHOUSE_DELETED",
      entityType: "warehouse",
      entityId: String(warehouse._id),
      beforeSnapshot: warehouse.toObject() as unknown as Record<string, unknown>,
    });

    return { success: true };
  }
}
