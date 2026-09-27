import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { login, rotateRefreshToken, revokeSession, revokeAllSessions, listActiveSessions, listRoles } from "./auth.service.js";
import { setRefreshCookie, clearRefreshCookie, REFRESH_COOKIE } from "../../../utils/tokens.js";
import { sendSuccess, sendCreated } from "../../../utils/response.js";
import { unauthorized } from "../../../utils/AppError.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { Users } from "../../../models/index.js";

const SALT_ROUNDS = 10;

const requestMeta = (req) => ({
  userAgent: req.get("user-agent")?.slice(0, 255) ?? null,
  ip: req.ip ?? null,
});

const withTokens = (res, { accessToken, refreshToken, user }) => {
  setRefreshCookie(res, refreshToken);
  return { accessToken, user };
};

export const loginController = asyncHandler(async (req, res) => {
  const { tenantSlug, userName, password } = req.body;
  const result = await login({ tenantSlug, userName, password }, requestMeta(req));

  return sendSuccess(res, {
    statusCode: 200,
    message: "Signed in successfully",
    data: withTokens(res, result),
  });
});

export const refreshController = asyncHandler(async (req, res) => {
  const presented = req.cookies?.[REFRESH_COOKIE];
  const result = await rotateRefreshToken(presented, requestMeta(req));

  return sendSuccess(res, {
    message: "Session refreshed",
    data: withTokens(res, result),
  });
});

export const logoutController = asyncHandler(async (req, res) => {
  await revokeSession(req.cookies?.[REFRESH_COOKIE]);
  clearRefreshCookie(res);
  return sendSuccess(res, { message: "Signed out successfully" });
});

export const meController = asyncHandler(async (req, res) => {
  return sendSuccess(res, { message: "Current session", data: req.user });
});

export const logoutAllController = asyncHandler(async (req, res) => {
  await revokeAllSessions(req.user.id);
  clearRefreshCookie(res);
  return sendSuccess(res, { message: "Signed out of all devices" });
});

export const sessionsController = asyncHandler(async (req, res) => {
  return sendSuccess(res, { data: await listActiveSessions(req.user.id) });
});

export const rolesController = asyncHandler(async (req, res) => {
  return sendSuccess(res, {
    message: "Role catalog",
    data: await listRoles(),
    meta: { permissionsEnforced: false },
  });
});

export const createSuperAdmin = asyncHandler(async (req, res) => {
  const { userName, fullName, email, phone, password } = req.body;
  const tenantId = req.user?.tenant?.id;

  if (!tenantId) throw unauthorized("Cannot determine workspace for the new user");

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const admin = await Users.create({
    tenantId,
    userId: `USR-${randomUUID().slice(0, 8).toUpperCase()}`,
    userName,
    fullName,
    email: email || null,
    phone: phone || null,
    password: hashedPassword,
    role: req.user.role,
    Status: "ACTIVE",
    IsReset: true,
  });

  return sendCreated(res, {
    message: "User created successfully",
    data: { id: admin.id, userId: admin.userId, userName: admin.userName, fullName: admin.fullName },
  });
});
