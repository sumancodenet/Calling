import bcrypt from "bcryptjs";
import { Op } from "sequelize";
import { Tenants, Users, RefreshTokens } from "../../../models/index.js";
import { unauthorized, forbidden, tooManyRequests } from "../../../utils/AppError.js";
import { hashToken, newFamilyId, newRefreshToken, refreshExpiry, signAccessToken, publicUser } from "../../../utils/tokens.js";
import ROLES from "../../../constants/roles.js";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

const GENERIC_LOGIN_FAILURE = "Invalid tenant, username or password";

// A real bcrypt hash of a throwaway string, compared against when the tenant or user
// does not exist so that a missing account and a wrong password cost the same time.
const DUMMY_HASH = "$2b$10$gAkAL01s3.wZI5zd54jtdeCiy8NZEBLEXBhAujq8WUVP3GcFedY6S";

const withTenant = {
  model: Tenants,
  as: "tenant",
  attributes: ["id", "name", "slug", "plan", "Status"],
};

const userById = (id) => Users.findByPk(id, { include: [withTenant] });

const registerFailure = async (user) => {
  const attempts = user.failedLoginAttempts + 1;
  const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;
  await user.update({
    failedLoginAttempts: shouldLock ? 0 : attempts,
    lockedUntil: shouldLock ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : null,
  });
  return shouldLock;
};

const issueSession = async (user, { familyId = newFamilyId(), userAgent, ip }) => {
  const token = newRefreshToken();
  await RefreshTokens.create({
    userId: user.id,
    familyId,
    tokenHash: hashToken(token),
    expiresAt: refreshExpiry(),
    userAgent: userAgent ?? null,
    ip: ip ?? null,
  });
  return { accessToken: signAccessToken(user), refreshToken: token, familyId };
};

const assertUsable = (user) => {
  if (user.Status === "BLOCKED") throw forbidden("This account has been blocked");
  if (user.Status === "INACTIVE") throw forbidden("This account is inactive");
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw tooManyRequests(`Account locked. Try again after ${user.lockedUntil.toISOString()}`);
  }
  if (user.tenant?.Status === "SUSPENDED") throw forbidden("This workspace is suspended");
};

export const login = async ({ tenantSlug, userName, password }, meta = {}) => {
  const tenant = await Tenants.findOne({ where: { slug: String(tenantSlug).toLowerCase() } });
  if (!tenant || tenant.Status !== "ACTIVE") {
    // Hash anyway so a missing tenant and a wrong password take the same time.
    await bcrypt.compare(password, DUMMY_HASH);
    throw unauthorized(GENERIC_LOGIN_FAILURE);
  }

  const user = await Users.findOne({ where: { tenantId: tenant.id, userName }, include: [withTenant] });
  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    throw unauthorized(GENERIC_LOGIN_FAILURE);
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw tooManyRequests("Account temporarily locked after too many failed attempts");
  }

  const passwordMatches = await bcrypt.compare(password, user.password);
  if (!passwordMatches) {
    const locked = await registerFailure(user);
    throw unauthorized(locked ? "Too many failed attempts. Account locked for 15 minutes." : GENERIC_LOGIN_FAILURE);
  }

  assertUsable(user);

  await user.update({
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLogin: new Date(),
    IsReset: false,
  });

  const session = await issueSession(user, meta);
  return { ...session, user: publicUser(user) };
};

export const rotateRefreshToken = async (presentedToken, meta = {}) => {
  if (!presentedToken) throw unauthorized("No refresh token supplied");

  const record = await RefreshTokens.findOne({ where: { tokenHash: hashToken(presentedToken) } });
  if (!record) throw unauthorized("Invalid session");

  if (record.revokedAt) {
    // A revoked token being replayed means the cookie leaked - burn the whole family.
    await RefreshTokens.update(
      { revokedAt: new Date(), revokedReason: "REUSE_DETECTED" },
      { where: { familyId: record.familyId, revokedAt: null } },
    );
    throw unauthorized("Session reuse detected, please sign in again");
  }

  if (record.expiresAt < new Date()) {
    throw unauthorized("Session expired, please sign in again");
  }

  const user = await userById(record.userId);
  if (!user) throw unauthorized("Invalid session");
  assertUsable(user);

  const next = newRefreshToken();
  await record.update({ revokedAt: new Date(), revokedReason: "ROTATED" });
  await RefreshTokens.create({
    userId: user.id,
    familyId: record.familyId,
    tokenHash: hashToken(next),
    expiresAt: refreshExpiry(),
    userAgent: meta.userAgent ?? null,
    ip: meta.ip ?? null,
  });

  return { accessToken: signAccessToken(user), refreshToken: next, familyId: record.familyId, user: publicUser(user) };
};

export const revokeSession = async (presentedToken, reason = "LOGOUT") => {
  if (!presentedToken) return;
  const record = await RefreshTokens.findOne({ where: { tokenHash: hashToken(presentedToken) } });
  if (!record || record.revokedAt) return;
  await record.update({ revokedAt: new Date(), revokedReason: reason });
};

export const revokeAllSessions = async (userId, reason = "REVOKED_ALL") => {
  await RefreshTokens.update(
    { revokedAt: new Date(), revokedReason: reason },
    { where: { userId, revokedAt: null } },
  );
};

export const getSessionUser = async (userId) => {
  const user = await userById(userId);
  if (!user) throw unauthorized("Account no longer exists");
  assertUsable(user);
  return publicUser(user);
};

export const purgeExpiredTokens = async () =>
  RefreshTokens.destroy({ where: { expiresAt: { [Op.lt]: new Date() } } });

export const listActiveSessions = (userId) =>
  RefreshTokens.findAll({
    where: { userId, revokedAt: null, expiresAt: { [Op.gt]: new Date() } },
    attributes: ["id", "userAgent", "ip", "CreatedAt", "expiresAt"],
    order: [["CreatedAt", "DESC"]],
  });

export const listRoles = async () => ROLES;

export { MAX_FAILED_ATTEMPTS, LOCK_MINUTES, GENERIC_LOGIN_FAILURE };
