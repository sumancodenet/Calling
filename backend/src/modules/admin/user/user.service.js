import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { Op } from "sequelize";
import { Users, Tenants, RefreshTokens } from "../../../models/index.js";
import { unprocessable, conflict, badRequest, notFound, forbidden } from "../../../utils/AppError.js";
import { DEFAULT_ROLE } from "./user.validators.js";

const SALT_ROUNDS = 10;

const newUserId = () => `USR-${randomUUID().slice(0, 8).toUpperCase()}`;

const blank = (value) => value === undefined || value === null || String(value).trim() === "";

const trimmed = (value) => (blank(value) ? null : String(value).trim());

/**
 * Duplicate detection runs before the transaction so a clash is reported as a
 * validation error naming the offending rows, rather than as an opaque
 * SequelizeUniqueConstraintError.
 */
const findInBatchConflicts = async (tenantId, rows) => {
  const names = rows.map((r) => String(r.userName).trim()).filter(Boolean);
  const phones = rows.map((r) => String(r.phone).trim()).filter(Boolean);
  const emails = rows.map((r) => trimmed(r.email)).filter(Boolean);
  const employeeIds = rows.map((r) => trimmed(r.employeeId)).filter(Boolean);

  const [byName, byPhone, byEmail, byEmployee] = await Promise.all([
    Users.findAll({ where: { tenantId, userName: { [Op.in]: names } }, attributes: ["userName"] }),
    Users.findAll({ where: { tenantId, phone: { [Op.in]: phones } }, attributes: ["phone"] }),
    emails.length
      ? Users.findAll({ where: { tenantId, email: { [Op.in]: emails } }, attributes: ["email"] })
      : Promise.resolve([]),
    employeeIds.length
      ? Users.findAll({ where: { tenantId, employeeId: { [Op.in]: employeeIds } }, attributes: ["employeeId"] })
      : Promise.resolve([]),
  ]);

  const taken = {
    userName: new Set(byName.map((u) => u.userName)),
    phone: new Set(byPhone.map((u) => u.phone)),
    email: new Set(byEmail.map((u) => u.email)),
    employeeId: new Set(byEmployee.map((u) => u.employeeId)),
  };

  const errors = [];
  const seen = { userName: new Set(), phone: new Set(), email: new Set(), employeeId: new Set() };

  rows.forEach((row, index) => {
    const userName = String(row.userName).trim();
    const phone = String(row.phone).trim();
    const email = trimmed(row.email);
    const employeeId = trimmed(row.employeeId);

    const clash = (field, value) => {
      if (!value) return;
      // Already used earlier in this same batch, not just in the database.
      if (seen[field].has(value)) {
        errors.push({ field: `users.${index}.${field}`, message: `Duplicate ${field} "${value}" in this request` });
      } else if (taken[field].has(value)) {
        errors.push({ field: `users.${index}.${field}`, message: `${field} "${value}" is already in use` });
      }
      seen[field].add(value);
    };

    clash("userName", userName);
    clash("phone", phone);
    clash("email", email);
    clash("employeeId", employeeId);
  });

  return errors;
};

/**
 * Creates many users in one transaction: either every row lands or none does.
 * A partial import of a payroll-style list is worse than a clear failure.
 */
export const createUsers = async ({ tenantId, userId, users }) => {
  const tenant = await Tenants.findByPk(tenantId, { attributes: ["id", "maxUsers"] });
  if (!tenant) throw badRequest("Workspace not found");

  const currentCount = await Users.count({ where: { tenantId } });
  if (currentCount + users.length > tenant.maxUsers) {
    throw conflict(
      `This workspace allows ${tenant.maxUsers} users and already has ${currentCount}. You tried to add ${users.length}.`,
      { maxUsers: tenant.maxUsers, current: currentCount, requested: users.length },
    );
  }

  const conflicts = await findInBatchConflicts(tenantId, users);
  if (conflicts.length > 0) {
    throw unprocessable(conflicts[0].message, conflicts);
  }

  // One hash reused across the batch: bcrypt is deliberately slow, and hashing
  // the same password N times would dominate the request time.
  const uniquePasswords = [...new Set(users.map((u) => String(u.password)))];
  const hashes = {};
  for (const password of uniquePasswords) {
    hashes[password] = await bcrypt.hash(password, SALT_ROUNDS);
  }

  const created = await Users.sequelize.transaction(async (t) => {
    const rows = users.map((u) => ({
      tenantId,
      userId: newUserId(),
      userName: String(u.userName).trim(),
      fullName: trimmed(u.fullName) || String(u.userName).trim(),
      phone: String(u.phone).trim(),
      email: trimmed(u.email),
      employeeId: trimmed(u.employeeId),
      password: hashes[String(u.password)],
      role: trimmed(u.role)?.toUpperCase() || DEFAULT_ROLE,
      Status: "ACTIVE",
      // The user must change this password at first sign in.
      IsReset: true,
      CreatedBy: userId,
    }));

    return Users.bulkCreate(rows, { transaction: t });
  });

  return created.map((u) => ({
    id: u.id,
    userId: u.userId,
    userName: u.userName,
    fullName: u.fullName,
    phone: u.phone,
    email: u.email,
    employeeId: u.employeeId,
    role: u.role,
    Status: u.Status,
  }));
};

const findOne = async (tenantId, id) => {
  // Scoped to the tenant, so another workspace's id is a 404 rather than a 403.
  const user = await Users.findOne({ where: { id, tenantId } });
  if (!user) throw notFound("User not found");
  return user;
};

export const getUser = async ({ tenantId, id }) => {
  const user = await findOne(tenantId, id);
  return {
    id: user.id,
    userId: user.userId,
    userName: user.userName,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    employeeId: user.employeeId,
    role: user.role,
    Status: user.Status,
    IsReset: user.IsReset,
    lastLogin: user.lastLogin,
    CreatedAt: user.CreatedAt,
  };
};

/** Conflicts introduced by an edit are reported before anything is written. */
const assertNoConflict = async (tenantId, { id, userName, phone, email, employeeId }) => {
  const checks = [
    ["userName", userName],
    ["phone", phone],
    ["email", email],
    ["employeeId", employeeId],
  ].filter(([, value]) => value);

  for (const [field, value] of checks) {
    const clash = await Users.findOne({
      where: { tenantId, [field]: value, id: { [Op.ne]: id } },
      attributes: ["id"],
    });
    if (clash) throw conflict(`${field} "${value}" is already in use`, { field, value });
  }
};

export const updateUser = async ({ tenantId, id, body }) => {
  const user = await findOne(tenantId, id);

  const patch = {};
  for (const field of ["fullName", "email", "phone", "employeeId"]) {
    if (body[field] !== undefined) patch[field] = trimmed(body[field]);
  }
  if (body.role !== undefined && !blank(body.role)) patch.role = String(body.role).trim().toUpperCase();
  if (body.Status !== undefined) patch.Status = String(body.Status).trim().toUpperCase();

  if (Object.keys(patch).length === 0) {
    throw badRequest("Nothing to update");
  }

  await assertNoConflict(tenantId, { id, ...patch });
  await user.update(patch);

  // A role or status change must not leave an old session running.
  if (patch.role || patch.Status) {
    await RefreshTokens.destroy({ where: { userId: user.id, revokedAt: null } });
  }

  return getUser({ tenantId, id: user.id });
};

/**
 * Administrative password reset. Every active session for that user is revoked
 * and IsReset is set so they are forced to choose a new one at next sign in.
 */
export const changePassword = async ({ tenantId, id, newPassword }) => {
  const user = await findOne(tenantId, id);

  await user.update({
    password: await bcrypt.hash(newPassword, SALT_ROUNDS),
    IsReset: true,
    passwordChangedAt: new Date(),
    // A reset also clears any lockout from failed attempts.
    failedLoginAttempts: 0,
    lockedUntil: null,
  });

  await RefreshTokens.destroy({ where: { userId: user.id, revokedAt: null } });

  return { id: user.id, reset: true, sessionsRevoked: true };
};

export const deleteUser = async ({ tenantId, actorId, id }) => {
  if (Number(actorId) === Number(id)) {
    throw forbidden("You cannot delete your own account");
  }

  const user = await findOne(tenantId, id);

  if (user.role === "ADMIN") {
    const admins = await Users.count({ where: { tenantId, role: "ADMIN", Status: "ACTIVE" } });
    if (admins <= 1) {
      throw conflict("This is the last active admin, so it cannot be deleted");
    }
  }

  // Sessions are removed explicitly: RefreshTokens has no FK, it is keyed by userId.
  await RefreshTokens.destroy({ where: { userId: user.id } });
  await user.destroy();

  return { id: user.id, userName: user.userName, deleted: true };
};
