import mongoose from "mongoose";
import { Business, type IBusiness } from "@/models/Business";
import { AuditService } from "./AuditService";

export interface UpdateBusinessDto {
  name?: string;
  code?: string;
  legalName?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  status?: "active" | "inactive" | "suspended";
}

export class BusinessService {
  /**
   * Retrieves business profile by businessId.
   */
  static async getProfile(businessId: string | mongoose.Types.ObjectId): Promise<IBusiness | null> {
    const business = await Business.findOne({
      _id: businessId,
      isDeleted: false,
    }).lean();

    return business as IBusiness | null;
  }

  /**
   * Updates business profile with strict validation.
   * Legal name must remain unset unless owner explicitly supplies it.
   */
  static async updateProfile(
    businessId: string | mongoose.Types.ObjectId,
    data: UpdateBusinessDto,
    actor: { userId: string; email: string; role?: string; isOwner?: boolean }
  ): Promise<IBusiness> {
    const business = await Business.findOne({
      _id: businessId,
      isDeleted: false,
    });

    if (!business) {
      throw new Error("Business not found");
    }

    const beforeSnapshot = business.toObject();

    if (data.name !== undefined) {
      const cleanName = data.name.trim();
      if (!cleanName) throw new Error("Business name cannot be empty");
      business.name = cleanName;
    }

    if (data.code !== undefined) {
      const cleanCode = data.code.trim().toUpperCase();
      if (!cleanCode) throw new Error("Business code cannot be empty");

      // Verify code uniqueness if changed
      if (cleanCode !== business.code) {
        const existing = await Business.findOne({
          code: cleanCode,
          _id: { $ne: business._id },
          isDeleted: false,
        });
        if (existing) {
          throw new Error(`Business code '${cleanCode}' is already in use`);
        }
        business.code = cleanCode;
      }
    }

    // Legal name: Only allowed to be modified if owner explicitly sets it
    if (data.legalName !== undefined) {
      const cleanLegal = data.legalName.trim();
      business.legalName = cleanLegal || undefined;
    }

    if (data.contactPhone !== undefined) {
      business.contactPhone = data.contactPhone.trim() || undefined;
    }

    if (data.contactEmail !== undefined) {
      business.contactEmail = data.contactEmail.trim().toLowerCase() || undefined;
    }

    if (data.address !== undefined) {
      business.address = data.address.trim() || undefined;
    }

    if (data.status !== undefined) {
      // Only owner or super admin can change business status
      if (actor.role !== "super_admin" && !actor.isOwner) {
        throw new Error("Only the business owner or super admin can change business status");
      }
      business.status = data.status;
    }

    await business.save();

    await AuditService.log({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: "BUSINESS_UPDATED",
      entityType: "business",
      entityId: String(business._id),
      beforeSnapshot: beforeSnapshot as unknown as Record<string, unknown>,
      afterSnapshot: business.toObject() as unknown as Record<string, unknown>,
    });

    return business;
  }
}
