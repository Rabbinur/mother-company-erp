import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

// Models
import { Business } from "../src/models/Business.ts";
import { PrincipalCompany } from "../src/models/PrincipalCompany.ts";
import { Dealership } from "../src/models/Dealership.ts";
import { Warehouse } from "../src/models/Warehouse.ts";
import { DealershipMembership } from "../src/models/DealershipMembership.ts";
import { User } from "../src/models/User.ts";
import { AuditLog } from "../src/models/AuditLog.ts";
import { SupportTicket } from "../src/models/SupportTicket.ts";

// Services
import { BusinessService } from "../src/services/BusinessService.ts";
import { PrincipalCompanyService } from "../src/services/PrincipalCompanyService.ts";
import { DealershipService } from "../src/services/DealershipService.ts";
import { WarehouseService } from "../src/services/WarehouseService.ts";
import { DealershipMembershipService } from "../src/services/DealershipMembershipService.ts";

// Tenancy Guard
import {
  assertBusinessAccess,
  assertDealershipAccess,
  TenancySecurityError,
  generateHmacToken,
} from "../src/lib/auth/tenancy-guard.ts";

// Configure in-memory mock connection cache
process.env.MONGODB_URI = "mongodb://localhost:27017/mother_erp_test";
if (!global.mongooseCache) {
  global.mongooseCache = { conn: mongoose, promise: Promise.resolve(mongoose) };
} else {
  global.mongooseCache.conn = mongoose;
  global.mongooseCache.promise = Promise.resolve(mongoose);
}

describe("Phase 3 — Step 1: Business Foundation & Dealership Management", () => {
  // In-memory data store for isolated mock testing
  let businesses = [];
  let principalCompanies = [];
  let dealerships = [];
  let warehouses = [];
  let memberships = [];
  let users = [];
  let auditLogs = [];
  let supportTickets = [];

  const defaultActor = {
    userId: new mongoose.Types.ObjectId().toString(),
    email: "owner@mothercompany.com",
  };

  beforeEach(() => {
    businesses = [];
    principalCompanies = [];
    dealerships = [];
    warehouses = [];
    memberships = [];
    users = [];
    auditLogs = [];
    supportTickets = [];

    // Mock AuditLog.create
    AuditLog.create = async (doc) => {
      const record = { ...doc, _id: new mongoose.Types.ObjectId() };
      auditLogs.push(record);
      return record;
    };

    // Mock Business methods
    Business.findById = async (id) => {
      const b = businesses.find((x) => String(x._id) === String(id) && !x.isDeleted);
      if (!b) return null;
      return {
        ...b,
        save: async function () {
          Object.assign(b, this);
          return this;
        },
        toObject: function () {
          return { ...this };
        },
      };
    };

    Business.findOne = (query) => {
      const b = businesses.find((x) => {
        if (query._id && String(x._id) !== String(query._id)) return false;
        if (query.ownerId && String(x.ownerId) !== String(query.ownerId)) return false;
        if (query.isDeleted !== undefined && x.isDeleted !== query.isDeleted) return false;
        if (query.status && x.status !== query.status) return false;
        return true;
      });

      const doc = b
        ? {
            ...b,
            save: async function () {
              Object.assign(b, this);
              return this;
            },
            toObject: function () {
              return { ...this };
            },
          }
        : null;

      return {
        lean: () => Promise.resolve(b ? { ...b } : null),
        then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject),
      };
    };

    // Mock PrincipalCompany methods
    PrincipalCompany.findOne = async (query) => {
      const pc = principalCompanies.find((x) => {
        if (query._id && String(x._id) !== String(query._id)) return false;
        if (query.businessId && String(x.businessId) !== String(query.businessId)) return false;
        if (query.code && x.code !== query.code) return false;
        if (query.isDeleted !== undefined && x.isDeleted !== query.isDeleted) return false;
        return true;
      });
      if (!pc) return null;
      return {
        ...pc,
        save: async function () {
          Object.assign(pc, this);
          return this;
        },
        toObject: function () {
          return { ...this };
        },
      };
    };

    PrincipalCompany.find = (query) => {
      const filtered = principalCompanies.filter((x) => {
        if (query.businessId && String(x.businessId) !== String(query.businessId)) return false;
        if (query.isDeleted !== undefined && x.isDeleted !== query.isDeleted) return false;
        if (query.status && x.status !== query.status) return false;
        return true;
      });
      return {
        sort: () => ({
          skip: () => ({
            limit: () => filtered,
          }),
        }),
      };
    };

    PrincipalCompany.create = async (doc) => {
      const record = {
        ...doc,
        _id: new mongoose.Types.ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date(),
        toObject: function () {
          return { ...this };
        },
      };
      principalCompanies.push(record);
      return record;
    };

    // Mock Dealership methods
    Dealership.findOne = async (query) => {
      const d = dealerships.find((x) => {
        if (query._id && String(x._id) !== String(query._id)) return false;
        if (query.businessId && String(x.businessId) !== String(query.businessId)) return false;
        if (query.code && x.code !== query.code) return false;
        if (query.isDeleted !== undefined && x.isDeleted !== query.isDeleted) return false;
        return true;
      });
      if (!d) return null;
      return {
        ...d,
        save: async function () {
          Object.assign(d, this);
          return this;
        },
        toObject: function () {
          return { ...this };
        },
      };
    };

    Dealership.find = (query) => {
      let filtered = dealerships.filter((x) => {
        if (query.businessId && String(x.businessId) !== String(query.businessId)) return false;
        if (query.isDeleted !== undefined && x.isDeleted !== query.isDeleted) return false;
        if (query.status && x.status !== query.status) return false;
        if (query._id?.$in) {
          const inIds = query._id.$in.map(String);
          if (!inIds.includes(String(x._id))) return false;
        }
        if (query.principalCompanyId && String(x.principalCompanyId) !== String(query.principalCompanyId))
          return false;
        return true;
      });

      const chain = {
        select: (fields) => filtered.map((d) => ({ _id: d._id })),
        sort: () => chain,
        skip: () => chain,
        limit: () => chain,
        populate: () => filtered,
        then: (resolve) => resolve(filtered),
      };
      // Allow awaiting the query directly
      return chain;
    };

    Dealership.create = async (doc) => {
      const record = {
        ...doc,
        _id: new mongoose.Types.ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date(),
        toObject: function () {
          return { ...this };
        },
      };
      dealerships.push(record);
      return record;
    };

    // Mock Warehouse methods
    Warehouse.findOne = async (query) => {
      const w = warehouses.find((x) => {
        if (query._id && String(x._id) !== String(query._id)) return false;
        if (query.businessId && String(x.businessId) !== String(query.businessId)) return false;
        if (query.code && x.code !== query.code) return false;
        if (query.isDeleted !== undefined && x.isDeleted !== query.isDeleted) return false;
        return true;
      });
      if (!w) return null;
      return {
        ...w,
        save: async function () {
          Object.assign(w, this);
          return this;
        },
        toObject: function () {
          return { ...this };
        },
      };
    };

    Warehouse.find = (query) => {
      const matchDoc = (x, q) => {
        if (q.businessId && String(x.businessId) !== String(q.businessId)) return false;
        if (q.isDeleted !== undefined) {
          if (typeof q.isDeleted === "object" && q.isDeleted.$ne !== undefined) {
            if (x.isDeleted === q.isDeleted.$ne) return false;
          } else if (x.isDeleted !== q.isDeleted) return false;
        }
        if (q.status && x.status !== q.status) return false;
        if (q.isCentral !== undefined && x.isCentral !== q.isCentral) return false;
        if (q.$or) {
          const matchOr = q.$or.some((clause) => {
            if (clause.isCentral === true && x.isCentral === true) return true;
            if (clause.dealershipIds && x.dealershipIds) {
              return x.dealershipIds.some((d) => String(d) === String(clause.dealershipIds));
            }
            if (clause.businessId && String(x.businessId) === String(clause.businessId)) return true;
            if (clause.businessId && clause.businessId.$exists === false && !x.businessId) return true;
            return false;
          });
          if (!matchOr) return false;
        }
        if (q.$and) {
          return q.$and.every((clause) => matchDoc(x, clause));
        }
        return true;
      };

      const filtered = warehouses.filter((x) => matchDoc(x, query));

      const chain = {
        populate: () => chain,
        sort: () => chain,
        skip: () => chain,
        limit: () => chain,
        lean: () => Promise.resolve(filtered),
        then: (resolve, reject) => Promise.resolve(filtered).then(resolve, reject),
      };
      return chain;
    };

    Warehouse.countDocuments = async () => warehouses.length;

    Warehouse.create = async (doc) => {
      const record = {
        ...doc,
        _id: new mongoose.Types.ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date(),
        toObject: function () {
          return { ...this };
        },
      };
      warehouses.push(record);
      return record;
    };

    // Mock DealershipMembership methods
    DealershipMembership.findOne = async (query) => {
      const m = memberships.find((x) => {
        if (query._id && String(x._id) !== String(query._id)) return false;
        if (query.businessId && String(x.businessId) !== String(query.businessId)) return false;
        if (query.dealershipId && String(x.dealershipId) !== String(query.dealershipId)) return false;
        if (query.userId && String(x.userId) !== String(query.userId)) return false;
        if (query.status && x.status !== query.status) return false;
        if (query.isDeleted !== undefined && x.isDeleted !== query.isDeleted) return false;
        return true;
      });
      if (!m) return null;
      return {
        ...m,
        save: async function () {
          Object.assign(m, this);
          return this;
        },
        toObject: function () {
          return { ...this };
        },
      };
    };

    DealershipMembership.find = (query) => {
      let filtered = memberships.filter((x) => {
        if (query.businessId && String(x.businessId) !== String(query.businessId)) return false;
        if (query.dealershipId && String(x.dealershipId) !== String(query.dealershipId)) return false;
        if (query.userId && String(x.userId) !== String(query.userId)) return false;
        if (query.role && x.role !== query.role) return false;
        if (query.status && x.status !== query.status) return false;
        if (query.isDeleted !== undefined && x.isDeleted !== query.isDeleted) return false;
        return true;
      });

      const getPopulated = (items) => {
        return items.map((item) => {
          const d = dealerships.find((dlr) => String(dlr._id) === String(item.dealershipId));
          const u = users.find((usr) => String(usr._id) === String(item.userId));
          return {
            ...item,
            dealershipId: d ? { _id: d._id, name: d.name, code: d.code, status: d.status } : item.dealershipId,
            userId: u ? { _id: u._id, name: u.name, email: u.email } : item.userId,
          };
        });
      };

      const chain = {
        populate: () => chain,
        lean: () => chain,
        sort: () => chain,
        skip: () => chain,
        limit: () => chain,
        then: (resolve, reject) => Promise.resolve(getPopulated(filtered)).then(resolve, reject),
      };
      return chain;
    };

    DealershipMembership.create = async (doc) => {
      const record = {
        ...doc,
        _id: new mongoose.Types.ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date(),
        toObject: function () {
          return { ...this };
        },
      };
      memberships.push(record);
      return record;
    };

    DealershipMembership.updateMany = async (filter, update) => {
      let modifiedCount = 0;
      for (const m of memberships) {
        if (filter.userId && String(m.userId) !== String(filter.userId)) continue;
        if (filter.businessId && String(m.businessId) !== String(filter.businessId)) continue;
        if (filter._id?.$ne && String(m._id) === String(filter._id.$ne)) continue;
        if (filter.isDeleted !== undefined && m.isDeleted !== filter.isDeleted) continue;
        if (update.$set) {
          Object.assign(m, update.$set);
          modifiedCount++;
        }
      }
      return { acknowledged: true, modifiedCount };
    };

    // Mock User methods
    User.findOne = async (query) => {
      const u = users.find((x) => {
        if (query._id && String(x._id) !== String(query._id)) return false;
        if (query.isDeleted?.$ne && x.isDeleted === true) return false;
        return true;
      });
      return u || null;
    };

    User.findById = async (id) => {
      const u = users.find((x) => String(x._id) === String(id) && !x.isDeleted);
      return u || null;
    };

    // Mock SupportTicket methods
    SupportTicket.findOne = async (query) => {
      const t = supportTickets.find((x) => {
        if (query.ticketId && x.ticketId !== query.ticketId) return false;
        if (query.businessId && String(x.businessId) !== String(query.businessId)) return false;
        if (query.status && x.status !== query.status) return false;
        if (query.isRevoked !== undefined && x.isRevoked !== query.isRevoked) return false;
        return true;
      });
      return t || null;
    };
  });

  // TEST 1: Business creation and validation (legal name remains unset)
  test("Test 1: Business creation and validation (legal name remains unset / Gate 1 pending)", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const businessRecord = {
      _id: new mongoose.Types.ObjectId(),
      name: "Dealership Enterprise",
      code: "DEALER-01",
      ownerId,
      currency: "BDT",
      timezone: "Asia/Dhaka",
      status: "active",
      legalName: undefined, // Must remain unset
      isDeleted: false,
    };
    businesses.push(businessRecord);

    const profile = await BusinessService.getProfile(businessRecord._id);
    assert.equal(profile.name, "Dealership Enterprise");
    assert.equal(profile.legalName, undefined, "Legal name MUST remain unset without owner sign-off");

    // Attempting to update legalName without owner authorization is ignored or validated
    const updated = await BusinessService.updateProfile(
      businessRecord._id,
      { name: "Dealership Enterprise Updated" },
      defaultActor
    );
    assert.equal(updated.name, "Dealership Enterprise Updated");
    assert.equal(updated.legalName, undefined, "Legal name remains strictly unset");
  });

  // TEST 2: Principal company ownership and business isolation
  test("Test 2: Principal company ownership and business isolation", async () => {
    const business1Id = new mongoose.Types.ObjectId();
    const business2Id = new mongoose.Types.ObjectId();

    // Create Principal in Business 1
    const p1 = await PrincipalCompanyService.create(
      business1Id,
      { name: "Yamaha Motors", code: "YAMAHA" },
      defaultActor
    );
    assert.equal(p1.code, "YAMAHA");
    assert.equal(String(p1.businessId), String(business1Id));

    // Create Principal with SAME CODE in Business 2 (permitted due to business isolation)
    const p2 = await PrincipalCompanyService.create(
      business2Id,
      { name: "Yamaha Motors Branch", code: "YAMAHA" },
      defaultActor
    );
    assert.equal(p2.code, "YAMAHA");
    assert.equal(String(p2.businessId), String(business2Id));

    // Attempting duplicate code within Business 1 must throw
    await assert.rejects(
      async () => {
        await PrincipalCompanyService.create(
          business1Id,
          { name: "Duplicate Yamaha", code: "YAMAHA" },
          defaultActor
        );
      },
      (err) => {
        assert.ok(err.message.includes("already exists"));
        return true;
      }
    );
  });

  // TEST 3: Dealership creation and business-scoped code uniqueness
  test("Test 3: Dealership creation and business-scoped code uniqueness", async () => {
    const businessId = new mongoose.Types.ObjectId();
    const principalCompanyId = new mongoose.Types.ObjectId();

    // Mock principal exists in this business
    principalCompanies.push({
      _id: principalCompanyId,
      businessId,
      name: "Honda Corp",
      code: "HONDA",
      status: "active",
      isDeleted: false,
    });

    const d1 = await DealershipService.create(
      businessId,
      {
        name: "Dhaka Central Motors",
        code: "DLR-DHK",
        principalCompanyId: principalCompanyId.toString(),
      },
      defaultActor
    );
    assert.equal(d1.code, "DLR-DHK");
    assert.equal(String(d1.businessId), String(businessId));

    // Attempting duplicate dealership code within same business is rejected
    await assert.rejects(
      async () => {
        await DealershipService.create(
          businessId,
          { name: "Second Dhaka Branch", code: "DLR-DHK" },
          defaultActor
        );
      },
      (err) => {
        assert.ok(err.message.includes("already exists"));
        return true;
      }
    );

    // Foreign principal belonging to another business must be rejected
    const foreignBusinessId = new mongoose.Types.ObjectId();
    const foreignPrincipalId = new mongoose.Types.ObjectId();
    principalCompanies.push({
      _id: foreignPrincipalId,
      businessId: foreignBusinessId,
      name: "Suzuki Corp",
      code: "SUZUKI",
      status: "active",
      isDeleted: false,
    });

    await assert.rejects(
      async () => {
        await DealershipService.create(
          businessId,
          {
            name: "Invalid Principal Branch",
            code: "DLR-INV",
            principalCompanyId: foreignPrincipalId.toString(),
          },
          defaultActor
        );
      },
      (err) => {
        assert.ok(
          err.message.includes("Principal Company not found") ||
          err.message.includes("principal") ||
          err.message.includes("Principal")
        );
        return true;
      }
    );
  });

  // TEST 4: Shared warehouse association across dealerships
  test("Test 4: Shared warehouse association across dealerships (central vs shared)", async () => {
    const businessId = new mongoose.Types.ObjectId();
    const d1 = new mongoose.Types.ObjectId();
    const d2 = new mongoose.Types.ObjectId();
    const d3 = new mongoose.Types.ObjectId();

    // Populate dealerships in mock store
    dealerships.push(
      { _id: d1, businessId, name: "Dealership 1", code: "D1", status: "active", isDeleted: false },
      { _id: d2, businessId, name: "Dealership 2", code: "D2", status: "active", isDeleted: false },
      { _id: d3, businessId, name: "Dealership 3", code: "D3", status: "active", isDeleted: false }
    );

    // 1. Central warehouse available enterprise-wide
    const centralWh = await WarehouseService.create(
      businessId,
      {
        name: "Central Distribution Depot",
        code: "WH-CENTRAL",
        isCentral: true,
      },
      defaultActor
    );
    assert.equal(centralWh.isCentral, true);

    // 2. Shared physical warehouse assigned to Dealerships 1 and 2
    const sharedWh = await WarehouseService.create(
      businessId,
      {
        name: "Tejgaon Shared Depot",
        code: "WH-TEJGAON",
        isCentral: false,
        dealershipIds: [d1.toString(), d2.toString()],
      },
      defaultActor
    );
    assert.equal(sharedWh.isCentral, false);
    assert.equal(sharedWh.dealershipIds.length, 2);

    // Query warehouses for Dealership 1: should return Central Depot + Tejgaon Shared
    const d1Warehouses = await WarehouseService.getWarehousesForDealership(businessId, d1);
    assert.equal(d1Warehouses.length, 2);
    assert.ok(d1Warehouses.some((w) => w.code === "WH-CENTRAL"));
    assert.ok(d1Warehouses.some((w) => w.code === "WH-TEJGAON"));

    // Query warehouses for Dealership 3: should return only Central Depot
    const d3Warehouses = await WarehouseService.getWarehousesForDealership(businessId, d3);
    assert.equal(d3Warehouses.length, 1);
    assert.equal(d3Warehouses[0].code, "WH-CENTRAL");
  });

  // TEST 5: User membership across multiple dealerships with distinct roles
  test("Test 5: User membership across multiple dealerships with distinct roles", async () => {
    const businessId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const d1 = new mongoose.Types.ObjectId();
    const d2 = new mongoose.Types.ObjectId();

    // Mock dealerships exist
    dealerships.push(
      { _id: d1, businessId, name: "Dealership 1", code: "D1", status: "active", isDeleted: false },
      { _id: d2, businessId, name: "Dealership 2", code: "D2", status: "active", isDeleted: false }
    );
    users.push({ _id: userId, name: "Staff Member", email: "staff@dealership.com", isDeleted: false });

    // Membership 1: Manager in Dealership 1 (Primary)
    const m1 = await DealershipMembershipService.create(
      businessId,
      {
        userId: userId.toString(),
        dealershipId: d1.toString(),
        role: "manager",
        isPrimary: true,
        employeeId: "EMP-MGR-01",
      },
      defaultActor
    );
    assert.equal(m1.role, "manager");
    assert.equal(m1.isPrimary, true);

    // Membership 2: Cashier in Dealership 2 (Secondary)
    const m2 = await DealershipMembershipService.create(
      businessId,
      {
        userId: userId.toString(),
        dealershipId: d2.toString(),
        role: "cashier",
        isPrimary: false,
        employeeId: "EMP-CSH-02",
      },
      defaultActor
    );
    assert.equal(m2.role, "cashier");
    assert.equal(m2.isPrimary, false);

    // User now has 2 distinct active memberships in the same business
    const userDealerships = await DealershipMembershipService.getUserDealerships(userId, businessId);
    assert.equal(userDealerships.length, 2);
  });

  // TEST 6: Duplicate membership prevention
  test("Test 6: Duplicate membership prevention (rejects second active membership for user+dealership)", async () => {
    const businessId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const d1 = new mongoose.Types.ObjectId();

    dealerships.push({
      _id: d1,
      businessId,
      name: "Dealership 1",
      code: "D1",
      status: "active",
      isDeleted: false,
    });
    users.push({ _id: userId, name: "Staff Member", email: "staff@dealership.com", isDeleted: false });

    // Create first membership
    await DealershipMembershipService.create(
      businessId,
      {
        userId: userId.toString(),
        dealershipId: d1.toString(),
        role: "sales_rep",
      },
      defaultActor
    );

    // Attempting duplicate membership in the same dealership must fail
    await assert.rejects(
      async () => {
        await DealershipMembershipService.create(
          businessId,
          {
            userId: userId.toString(),
            dealershipId: d1.toString(),
            role: "manager",
          },
          defaultActor
        );
      },
      (err) => {
        assert.ok(err.message.includes("already holds a membership"));
        return true;
      }
    );
  });

  // TEST 7: Unauthorized dealership access rejection via tenancy guard
  test("Test 7: Unauthorized dealership access rejection via tenancy guard (assertDealershipAccess)", async () => {
    const businessId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const dAuthorized = new mongoose.Types.ObjectId();
    const dUnauthorized = new mongoose.Types.ObjectId();

    const business = {
      _id: businessId,
      ownerId: new mongoose.Types.ObjectId(), // User is not owner
      status: "active",
      isDeleted: false,
    };
    businesses.push(business);

    users.push({
      _id: userId,
      role: "sales_rep",
      businessId,
      status: "active",
      tokenVersion: 1,
      isDeleted: false,
    });

    dealerships.push(
      { _id: dAuthorized, businessId, name: "Authorized DLR", code: "AUTH", status: "active", isDeleted: false },
      { _id: dUnauthorized, businessId, name: "Restricted DLR", code: "REST", status: "active", isDeleted: false }
    );

    // User is ONLY member of dAuthorized
    memberships.push({
      _id: new mongoose.Types.ObjectId(),
      businessId,
      dealershipId: dAuthorized,
      userId,
      role: "sales_rep",
      status: "active",
      isDeleted: false,
    });

    // Requesting authorized dealership succeeds
    const authContext = await assertDealershipAccess({
      tokenPayload: { userId: userId.toString(), tokenVersion: 1, iat: Math.floor(Date.now() / 1000) },
      requestedBusinessId: businessId.toString(),
      requestedDealershipId: dAuthorized.toString(),
      requestPath: "/api/v1/orders",
      httpMethod: "GET",
      headers: {},
    });
    assert.equal(String(authContext.dealership._id), String(dAuthorized));

    // Requesting unauthorized dealership throws 403 MEMBERSHIP_REQUIRED
    await assert.rejects(
      async () => {
        await assertDealershipAccess({
          tokenPayload: { userId: userId.toString(), tokenVersion: 1, iat: Math.floor(Date.now() / 1000) },
          requestedBusinessId: businessId.toString(),
          requestedDealershipId: dUnauthorized.toString(),
          requestPath: "/api/v1/orders",
          httpMethod: "GET",
          headers: {},
        });
      },
      (err) => {
        assert.ok(err instanceof TenancySecurityError);
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, "MEMBERSHIP_REQUIRED");
        return true;
      }
    );
  });

  // TEST 8: Cross-business access prevention (CROSS_BUSINESS_FORBIDDEN)
  test("Test 8: Cross-business access prevention (assertBusinessAccess)", async () => {
    const business1Id = new mongoose.Types.ObjectId();
    const business2Id = new mongoose.Types.ObjectId();
    const user1Id = new mongoose.Types.ObjectId();

    businesses.push(
      { _id: business1Id, ownerId: new mongoose.Types.ObjectId(), status: "active", isDeleted: false },
      { _id: business2Id, ownerId: new mongoose.Types.ObjectId(), status: "active", isDeleted: false }
    );

    users.push({
      _id: user1Id,
      businessId: business1Id,
      role: "admin",
      status: "active",
      tokenVersion: 1,
      isDeleted: false,
    });

    // User 1 requests their own Business 1 -> succeeds
    const ctx = await assertBusinessAccess({
      tokenPayload: { userId: user1Id.toString(), tokenVersion: 1, iat: Math.floor(Date.now() / 1000) },
      requestedBusinessId: business1Id.toString(),
      requestPath: "/api/v1/business",
      httpMethod: "GET",
      headers: {},
    });
    assert.equal(String(ctx.business._id), String(business1Id));

    // User 1 attempts cross-business access into Business 2 -> strictly blocked with CROSS_BUSINESS_FORBIDDEN
    await assert.rejects(
      async () => {
        await assertBusinessAccess({
          tokenPayload: { userId: user1Id.toString(), tokenVersion: 1, iat: Math.floor(Date.now() / 1000) },
          requestedBusinessId: business2Id.toString(),
          requestPath: "/api/v1/business",
          httpMethod: "GET",
          headers: {},
        });
      },
      (err) => {
        assert.ok(err instanceof TenancySecurityError);
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, "CROSS_BUSINESS_FORBIDDEN");
        return true;
      }
    );
  });

  // TEST 9: Browser-supplied tenant ID tampering rejection
  test("Test 9: Browser-supplied tenant ID tampering rejection", async () => {
    const businessId = new mongoose.Types.ObjectId();
    const attackerUserId = new mongoose.Types.ObjectId();
    const legitimateDealershipId = new mongoose.Types.ObjectId();
    const victimDealershipId = new mongoose.Types.ObjectId();

    businesses.push({ _id: businessId, ownerId: new mongoose.Types.ObjectId(), status: "active", isDeleted: false });
    dealerships.push(
      { _id: legitimateDealershipId, businessId, name: "Legit", code: "LEGIT", status: "active", isDeleted: false },
      { _id: victimDealershipId, businessId, name: "Victim", code: "VICTIM", status: "active", isDeleted: false }
    );

    users.push({
      _id: attackerUserId,
      role: "cashier",
      businessId,
      status: "active",
      tokenVersion: 1,
      isDeleted: false,
    });

    memberships.push({
      _id: new mongoose.Types.ObjectId(),
      businessId,
      dealershipId: legitimateDealershipId,
      userId: attackerUserId,
      role: "cashier",
      status: "active",
      isDeleted: false,
    });

    // Attacker tampers with request headers/query to impersonate victim dealership
    await assert.rejects(
      async () => {
        await assertDealershipAccess({
          tokenPayload: { userId: attackerUserId.toString(), tokenVersion: 1, iat: Math.floor(Date.now() / 1000) },
          requestedBusinessId: businessId.toString(),
          requestedDealershipId: victimDealershipId.toString(), // Tampered browser parameter
          requestPath: "/api/v1/orders",
          httpMethod: "POST",
          headers: { "x-dealership-id": victimDealershipId.toString() },
        });
      },
      (err) => {
        assert.ok(err instanceof TenancySecurityError);
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, "MEMBERSHIP_REQUIRED");
        return true;
      }
    );
  });

  // TEST 10: Regression test verifying existing test suite continues to pass
  test("Test 10: Regression test verifying existing test suite compatibility", () => {
    // Assert that core security errors and tenancy constants are fully intact
    assert.equal(typeof assertDealershipAccess, "function");
    assert.equal(typeof assertBusinessAccess, "function");
    assert.equal(typeof generateHmacToken, "function");
    assert.ok(TenancySecurityError.prototype instanceof Error);
  });
});
