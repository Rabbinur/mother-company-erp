import { test, describe } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

describe("Phase 1: Token Version & Migration Policy Verification", () => {
  const SYSTEM_MIGRATION_DEPLOYED_AT = new Date("2026-11-21T00:00:00Z");
  const LEGACY_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;
  const LEGACY_CUTOFF_TIMESTAMP = new Date(SYSTEM_MIGRATION_DEPLOYED_AT.getTime() + LEGACY_GRACE_PERIOD_MS);

  function evaluateToken(payload, dbUser, httpMethod, currentTime) {
    const tokenIatMs = (payload.iat ?? 0) * 1000;
    if (!tokenIatMs || tokenIatMs > currentTime.getTime() + 60000) {
      return { allowed: false, error: "INVALID_IAT" };
    }

    const isMutation = httpMethod !== "GET" && httpMethod !== "HEAD";

    if (payload.tokenVersion === undefined) {
      if (tokenIatMs >= SYSTEM_MIGRATION_DEPLOYED_AT.getTime()) {
        return { allowed: false, error: "TOKEN_VERSION_MISSING" };
      }
      if (currentTime.getTime() >= LEGACY_CUTOFF_TIMESTAMP.getTime()) {
        return { allowed: false, error: "LEGACY_SESSION_EXPIRED" };
      }
      if (isMutation) {
        return { allowed: false, error: "LEGACY_TOKEN_UPGRADE_REQUIRED" };
      }
      if (dbUser.tokenVersion > 1) {
        return { allowed: false, error: "SESSION_REVOKED" };
      }
      return { allowed: true, mode: "LEGACY_GRACE_READ" };
    }

    if (payload.tokenVersion !== dbUser.tokenVersion) {
      return { allowed: false, error: "SESSION_REVOKED" };
    }

    return { allowed: true, mode: "MODERN_AUTHENTICATED" };
  }

  test("Legacy token issued before deployment within grace period allows GET read", () => {
    const legacyToken = { userId: "user1", iat: Math.floor(new Date("2026-11-20T12:00:00Z").getTime() / 1000) };
    const dbUser = { tokenVersion: 1 };
    const now = new Date("2026-11-21T08:00:00Z"); // Within 24-hr grace
    const result = evaluateToken(legacyToken, dbUser, "GET", now);
    assert.equal(result.allowed, true);
    assert.equal(result.mode, "LEGACY_GRACE_READ");
  });

  test("Legacy token rejects mutations immediately within grace period", () => {
    const legacyToken = { userId: "user1", iat: Math.floor(new Date("2026-11-20T12:00:00Z").getTime() / 1000) };
    const dbUser = { tokenVersion: 1 };
    const now = new Date("2026-11-21T08:00:00Z");
    const result = evaluateToken(legacyToken, dbUser, "POST", now);
    assert.equal(result.allowed, false);
    assert.equal(result.error, "LEGACY_TOKEN_UPGRADE_REQUIRED");
  });

  test("Legacy token rejects all requests after 24-hr cutoff", () => {
    const legacyToken = { userId: "user1", iat: Math.floor(new Date("2026-11-20T12:00:00Z").getTime() / 1000) };
    const dbUser = { tokenVersion: 1 };
    const now = new Date("2026-11-22T02:00:00Z"); // 26 hours after deployment
    const result = evaluateToken(legacyToken, dbUser, "GET", now);
    assert.equal(result.allowed, false);
    assert.equal(result.error, "LEGACY_SESSION_EXPIRED");
  });

  test("Token issued post-deployment missing tokenVersion is rejected", () => {
    const postDeployToken = { userId: "user1", iat: Math.floor(new Date("2026-11-21T04:00:00Z").getTime() / 1000) };
    const dbUser = { tokenVersion: 1 };
    const now = new Date("2026-11-21T05:00:00Z");
    const result = evaluateToken(postDeployToken, dbUser, "GET", now);
    assert.equal(result.allowed, false);
    assert.equal(result.error, "TOKEN_VERSION_MISSING");
  });

  test("Modern token with mismatched tokenVersion is revoked", () => {
    const modernToken = { userId: "user1", tokenVersion: 1, iat: Math.floor(new Date("2026-11-21T04:00:00Z").getTime() / 1000) };
    const dbUser = { tokenVersion: 2 }; // Admin incremented version after role change
    const now = new Date("2026-11-21T05:00:00Z");
    const result = evaluateToken(modernToken, dbUser, "GET", now);
    assert.equal(result.allowed, false);
    assert.equal(result.error, "SESSION_REVOKED");
  });
});

describe("Phase 1: Super Admin Emergency Gateway Cryptography", () => {
  const HMAC_SECRET = "test_hmac_secret_key_32bytes_min";

  function createHmacToken(ticketId, businessId, expiresAt) {
    const payload = `${ticketId}:${businessId}:${expiresAt.getTime()}`;
    const sig = crypto.createHmac("sha256", HMAC_SECRET).update(payload).digest("hex");
    return `${ticketId}.${expiresAt.getTime()}.${sig}`;
  }

  function verifyHmacToken(rawToken, expectedBusinessId) {
    const parts = rawToken.split(".");
    if (parts.length !== 3) return { valid: false, error: "MALFORMED" };
    const [ticketId, expiresAtStr, sig] = parts;
    const payload = `${ticketId}:${expectedBusinessId}:${expiresAtStr}`;
    const expectedSig = crypto.createHmac("sha256", HMAC_SECRET).update(payload).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return { valid: false, error: "SIGNATURE_MISMATCH" };
    }
    const expiresAt = new Date(Number(expiresAtStr));
    if (expiresAt.getTime() < Date.now()) {
      return { valid: false, error: "EXPIRED" };
    }
    return { valid: true, ticketId, expiresAt };
  }

  test("Valid HMAC token for correct business passes cryptographic check", () => {
    const expiry = new Date(Date.now() + 3600000); // 1 hr in future
    const token = createHmacToken("TICKET-001", "BUS-MEGHNA-01", expiry);
    const result = verifyHmacToken(token, "BUS-MEGHNA-01");
    assert.equal(result.valid, true);
    assert.equal(result.ticketId, "TICKET-001");
  });

  test("HMAC token presented against wrong business fails signature check", () => {
    const expiry = new Date(Date.now() + 3600000);
    const token = createHmacToken("TICKET-001", "BUS-MEGHNA-01", expiry);
    // Attacker attempts to use Meghna ticket to access PRAN business
    const result = verifyHmacToken(token, "BUS-PRAN-02");
    assert.equal(result.valid, false);
    assert.equal(result.error, "SIGNATURE_MISMATCH");
  });

  test("Expired HMAC token is rejected", () => {
    const expiredTime = new Date(Date.now() - 5000); // 5s in past
    const token = createHmacToken("TICKET-001", "BUS-MEGHNA-01", expiredTime);
    const result = verifyHmacToken(token, "BUS-MEGHNA-01");
    assert.equal(result.valid, false);
    assert.equal(result.error, "EXPIRED");
  });
});

describe("Phase 1: Delivery Stock Reconciliation 6-Scenario Proofs", () => {
  function calculateReconciliation({ O, Dp, Df, Rg, Rd, Re, W, P }) {
    const D = Dp + Df;
    const R = Rg + Rd + Re;
    const E = O - D + R - W;
    const Delta = P - E;
    const U_exp = O - D - W;
    const U_act = P - R;
    const Ag = U_act + Rg;
    const Ad = Rd;
    const Ae = Re;
    return { D, R, E, Delta, U_exp, U_act, Ag, Ad, Ae, TotalBay: Ag + Ad + Ae };
  }

  test("Scenario 1: Normal Balanced Delivery", () => {
    const res = calculateReconciliation({ O: 100, Dp: 80, Df: 0, Rg: 0, Rd: 0, Re: 0, W: 0, P: 20 });
    assert.equal(res.E, 20);
    assert.equal(res.Delta, 0);
    assert.equal(res.TotalBay, 20);
    assert.equal(res.Ag, 20);
  });

  test("Scenario 2: Good Retailer Returns Collected", () => {
    const res = calculateReconciliation({ O: 100, Dp: 70, Df: 5, Rg: 8, Rd: 0, Re: 0, W: 0, P: 33 });
    assert.equal(res.E, 33);
    assert.equal(res.Delta, 0);
    assert.equal(res.U_act, 25);
    assert.equal(res.Ag, 33);
    assert.equal(res.TotalBay, 33);
  });

  test("Scenario 3: Damaged & Expired Returns", () => {
    const res = calculateReconciliation({ O: 120, Dp: 90, Df: 0, Rg: 0, Rd: 6, Re: 4, W: 0, P: 40 });
    assert.equal(res.E, 40);
    assert.equal(res.Delta, 0);
    assert.equal(res.Ag, 30);
    assert.equal(res.Ad, 6);
    assert.equal(res.Ae, 4);
    assert.equal(res.TotalBay, 40);
  });

  test("Scenario 4: Unapproved Van Shortage", () => {
    const res = calculateReconciliation({ O: 100, Dp: 80, Df: 0, Rg: 5, Rd: 2, Re: 0, W: 0, P: 25 });
    assert.equal(res.E, 27);
    assert.equal(res.Delta, -2); // Exact 2 units shortage
    assert.equal(res.U_act, 18);
    assert.equal(res.Ag, 23); // 18 undelivered + 5 good returns
    assert.equal(res.Ad, 2);
    assert.equal(res.TotalBay, 25); // Sum check matches physical count P!
  });

  test("Scenario 5: Approved In-Transit Road Breakage", () => {
    const res = calculateReconciliation({ O: 80, Dp: 60, Df: 0, Rg: 0, Rd: 0, Re: 0, W: 3, P: 17 });
    assert.equal(res.E, 17);
    assert.equal(res.Delta, 0);
    assert.equal(res.TotalBay, 17);
  });

  test("Scenario 6: Unapproved Physical Excess", () => {
    const res = calculateReconciliation({ O: 60, Dp: 40, Df: 0, Rg: 0, Rd: 0, Re: 0, W: 0, P: 21 });
    assert.equal(res.E, 20);
    assert.equal(res.Delta, 1); // 1 unit excess
    assert.equal(res.U_act, 21);
    assert.equal(res.TotalBay, 21);
  });
});
