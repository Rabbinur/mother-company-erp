import mongoose from "mongoose";
import { DealershipMembership, type IDealershipMembership } from "@/models/DealershipMembership";
import { Dealership } from "@/models/Dealership";
import { User } from "@/models/User";
import { AuditService } from "./AuditService";

export interface CreateMembershipDto {
  dealershipId: string;
  userId: string;
  role: string;
  isPrimary?: boolean;
  status?: "active" | "inactive" | "suspended";
  permissions?: string[];
  employeeId?: string;
  designation?: string;
  department?: string;
}

export interface UpdateMembershipDto {
  role?: string;
  isPrimary?: boolean;
  status?: "active" | "inactive" | "suspended";
  permissions?: string[];
  employeeId?: string;
  designation?: string;
  department?: string;
}

export interface MembershipQueryParams {
  dealershipId?: string;
  userId?: string;
  role?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export class DealershipMembershipService {
  /**
   * Lists dealership memberships within a business with filters and pagination.
   */
  static async list(
    businessId: string | mongoose.Types.ObjectId,
    params: MembershipQueryParams = {}
  ): Promise<{ items: IDealershipMembership[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {
      businessId,
      isDeleted: false,
    };

    if (params.dealershipId) query.dealershipId = params.dealershipId;
    if (params.userId) query.userId = params.userId;
    if (params.role) query.role = params.role;
    if (params.status) query.status = params.status;

    const [items, total] = await Promise.all([
      DealershipMembership.find(query)
        .populate("userId", "name email phone role status")
        .populate("dealershipId", "name code status")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      DealershipMembership.countDocuments(query),
    ]);

    return {
      items: items as unknown as IDealershipMembership[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Retrieves single dealership membership by ID within a business.
   */
  static async getById(
    businessId: string | mongoose.Types.ObjectId,
    membershipId: string | mongoose.Types.ObjectId
  ): Promise<IDealershipMembership | null> {
    const membership = await DealershipMembership.findOne({
      _id: membershipId,
      businessId,
      isDeleted: false,
    })
      .populate("userId", "name email phone role status")
      .populate("dealershipId", "name code status")
      .lean();

    return membership as unknown as IDealershipMembership | null;
  }

  /**
   * Creates a new dealership membership.
   * Validates business boundaries, user existence, and strictly prevents duplicate active memberships.
   */
  static async create(
    businessId: string | mongoose.Types.ObjectId,
    data: CreateMembershipDto,
    actor: { userId: string; email: string }
  ): Promise<IDealershipMembership> {
    if (!data.dealershipId) throw new Error("dealershipId is required");
    if (!data.userId) throw new Error("userId is required");
    if (!data.role) throw new Error("role is required");

    // 1. Verify Dealership exists and belongs to this business
    const dealership = await Dealership.findOne({
      _id: data.dealershipId,
      businessId,
      isDeleted: false,
    });
    if (!dealership) {
      throw new Error("Specified dealership does not exist or does not belong to this business");
    }

    // 2. Verify User exists and is active
    const user = await User.findOne({
      _id: data.userId,
      isDeleted: { $ne: true },
    });
    if (!user) {
      throw new Error("Specified user does not exist");
    }

    // 3. Prevent duplicate active membership for (dealershipId, userId)
    const existing = await DealershipMembership.findOne({
      dealershipId: data.dealershipId,
      userId: data.userId,
      isDeleted: false,
    });
    if (existing) {
      throw new Error(`User already holds a membership in dealership '${dealership.name}'`);
    }

    // 4. If this is designated primary, unset previous primary for this user in this business
    if (data.isPrimary) {
      await DealershipMembership.updateMany(
        { userId: data.userId, businessId, isDeleted: false },
        { $set: { isPrimary: false } }
      );
    }

    const membership = await DealershipMembership.create({
      businessId,
      dealershipId: data.dealershipId,
      userId: data.userId,
      role: data.role.trim().toLowerCase(),
      isPrimary: !!data.isPrimary,
      status: data.status || "active",
      permissions: data.permissions || [],
      employeeId: data.employeeId?.trim() || undefined,
      designation: data.designation?.trim() || undefined,
      department: data.department?.trim() || undefined,
      isDeleted: false,
    });

    await AuditService.log({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: "MEMBERSHIP_CREATED",
      entityType: "dealership_membership",
      entityId: String(membership._id),
      afterSnapshot: membership.toObject() as unknown as Record<string, unknown>,
    });

    return membership;
  }

  /**
   * Updates an existing dealership membership.
   */
  static async update(
    businessId: string | mongoose.Types.ObjectId,
    membershipId: string | mongoose.Types.ObjectId,
    data: UpdateMembershipDto,
    actor: { userId: string; email: string }
  ): Promise<IDealershipMembership> {
    const membership = await DealershipMembership.findOne({
      _id: membershipId,
      businessId,
      isDeleted: false,
    });

    if (!membership) {
      throw new Error("Dealership membership not found");
    }

    const beforeSnapshot = membership.toObject() as unknown as Record<string, unknown>;

    if (data.role !== undefined) {
      const cleanRole = data.role.trim().toLowerCase();
      if (!cleanRole) throw new Error("Role cannot be empty");
      membership.role = cleanRole;
    }

    if (data.isPrimary !== undefined && data.isPrimary && !membership.isPrimary) {
      // Unset other primary memberships for this user
      await DealershipMembership.updateMany(
        { userId: membership.userId, businessId, _id: { $ne: membership._id }, isDeleted: false },
        { $set: { isPrimary: false } }
      );
      membership.isPrimary = true;
    } else if (data.isPrimary !== undefined) {
      membership.isPrimary = data.isPrimary;
    }

    if (data.status !== undefined) membership.status = data.status;
    if (data.permissions !== undefined) membership.permissions = data.permissions;
    if (data.employeeId !== undefined) membership.employeeId = data.employeeId.trim() || undefined;
    if (data.designation !== undefined) membership.designation = data.designation.trim() || undefined;
    if (data.department !== undefined) membership.department = data.department.trim() || undefined;

    await membership.save();

    await AuditService.log({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: "MEMBERSHIP_UPDATED",
      entityType: "dealership_membership",
      entityId: String(membership._id),
      beforeSnapshot,
      afterSnapshot: membership.toObject() as unknown as Record<string, unknown>,
    });

    return membership;
  }

  /**
   * Soft deletes / revokes a dealership membership.
   */
  static async delete(
    businessId: string | mongoose.Types.ObjectId,
    membershipId: string | mongoose.Types.ObjectId,
    actor: { userId: string; email: string }
  ): Promise<{ success: boolean }> {
    const membership = await DealershipMembership.findOne({
      _id: membershipId,
      businessId,
      isDeleted: false,
    });

    if (!membership) {
      throw new Error("Dealership membership not found");
    }

    membership.isDeleted = true;
    membership.status = "inactive";
    await membership.save();

    await AuditService.log({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: "MEMBERSHIP_DELETED",
      entityType: "dealership_membership",
      entityId: String(membership._id),
      beforeSnapshot: membership.toObject() as unknown as Record<string, unknown>,
    });

    return { success: true };
  }

  /**
   * Retrieves all active dealerships a user belongs to in a business.
   */
  static async getUserDealerships(
    userId: string | mongoose.Types.ObjectId,
    businessId: string | mongoose.Types.ObjectId
  ): Promise<any[]> {
    const memberships = await DealershipMembership.find({
      userId,
      businessId,
      status: "active",
      isDeleted: false,
    })
      .populate("dealershipId", "name code status principalCompanyId")
      .lean();

    return memberships.map((m: any) => ({
      membershipId: m._id,
      dealership: m.dealershipId,
      role: m.role,
      isPrimary: m.isPrimary,
    }));
  }
}
